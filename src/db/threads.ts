/**
 * The conversation substrate shared by all three tracks.
 *
 * A "subject" is whatever the agent is currently chasing someone about:
 * a maintenance visit that needs a date, an approval that needs a yes, or a
 * certificate that needs renewing. All three accumulate the same four things —
 * outreach sent, replies received, log lines, and state changes — so they all
 * read and write through here rather than each growing its own copy.
 */

import { db } from './client.js'

export const SUBJECT_TYPES = ['visit', 'approval', 'compliance'] as const
export type SubjectType = (typeof SUBJECT_TYPES)[number]

export interface Subject {
  type: SubjectType
  id: string
}

export const visit = (id: string): Subject => ({ type: 'visit', id })
export const approval = (id: string): Subject => ({ type: 'approval', id })
export const compliance = (id: string): Subject => ({ type: 'compliance', id })

export type LogLevel = 'info' | 'warn' | 'error' | 'success'

export interface OutreachRow {
  id: number
  subject_type: SubjectType
  subject_id: string
  channel: 'email' | 'sms' | 'voice'
  contact_id: string | null
  recipient: string
  subject: string | null
  body_text: string
  sent_at_demo_clock: string
  intercepted: number
}

export interface ReplyRow {
  id: number
  subject_type: SubjectType
  subject_id: string
  channel: 'email' | 'sms' | 'voice-keypress'
  contact_id: string | null
  from_address: string
  raw_text: string
  classification: string | null
  parsed_date: string | null
  parsed_amount_usd: number | null
  llm_confidence: number | null
  received_at_demo_clock: string
}

export interface LogRow {
  id: number
  ts_demo_clock: string
  level: LogLevel
  line: string
}

export interface TransitionRow {
  id: number
  from_state: string | null
  to_state: string
  reason: string | null
  at_demo_clock: string
}

/** Everything that has ever happened to one subject, in insertion order. */
export interface Thread {
  outreach: OutreachRow[]
  replies: ReplyRow[]
  logs: LogRow[]
  transitions: TransitionRow[]
}

export function getThread(s: Subject): Thread {
  return {
    outreach: db
      .prepare(
        `SELECT * FROM outreach_attempts
          WHERE subject_type = ? AND subject_id = ?
          ORDER BY sent_at_demo_clock ASC, id ASC`,
      )
      .all(s.type, s.id) as OutreachRow[],
    replies: db
      .prepare(
        `SELECT * FROM inbound_replies
          WHERE subject_type = ? AND subject_id = ?
          ORDER BY received_at_demo_clock ASC, id ASC`,
      )
      .all(s.type, s.id) as ReplyRow[],
    logs: db
      .prepare(
        `SELECT id, ts_demo_clock, level, line FROM agent_logs
          WHERE subject_type = ? AND subject_id = ?
          ORDER BY id ASC`,
      )
      .all(s.type, s.id) as LogRow[],
    transitions: db
      .prepare(
        `SELECT id, from_state, to_state, reason, at_demo_clock FROM state_transitions
          WHERE subject_type = ? AND subject_id = ?
          ORDER BY id ASC`,
      )
      .all(s.type, s.id) as TransitionRow[],
  }
}

export function logLine(s: Subject, level: LogLevel, line: string, tsDemoClock: string) {
  db.prepare(
    `INSERT INTO agent_logs (subject_type, subject_id, ts_demo_clock, level, line)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(s.type, s.id, tsDemoClock, level, line)
}

export function logsSince(s: Subject, sinceId: number): LogRow[] {
  return db
    .prepare(
      `SELECT id, ts_demo_clock, level, line FROM agent_logs
        WHERE subject_type = ? AND subject_id = ? AND id > ?
        ORDER BY id ASC LIMIT 500`,
    )
    .all(s.type, s.id, sinceId) as LogRow[]
}

export interface OutreachInput {
  channel: 'email' | 'sms' | 'voice'
  contactId?: string | null
  recipient: string
  subject?: string | null
  body: string
  sentAt: string
}

export function recordOutreach(s: Subject, o: OutreachInput) {
  db.prepare(
    `INSERT INTO outreach_attempts
       (subject_type, subject_id, channel, contact_id, recipient, subject, body_text, sent_at_demo_clock, intercepted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
  ).run(s.type, s.id, o.channel, o.contactId ?? null, o.recipient, o.subject ?? null, o.body, o.sentAt)
}

export interface ReplyInput {
  channel: 'email' | 'sms' | 'voice-keypress'
  contactId?: string | null
  fromAddress: string
  rawText: string
  classification?: string | null
  parsedDate?: string | null
  parsedAmountUsd?: number | null
  confidence?: number | null
  receivedAt: string
}

export function recordReply(s: Subject, r: ReplyInput) {
  db.prepare(
    `INSERT INTO inbound_replies
       (subject_type, subject_id, channel, contact_id, from_address, raw_text,
        classification, parsed_date, parsed_amount_usd, llm_confidence, received_at_demo_clock)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    s.type,
    s.id,
    r.channel,
    r.contactId ?? null,
    r.fromAddress,
    r.rawText,
    r.classification ?? null,
    r.parsedDate ?? null,
    r.parsedAmountUsd ?? null,
    r.confidence ?? null,
    r.receivedAt,
  )
}

/** Which table holds the state column, per track. */
const STATE_TABLE: Record<SubjectType, string> = {
  visit: 'recurring_service_events',
  approval: 'approval_requests',
  compliance: 'vendor_documents',
}

export function currentState(s: Subject): string | null {
  const row = db
    .prepare(`SELECT state FROM ${STATE_TABLE[s.type]} WHERE id = ?`)
    .get(s.id) as { state: string } | undefined
  return row?.state ?? null
}

/**
 * Move a subject to a new state and record why. Writing the transition and
 * updating the row happen together so the audit trail can never disagree with
 * the current state.
 */
export function recordTransition(
  s: Subject,
  toState: string,
  reason: string,
  atDemoClock: string,
) {
  const from = currentState(s)
  if (from === null) throw new Error(`unknown ${s.type}: ${s.id}`)
  const tx = db.transaction(() => {
    db.prepare(`UPDATE ${STATE_TABLE[s.type]} SET state = ? WHERE id = ?`).run(toState, s.id)
    db.prepare(
      `INSERT INTO state_transitions (subject_type, subject_id, from_state, to_state, reason, at_demo_clock)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).run(s.type, s.id, from, toState, reason, atDemoClock)
  })
  tx()
}

/** Subject ids of one type that changed state at exactly this clock value. */
export function transitionedAt(type: SubjectType, atDemoClock: string): string[] {
  return (
    db
      .prepare(
        `SELECT DISTINCT subject_id FROM state_transitions
          WHERE subject_type = ? AND at_demo_clock = ?`,
      )
      .all(type, atDemoClock) as Array<{ subject_id: string }>
  ).map((r) => r.subject_id)
}

/**
 * When anything last happened on a subject. Used by the aging clock to spot
 * jobs that have gone quiet, which is the failure mode coordinators describe
 * as work orders "falling through the cracks".
 */
export function lastActivityAt(s: Subject): string | null {
  const row = db
    .prepare(
      `SELECT MAX(ts) AS ts FROM (
         SELECT MAX(received_at_demo_clock) AS ts FROM inbound_replies WHERE subject_type = ? AND subject_id = ?
         UNION ALL
         SELECT MAX(sent_at_demo_clock) FROM outreach_attempts WHERE subject_type = ? AND subject_id = ?
         UNION ALL
         SELECT MAX(at_demo_clock) FROM state_transitions WHERE subject_type = ? AND subject_id = ?
       )`,
    )
    .get(s.type, s.id, s.type, s.id, s.type, s.id) as { ts: string | null }
  return row?.ts ?? null
}
