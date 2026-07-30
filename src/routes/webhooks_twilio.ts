/**
 * Twilio webhook handlers.
 *
 *   POST /webhooks/twilio/sms      — inbound SMS from a customer
 *   POST /webhooks/twilio/voice    — initial voice IVR (returns TwiML)
 *   POST /webhooks/twilio/voice/keypress — IVR keypress capture
 *   POST /webhooks/twilio/status   — delivery-receipt callbacks
 *
 * Production-ready: signature verification activates when TWILIO_AUTH_TOKEN
 * is set in Railway. Without the token (demo mode), every webhook returns 200
 * + appends a log line. Flipping to real Twilio at cutover is a config change.
 *
 * Routing on inbound SMS / keypress: look up the contact by E.164 phone, find
 * the most-recent non-Closed RSE for that contact's location, attach the
 * inbound reply there. If no match, log to a "lost" bucket (still accept the
 * 200 — never make Twilio retry on our routing failures).
 */

import { Hono } from 'hono'
import { db, getSettings } from '../db/client.js'
import { appendLog, getJobDetail, transition } from '../db/queries_inbox.js'
import { fullWebhookUrl, verifyTwilioSignature } from '../lib/twilio_signature.js'
import { classifyReply } from '../agent/classifier.js'
import { extractProposedDate } from '../agent/extractor.js'
import type { AgentState } from '../agent/state_machine.js'

const route = new Hono()

// --- shared helpers ---------------------------------------------------------

async function parseFormBody(req: Request): Promise<Record<string, string>> {
  const text = await req.text()
  const params = new URLSearchParams(text)
  const out: Record<string, string> = {}
  for (const [k, v] of params.entries()) out[k] = v
  return out
}

/** E.164 → digits-only for tolerant matching against legacy seeded numbers. */
function digitsOnly(phone: string): string {
  return phone.replace(/[^\d]/g, '')
}

interface ResolvedJob {
  rseId: string
  contactId: string | null
}

function findRseForPhone(fromPhone: string): ResolvedJob | null {
  const digits = digitsOnly(fromPhone)
  if (digits.length < 7) return null
  // Wildcard match against the trailing 10 digits to tolerate the +1 prefix
  // that Twilio always adds to US numbers.
  const tail = digits.slice(-10)
  const row = db
    .prepare(
      `
      SELECT r.id AS rse_id, ct.id AS contact_id
      FROM contacts ct
      JOIN locations l ON l.id = ct.location_id
      JOIN recurring_services rs ON rs.location_id = l.id
      JOIN recurring_service_events r ON r.recurring_service_id = rs.id
      WHERE replace(replace(replace(replace(ct.phone, '(',''), ')',''), ' ',''), '-','') LIKE ?
        AND r.state NOT IN ('Closed_Booked','Closed_OptedOut','Closed_BookedOutsideAgent','Skipped_PreSendCheckCancelled')
      ORDER BY r.due_date DESC
      LIMIT 1
    `,
    )
    .get('%' + tail) as { rse_id: string; contact_id: string } | undefined
  if (!row) return null
  return { rseId: row.rse_id, contactId: row.contact_id }
}

// --- /webhooks/twilio/sms ---------------------------------------------------

route.post('/sms', async (c) => {
  const body = await parseFormBody(c.req.raw.clone())
  const verified = verifyTwilioSignature(
    fullWebhookUrl(c.req.header('host'), '/webhooks/twilio/sms'),
    body,
    c.req.header('x-twilio-signature'),
  )
  if (!verified.ok) {
    console.warn(`Twilio signature verification failed: ${verified.reason}`)
    return c.text('Forbidden', 403)
  }

  const from = body.From ?? ''
  const to = body.To ?? ''
  const text = body.Body ?? ''
  const messageSid = body.MessageSid ?? ''
  const settings = getSettings()
  const now = settings.demo_clock_iso

  const job = findRseForPhone(from)
  if (!job) {
    // Not routed — log and 204. Don't retry; the message is captured at the
    // server level and a Coordinator can hunt it down.
    console.warn(`Inbound SMS from ${from} (sid=${messageSid}) — no matching RSE.`)
    return c.text('<Response/>', 200, { 'Content-Type': 'text/xml' })
  }

  // Insert reply with classification deferred. Run the LLM pipeline now so
  // the Coordinator sees the parsed intent on the next /inbox load.
  let classification: string | null = null
  let parsedDate: string | null = null
  let confidence: number | null = null
  let nextState: AgentState | null = null
  const before = getJobDetail(job.rseId)
  appendLog(job.rseId, 'info', `Inbound SMS from ${from}.`, now)
  appendLog(job.rseId, 'info', 'Running SMS classification…', now)

  try {
    const cls = await classifyReply(text)
    classification = cls.classification
    confidence = cls.confidence
    appendLog(
      job.rseId,
      'success',
      `Classified as ${cls.classification}. ${cls.rationale}`,
      now,
    )
    if (cls.classification === 'proposed-date' && before) {
      const ext = await extractProposedDate({
        replyText: text,
        referenceDateIso: now,
        dueDateIso: before.rse.due_date,
      })
      parsedDate = ext.parsedDate
      confidence = Math.min(cls.confidence, ext.confidence)
      appendLog(
        job.rseId,
        ext.parsedDate ? 'success' : 'warn',
        `Extraction: ${
          ext.parsedDate
            ? `${ext.parsedDate}${ext.parsedTimeWindow ? ` (${ext.parsedTimeWindow})` : ''}`
            : 'no concrete date'
        }. ${ext.rationale}`,
        now,
      )
      nextState =
        ext.parsedDate && ext.confidence >= 0.6
          ? 'AwaitingHuman_DateProposed'
          : 'AwaitingHuman_AmbiguousReply'
    } else if (cls.classification === 'question') {
      nextState = 'AwaitingHuman_Question'
    } else if (cls.classification === 'opt-out') {
      nextState = 'Closed_OptedOut'
    }
  } catch (err) {
    appendLog(job.rseId, 'error', `LLM call failed: ${(err as Error).message.slice(0, 200)}`, now)
  }

  db.prepare(
    `INSERT INTO inbound_replies (rse_id, channel, contact_id, from_address, raw_text, classification, parsed_date, llm_confidence, received_at_demo_clock)
     VALUES (?, 'sms', ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    job.rseId,
    job.contactId,
    from,
    text,
    classification,
    parsedDate,
    confidence,
    now,
  )

  if (nextState) {
    transition(
      job.rseId,
      nextState,
      classification === 'opt-out'
        ? 'Contact opted out via SMS'
        : classification === 'question'
          ? 'Contact asked a question via SMS'
          : parsedDate
            ? `Contact proposed ${parsedDate} via SMS`
            : 'Contact SMS reply needs clarification',
      now,
    )
  }

  // Empty TwiML — Twilio expects a 200 with valid XML. We don't auto-reply
  // (the agent's responses are async, drafted in-app for human review).
  return c.text('<?xml version="1.0" encoding="UTF-8"?><Response/>', 200, {
    'Content-Type': 'text/xml; charset=utf-8',
  })
})

// --- /webhooks/twilio/voice -------------------------------------------------

route.post('/voice', async (c) => {
  const body = await parseFormBody(c.req.raw.clone())
  const verified = verifyTwilioSignature(
    fullWebhookUrl(c.req.header('host'), '/webhooks/twilio/voice'),
    body,
    c.req.header('x-twilio-signature'),
  )
  if (!verified.ok) {
    console.warn(`Twilio signature verification failed (voice): ${verified.reason}`)
    return c.text('Forbidden', 403)
  }

  const from = body.From ?? ''
  const callSid = body.CallSid ?? ''
  const job = findRseForPhone(from)
  const settings = getSettings()
  const now = settings.demo_clock_iso

  if (job) {
    appendLog(
      job.rseId,
      'info',
      `Voice IVR session opened with ${from} (CallSid ${callSid}).`,
      now,
    )
  }

  // Per PRD User Story 3: 30-second IVR, press 1 / press 2.
  // Gather collects exactly one digit; falls through to a Say + hangup if
  // the caller doesn't press anything.
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather numDigits="1" timeout="8" action="/webhooks/twilio/voice/keypress" method="POST">
    <Say voice="alice">This is a courtesy call from Kestrel Property Management about your preventative maintenance. Press 1 to request a date. Press 2 to have a booking link emailed to you.</Say>
  </Gather>
  <Say voice="alice">No selection received. Goodbye.</Say>
</Response>`
  return c.text(twiml, 200, { 'Content-Type': 'text/xml; charset=utf-8' })
})

// --- /webhooks/twilio/voice/keypress ---------------------------------------

route.post('/voice/keypress', async (c) => {
  const body = await parseFormBody(c.req.raw.clone())
  const verified = verifyTwilioSignature(
    fullWebhookUrl(c.req.header('host'), '/webhooks/twilio/voice/keypress'),
    body,
    c.req.header('x-twilio-signature'),
  )
  if (!verified.ok) return c.text('Forbidden', 403)

  const from = body.From ?? ''
  const digits = body.Digits ?? ''
  const job = findRseForPhone(from)
  const settings = getSettings()
  const now = settings.demo_clock_iso

  if (!job) {
    // Unmatched call — return a polite hangup.
    return c.text(
      `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Say voice="alice">Thank you. Goodbye.</Say>\n</Response>`,
      200,
      { 'Content-Type': 'text/xml; charset=utf-8' },
    )
  }

  if (digits === '1') {
    appendLog(
      job.rseId,
      'success',
      `IVR keypress 1 detected — caller requested a date.`,
      now,
    )
    db.prepare(
      `INSERT INTO inbound_replies (rse_id, channel, contact_id, from_address, raw_text, classification, parsed_date, llm_confidence, received_at_demo_clock)
       VALUES (?, 'voice-keypress', ?, ?, ?, NULL, NULL, NULL, ?)`,
    ).run(job.rseId, job.contactId, from, '[Pressed 1: request a date]', now)
    // Production: would then prompt for spoken date and run transcription;
    // for v1 we route to human and let the Coordinator follow up.
    transition(
      job.rseId,
      'AwaitingHuman_DateProposed',
      'IVR keypress 1 — caller requested a date',
      now,
    )
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thanks. Please leave your preferred service date and a callback number after the tone.</Say>
  <Record maxLength="30" playBeep="true" trim="trim-silence" />
  <Say voice="alice">Got it. Kestrel Property Management will follow up shortly. Goodbye.</Say>
</Response>`
    return c.text(twiml, 200, { 'Content-Type': 'text/xml; charset=utf-8' })
  }

  if (digits === '2') {
    appendLog(
      job.rseId,
      'success',
      `IVR keypress 2 detected — caller requested an email link.`,
      now,
    )
    db.prepare(
      `INSERT INTO inbound_replies (rse_id, channel, contact_id, from_address, raw_text, classification, parsed_date, llm_confidence, received_at_demo_clock)
       VALUES (?, 'voice-keypress', ?, ?, ?, NULL, NULL, NULL, ?)`,
    ).run(
      job.rseId,
      job.contactId,
      from,
      '[Pressed 2: email me a booking link]',
      now,
    )
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="alice">Thanks. We will email a booking link shortly. Goodbye.</Say>
</Response>`
    return c.text(twiml, 200, { 'Content-Type': 'text/xml; charset=utf-8' })
  }

  // Any other digit — graceful hangup.
  return c.text(
    `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n  <Say voice="alice">Sorry, that wasn't a valid option. Goodbye.</Say>\n</Response>`,
    200,
    { 'Content-Type': 'text/xml; charset=utf-8' },
  )
})

// --- /webhooks/twilio/status ------------------------------------------------

route.post('/status', async (c) => {
  const body = await parseFormBody(c.req.raw.clone())
  const verified = verifyTwilioSignature(
    fullWebhookUrl(c.req.header('host'), '/webhooks/twilio/status'),
    body,
    c.req.header('x-twilio-signature'),
  )
  if (!verified.ok) return c.text('Forbidden', 403)

  const sid = body.MessageSid ?? body.CallSid ?? ''
  const status = body.MessageStatus ?? body.CallStatus ?? ''
  const errorCode = body.ErrorCode ?? ''

  if (!sid) return c.body(null, 204)

  // Update outreach_attempts metadata. We match on twilio_sid_simulated
  // (set when outreach was sent in production mode).
  const row = db
    .prepare(
      `SELECT id, metadata FROM outreach_attempts WHERE twilio_sid_simulated = ? LIMIT 1`,
    )
    .get(sid) as { id: number; metadata: string | null } | undefined

  if (row) {
    let meta: Record<string, unknown> = {}
    try {
      meta = row.metadata ? JSON.parse(row.metadata) : {}
    } catch {
      meta = {}
    }
    meta.deliveryStatus = status
    if (errorCode) meta.errorCode = errorCode
    meta.lastStatusAt = new Date().toISOString()
    db.prepare(`UPDATE outreach_attempts SET metadata = ? WHERE id = ?`).run(
      JSON.stringify(meta),
      row.id,
    )
  }

  return c.body(null, 204)
})

export default route
