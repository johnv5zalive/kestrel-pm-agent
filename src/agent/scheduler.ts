/**
 * Scheduler — runs the 10/5/0 cadence against the demo clock.
 * Idempotent forward-only: same clock state after multiple ticks at the same time.
 *
 * For each RSE, advance state when a T-mark is crossed:
 *   - Upcoming                       + clock ≥ due − 10d   → Email T-10  (synth email outreach)
 *   - InProgress_EmailT10_Sent       + clock ≥ due − 5d    → Email T-5 or SMS T-5
 *   - InProgress_EmailT5_Sent or
 *     InProgress_SmsT5_Sent          + clock ≥ due AND     → Voice IVR T-0  (landline-only)
 *                                                landline
 *   - InProgress_VoiceT0_Attempted   + clock ≥ due + 1d    → Escalated
 *   - InProgress_*5_Sent + no landline + clock ≥ due + 1d  → Escalated
 *
 * Pre-send check (Adapter 1 only): a visible timeline line announcing the
 * verification is fired immediately before each outreach send.
 */

import { db, getSettings } from '../db/client.js'
import { appendLog, transition } from '../db/queries_inbox.js'
import { recordOutreach, visit } from '../db/threads.js'
import type { AgentState } from './state_machine.js'

interface SchedulerCandidate {
  rse_id: string
  state: AgentState
  due_date: string
  ingested_via_adapter: string
  primary_email: string | null
  primary_phone: string | null
  primary_line_type: 'mobile' | 'landline' | 'voip' | null
  primary_contact_id: string | null
  primary_contact_name: string | null
  has_landline_contact: number
  contact_count: number
  cadence: string
  customer_name: string
  recurring_service_name: string
}

const CANDIDATE_QUERY = `
  SELECT
    r.id AS rse_id,
    r.state AS state,
    r.due_date AS due_date,
    r.ingested_via_adapter AS ingested_via_adapter,
    rs.cadence AS cadence,
    rs.name AS recurring_service_name,
    c.name AS customer_name,
    pc.email AS primary_email,
    pc.phone AS primary_phone,
    pc.line_type AS primary_line_type,
    pc.id AS primary_contact_id,
    pc.name AS primary_contact_name,
    (SELECT COUNT(*) FROM contacts WHERE location_id = l.id AND line_type = 'landline') AS has_landline_contact,
    (SELECT COUNT(*) FROM contacts WHERE location_id = l.id) AS contact_count
  FROM recurring_service_events r
  JOIN recurring_services rs ON rs.id = r.recurring_service_id
  JOIN locations l ON l.id = rs.location_id
  JOIN customers c ON c.id = l.customer_id
  LEFT JOIN contacts pc ON pc.location_id = l.id AND pc.is_primary = 1
`

export interface TickResult {
  transitions: Array<{ rse_id: string; from: AgentState; to: AgentState; reason: string }>
  outreach_inserted: number
  logs_inserted: number
}

/** Advances the world to the given clock. Idempotent — repeated calls at same clock are no-ops. */
export function tickTo(clockIso: string): TickResult {
  const result: TickResult = {
    transitions: [],
    outreach_inserted: 0,
    logs_inserted: 0,
  }
  const adapter = getSettings().ingest_adapter
  const smsEnabled = getSettings().sms_outbound_enabled === 1
  const tx = db.transaction(() => {
    const candidates = db.prepare(CANDIDATE_QUERY).all() as SchedulerCandidate[]
    for (const job of candidates) {
      processJob(job, clockIso, adapter, smsEnabled, result)
    }
  })
  tx()
  return result
}

function processJob(
  job: SchedulerCandidate,
  clockIso: string,
  adapter: string,
  smsEnabled: boolean,
  result: TickResult,
) {
  const dueMs = new Date(job.due_date).getTime()
  const clockMs = new Date(clockIso).getTime()
  const day = 1000 * 60 * 60 * 24

  let curState: AgentState = job.state

  // Upcoming → InProgress_EmailT10_Sent
  if (curState === 'Upcoming' && clockMs >= dueMs - 10 * day) {
    if (preSendCheck(job, adapter, clockIso, 'email', result)) {
      sendEmail(job, clockIso, 'T-10', result)
      transition(
        job.rse_id,
        'InProgress_EmailT10_Sent',
        'First reminder emailed',
        clockIso,
      )
      result.transitions.push({
        rse_id: job.rse_id,
        from: curState,
        to: 'InProgress_EmailT10_Sent',
        reason: 'First reminder emailed',
      })
      curState = 'InProgress_EmailT10_Sent'
    }
  }

  // InProgress_EmailT10_Sent → Email T-5 (or SMS T-5 if outbound enabled + mobile primary)
  if (curState === 'InProgress_EmailT10_Sent' && clockMs >= dueMs - 5 * day) {
    if (smsEnabled && job.primary_line_type === 'mobile' && job.primary_phone) {
      if (preSendCheck(job, adapter, clockIso, 'sms', result)) {
        sendSms(job, clockIso, 'T-5', result)
        transition(job.rse_id, 'InProgress_SmsT5_Sent', 'Follow-up text sent', clockIso)
        result.transitions.push({
          rse_id: job.rse_id,
          from: curState,
          to: 'InProgress_SmsT5_Sent',
          reason: 'Follow-up text sent',
        })
        curState = 'InProgress_SmsT5_Sent'
      }
    } else if (job.primary_email) {
      if (preSendCheck(job, adapter, clockIso, 'email', result)) {
        sendEmail(job, clockIso, 'T-5', result)
        transition(
          job.rse_id,
          'InProgress_EmailT5_Sent',
          'Second reminder emailed',
          clockIso,
        )
        result.transitions.push({
          rse_id: job.rse_id,
          from: curState,
          to: 'InProgress_EmailT5_Sent',
          reason: 'Second reminder emailed',
        })
        curState = 'InProgress_EmailT5_Sent'
      }
    }
  }

  // InProgress_EmailT5_Sent or SmsT5 → Voice IVR T-0 (landline only)
  if (
    (curState === 'InProgress_EmailT5_Sent' || curState === 'InProgress_SmsT5_Sent') &&
    clockMs >= dueMs &&
    job.has_landline_contact > 0
  ) {
    if (preSendCheck(job, adapter, clockIso, 'voice', result)) {
      sendVoiceIvr(job, clockIso, result)
      transition(
        job.rse_id,
        'InProgress_VoiceT0_Attempted',
        'Automated call placed',
        clockIso,
      )
      result.transitions.push({
        rse_id: job.rse_id,
        from: curState,
        to: 'InProgress_VoiceT0_Attempted',
        reason: 'Automated call placed',
      })
      curState = 'InProgress_VoiceT0_Attempted'
    }
  }

  // After T+1 with no reply → Escalated
  if (
    (curState === 'InProgress_EmailT5_Sent' ||
      curState === 'InProgress_SmsT5_Sent' ||
      curState === 'InProgress_VoiceT0_Attempted') &&
    clockMs >= dueMs + 1 * day
  ) {
    appendLog(
      job.rse_id,
      'warn',
      'No reply by email, text or phone. Passing this to the coordinator.',
      clockIso,
    )
    result.logs_inserted += 1
    transition(job.rse_id, 'Escalated', 'No reply by email, text or phone', clockIso)
    result.transitions.push({
      rse_id: job.rse_id,
      from: curState,
      to: 'Escalated',
      reason: 'No reply by email, text or phone',
    })
    curState = 'Escalated'
  }
}

/** Adapter 1 pre-send check — returns true to proceed, false if cancelled. */
function preSendCheck(
  job: SchedulerCandidate,
  adapter: string,
  clockIso: string,
  channel: string,
  result: TickResult,
): boolean {
  if (adapter !== 'adapter1') return true
  appendLog(
    job.rse_id,
    'info',
    'Checking AppFolio in case this visit was already booked...',
    clockIso,
  )
  appendLog(
    job.rse_id,
    'success',
    `Still unbooked in AppFolio. Sending the ${channel}.`,
    clockIso,
  )
  result.logs_inserted += 2
  return true
}

function sendEmail(
  job: SchedulerCandidate,
  clockIso: string,
  marker: 'T-10' | 'T-5',
  result: TickResult,
) {
  const recipient = job.primary_email!
  const service = job.recurring_service_name.toLowerCase()
  const subject = `${
    marker === 'T-10' ? '' : 'Re: '
  }${job.recurring_service_name} at ${job.customer_name}: what day works?`
  const greeting = `Hi ${job.primary_contact_name ?? 'there'},`
  const body =
    marker === 'T-10'
      ? `${greeting}\n\n${capitalize(service)} at ${job.customer_name} is due ${formatDay(job.due_date)}.\n\nReply with a day that works and we will confirm a time with the technician.\n\nThanks,\nKestrel Property Management`
      : `${greeting}\n\nFollowing up on the ${service} at ${job.customer_name}, due ${formatDay(job.due_date)}. We have not heard back yet.\n\nReply with any day that works and we will fit the technician around it.\n\nThanks,\nKestrel Property Management`
  recordOutreach(visit(job.rse_id), {
    channel: 'email',
    contactId: job.primary_contact_id,
    recipient,
    subject,
    body,
    sentAt: clockIso,
  })
  appendLog(
    job.rse_id,
    'success',
    `Email sent to ${recipient}.`,
    clockIso,
  )
  result.outreach_inserted += 1
  result.logs_inserted += 1
}

function sendSms(
  job: SchedulerCandidate,
  clockIso: string,
  marker: 'T-5',
  result: TickResult,
) {
  const recipient = job.primary_phone!
  // A2P 10DLC requires opt-out language on every outbound template.
  const body = `Kestrel Property Management: ${job.recurring_service_name.toLowerCase()} at ${job.customer_name} is due ${formatDay(job.due_date)}. Reply with a day that works and we will confirm a time. Reply STOP to opt out.`
  recordOutreach(visit(job.rse_id), {
    channel: 'sms',
    contactId: job.primary_contact_id,
    recipient,
    body,
    sentAt: clockIso,
  })
  appendLog(
    job.rse_id,
    'success',
    `Text sent to ${recipient}.`,
    clockIso,
  )
  result.outreach_inserted += 1
  result.logs_inserted += 1
}

function sendVoiceIvr(
  job: SchedulerCandidate,
  clockIso: string,
  result: TickResult,
) {
  // Pick a landline contact for IVR.
  const landline = db
    .prepare(
      `SELECT id, name, phone FROM contacts WHERE location_id = (
        SELECT location_id FROM recurring_services WHERE id = (
          SELECT recurring_service_id FROM recurring_service_events WHERE id = ?
        )
      ) AND line_type = 'landline' ORDER BY role_rank ASC LIMIT 1`,
    )
    .get(job.rse_id) as { id: string; name: string; phone: string } | undefined
  if (!landline) return
  const body = `IVR script: "This is a courtesy call from Kestrel Property Management about scheduled maintenance at your building. Press 1 to request a date. Press 2 to have a booking link emailed to you." (No keypress detected — call ended.)`
  recordOutreach(visit(job.rse_id), {
    channel: 'voice',
    contactId: landline.id,
    recipient: landline.phone,
    body: body,
    sentAt: clockIso,
  })
  appendLog(
    job.rse_id,
    'info',
    `Voice IVR placed to ${landline.phone} — no keypress detected.`,
    clockIso,
  )
  result.outreach_inserted += 1
  result.logs_inserted += 1
}

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
