import { Hono } from 'hono'
import { html } from 'hono/html'
import { db, getSettings } from '../db/client.js'
import {
  appendLog,
  getJobDetail,
  getLogsSince,
  listJobs,
  listRsesTransitionedAt,
  transition,
} from '../db/queries_inbox.js'
import { classifyReply } from '../agent/classifier.js'
import { extractProposedDate } from '../agent/extractor.js'
import { pickReply } from '../agent/reply_simulator.js'
import type { AgentState, InboundClassification } from '../agent/state_machine.js'
import { inboxPage } from '../views/inbox.js'
import { conversationFragment, jobDetailPage, timelineRow } from '../views/job_detail.js'

const route = new Hono()

route.get('/', (c) => {
  const settings = getSettings()
  const tourStep = Number.parseInt(c.req.query('tour') ?? '0', 10) || undefined
  const tick = c.req.query('tick') === 'forward'
    ? 'forward'
    : c.req.query('tick') === 'back'
      ? 'back'
      : undefined
  const tickDays = tick ? Number.parseInt(c.req.query('days') ?? '0', 10) || 0 : 0
  const flashedRseIds =
    tick === 'forward' ? listRsesTransitionedAt(settings.demo_clock_iso) : []
  return c.html(
    inboxPage({
      jobs: listJobs(),
      demoClockIso: settings.demo_clock_iso,
      smsOutboundEnabled: settings.sms_outbound_enabled === 1,
      ingestAdapter: settings.ingest_adapter,
      tourStep,
      tick,
      tickDays,
      flashedRseIds,
    }),
  )
})

route.get('/:rseId', (c) => {
  const detail = getJobDetail(c.req.param('rseId'))
  if (!detail) return c.notFound()
  const settings = getSettings()
  const tourStep = Number.parseInt(c.req.query('tour') ?? '0', 10) || undefined
  return c.html(
    jobDetailPage({
      detail,
      demoClockIso: settings.demo_clock_iso,
      smsOutboundEnabled: settings.sms_outbound_enabled === 1,
      ingestAdapter: settings.ingest_adapter,
      tourStep,
    }),
  )
})

// Polling endpoint for the Activity Timeline.
// Returns HTML <li> rows for any new agent_logs since `sinceId`. htmx appends
// them to #timeline-stream with hx-swap="beforeend".
route.get('/:rseId/timeline/since', (c) => {
  const rseId = c.req.param('rseId')
  const sinceId = Number.parseInt(c.req.query('sinceId') ?? '0', 10) || 0
  const rows = getLogsSince(rseId, sinceId)
  if (rows.length === 0) {
    // 204 means htmx leaves DOM untouched.
    return c.body(null, 204)
  }
  return c.html(
    html`${rows.map((r) =>
      timelineRow({
        kind: 'log',
        id: r.id,
        ts: r.ts_demo_clock,
        level: r.level,
        line: r.line,
      }),
    )}`,
  )
})

// State-transition actions. Verb-style admin routes prefixed with _ to avoid
// :id parameter shadowing per sagan-engineering-patterns §2.
route.post('/:rseId/_book', (c) => {
  const rseId = c.req.param('rseId')
  const detail = getJobDetail(rseId)
  if (!detail) return c.notFound()
  const settings = getSettings()
  const now = settings.demo_clock_iso
  transition(rseId, 'Closed_Booked', 'Coordinator confirmed booking', now)
  appendLog(rseId, 'success', '[Scheduling Agent] Coordinator marked as booked.', now)
  return c.redirect(`/inbox/${rseId}`)
})

route.post('/:rseId/_optout', (c) => {
  const rseId = c.req.param('rseId')
  const detail = getJobDetail(rseId)
  if (!detail) return c.notFound()
  const settings = getSettings()
  const now = settings.demo_clock_iso
  transition(rseId, 'Closed_OptedOut', 'Coordinator marked opted-out', now)
  appendLog(rseId, 'info', '[Scheduling Agent] Coordinator marked as opted-out.', now)
  return c.redirect(`/inbox/${rseId}`)
})

/**
 * Reply simulator. Picks a synthetic inbound reply from a per-customer pool,
 * then runs it through local rule-based classification + (if proposed-date)
 * local date extraction. Inserts the inbound_reply, streams agent_log lines,
 * and transitions state based on the classification.
 *
 * Returns a freshly-rendered thread fragment for htmx to swap in.
 */
route.post('/:rseId/_simulate-reply', async (c) => {
  const rseId = c.req.param('rseId')
  const before = getJobDetail(rseId)
  if (!before) return c.notFound()
  const settings = getSettings()
  const now = settings.demo_clock_iso

  const usedIntents: string[] = before.replies
    .map((r) => r.classification)
    .filter((x): x is InboundClassification => x !== null)
  const reply = pickReply(
    {
      customerName: before.customer.name,
      cadence: before.recurring_service.cadence,
      dueDate: before.rse.due_date,
    },
    usedIntents,
  )

  const primaryContact =
    before.contacts.find((c) => c.is_primary === 1) ?? before.contacts[0]
  const fromAddress =
    reply.channel === 'email'
      ? primaryContact?.email ?? before.location.primary_email ?? 'unknown@example.com'
      : primaryContact?.phone ?? before.location.primary_phone ?? '(000) 000-0000'

  appendLog(
    rseId,
    'info',
    `Inbound ${reply.channel} from ${fromAddress}.`,
    now,
  )
  appendLog(
    rseId,
    'info',
    `Running ${reply.channel === 'email' ? 'email' : 'SMS'} classification…`,
    now,
  )

  let classification: string | null = null
  let parsedDate: string | null = null
  let confidence: number | null = null
  let nextState: AgentState | null = null

  try {
    const cls = await classifyReply(reply.text)
    classification = cls.classification
    confidence = cls.confidence
    appendLog(
      rseId,
      'success',
      `Classified as ${cls.classification}. ${cls.rationale}`,
      now,
    )

    if (cls.classification === 'proposed-date') {
      appendLog(rseId, 'info', 'Running local date extraction…', now)
      const ext = await extractProposedDate({
        replyText: reply.text,
        referenceDateIso: now,
        dueDateIso: before.rse.due_date,
      })
      parsedDate = ext.parsedDate
      confidence = Math.min(cls.confidence, ext.confidence)
      appendLog(
        rseId,
        ext.parsedDate ? 'success' : 'warn',
        `Extraction: ${
          ext.parsedDate
            ? `${ext.parsedDate}${ext.parsedTimeWindow ? ` (${ext.parsedTimeWindow})` : ''}`
            : 'no concrete date'
        }. ${ext.rationale}`,
        now,
      )

      if (ext.parsedDate && ext.confidence >= 0.6) {
        nextState = 'AwaitingHuman_DateProposed'
      } else {
        nextState = 'AwaitingHuman_AmbiguousReply'
      }
    } else if (cls.classification === 'question') {
      nextState = 'AwaitingHuman_Question'
    } else if (cls.classification === 'opt-out') {
      nextState = 'Closed_OptedOut'
    } else {
      // irrelevant — leave state as-is, but log it
      appendLog(rseId, 'warn', 'Reply classified as irrelevant. State unchanged.', now)
    }
  } catch (err) {
    const msg = (err as Error).message
    appendLog(rseId, 'error', `Classification failed: ${msg.slice(0, 200)}`, now)
  }

  // Insert the inbound_reply row.
  db.prepare(
    `INSERT INTO inbound_replies (rse_id, channel, contact_id, from_address, raw_text, classification, parsed_date, llm_confidence, received_at_demo_clock)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    rseId,
    reply.channel,
    primaryContact?.id ?? null,
    fromAddress,
    reply.text,
    classification,
    parsedDate,
    confidence,
    now,
  )

  // Transition if the classification implies one.
  if (nextState) {
    transition(
      rseId,
      nextState,
      classification === 'opt-out'
        ? 'Contact opted out'
        : classification === 'question'
          ? 'Contact asked a question'
          : parsedDate
            ? `Contact proposed ${parsedDate}`
            : 'Contact reply needs clarification',
      now,
    )
  }

  const after = getJobDetail(rseId)
  if (!after) return c.notFound()
  return c.html(conversationFragment(after, settings.sms_outbound_enabled === 1, now))
})

export default route
