import { db } from './client.js'
import type { ApprovalState, Urgency } from '../agent/approval_state.js'
import { approval, getThread, type Thread } from './threads.js'

export interface ApprovalQueueRow {
  id: string
  state: ApprovalState
  summary: string
  trade: string | null
  quote_usd: number
  approved_amount_usd: number | null
  tenant_impact: string | null
  urgency: Urgency
  respond_by_iso: string | null
  raised_at_iso: string
  decided_at_iso: string | null
  property_name: string
  location_city: string | null
  location_state: string | null
  owner_id: string
  owner_name: string
  owner_limit_usd: number
  owner_typical_response_days: number | null
  outreach_count: number
  reply_count: number
  last_activity_iso: string | null
  latest_reply_text: string | null
  latest_reply_classification: string | null
  latest_reply_amount_usd: number | null
}

const QUEUE_SELECT = `
  SELECT
    a.id, a.state, a.summary, a.trade, a.quote_usd, a.approved_amount_usd,
    a.tenant_impact, a.urgency, a.respond_by_iso, a.raised_at_iso, a.decided_at_iso,
    c.name AS property_name,
    l.address_city AS location_city,
    l.address_state AS location_state,
    o.id AS owner_id,
    o.name AS owner_name,
    o.approval_limit_usd AS owner_limit_usd,
    o.typical_response_days AS owner_typical_response_days,
    (SELECT COUNT(*) FROM outreach_attempts oa
      WHERE oa.subject_type = 'approval' AND oa.subject_id = a.id) AS outreach_count,
    (SELECT COUNT(*) FROM inbound_replies ir
      WHERE ir.subject_type = 'approval' AND ir.subject_id = a.id) AS reply_count,
    (
      SELECT MAX(ts) FROM (
        SELECT MAX(received_at_demo_clock) AS ts FROM inbound_replies
          WHERE subject_type = 'approval' AND subject_id = a.id
        UNION ALL
        SELECT MAX(sent_at_demo_clock) FROM outreach_attempts
          WHERE subject_type = 'approval' AND subject_id = a.id
        UNION ALL
        SELECT MAX(at_demo_clock) FROM state_transitions
          WHERE subject_type = 'approval' AND subject_id = a.id
      )
    ) AS last_activity_iso,
    (SELECT raw_text FROM inbound_replies WHERE subject_type = 'approval' AND subject_id = a.id
      ORDER BY received_at_demo_clock DESC LIMIT 1) AS latest_reply_text,
    (SELECT classification FROM inbound_replies WHERE subject_type = 'approval' AND subject_id = a.id
      ORDER BY received_at_demo_clock DESC LIMIT 1) AS latest_reply_classification,
    (SELECT parsed_amount_usd FROM inbound_replies WHERE subject_type = 'approval' AND subject_id = a.id
      ORDER BY received_at_demo_clock DESC LIMIT 1) AS latest_reply_amount_usd
  FROM approval_requests a
  JOIN locations l ON l.id = a.location_id
  JOIN customers c ON c.id = l.customer_id
  JOIN owners o ON o.id = a.owner_id
`

export function listApprovals(): ApprovalQueueRow[] {
  return db
    .prepare(
      `${QUEUE_SELECT}
       ORDER BY
         CASE a.urgency WHEN 'emergency' THEN 0 WHEN 'urgent' THEN 1 ELSE 2 END,
         a.raised_at_iso ASC`,
    )
    .all() as ApprovalQueueRow[]
}

export interface OwnerRow {
  id: string
  name: string
  company: string | null
  email: string | null
  phone: string | null
  line_type: 'mobile' | 'landline' | 'voip' | null
  approval_limit_usd: number
  preferred_channel: 'email' | 'sms' | 'voice'
  typical_response_days: number | null
  notes: string | null
}

export interface ApprovalDetail {
  approval: ApprovalQueueRow & { detail: string | null; statute_note: string | null }
  owner: OwnerRow
  thread: Thread
}

export function getApprovalDetail(id: string): ApprovalDetail | null {
  const row = db
    .prepare(`${QUEUE_SELECT} WHERE a.id = ?`)
    .get(id) as ApprovalQueueRow | undefined
  if (!row) return null
  const extra = db
    .prepare(`SELECT detail, statute_note FROM approval_requests WHERE id = ?`)
    .get(id) as { detail: string | null; statute_note: string | null }
  const owner = db.prepare(`SELECT * FROM owners WHERE id = ?`).get(row.owner_id) as OwnerRow
  return {
    approval: { ...row, ...extra },
    owner,
    thread: getThread(approval(id)),
  }
}

export function listOwners(): OwnerRow[] {
  return db.prepare(`SELECT * FROM owners ORDER BY name ASC`).all() as OwnerRow[]
}

/**
 * Working days an owner has kept a decision waiting. Measured from when the
 * request was raised to when they answered, or to now if they still have not.
 * This is the number the whole track exists to shrink.
 */
export function daysWaiting(row: ApprovalQueueRow, nowIso: string): number {
  const start = new Date(row.raised_at_iso).getTime()
  const end = new Date(row.decided_at_iso ?? nowIso).getTime()
  return Math.max(0, (end - start) / (1000 * 60 * 60 * 24))
}

export interface ApprovalStats {
  openCount: number
  needsYouCount: number
  waitingOnOwnerCount: number
  dollarsHeldUp: number
  avgDaysToDecision: number | null
  autoApprovedCount: number
  autoApprovedDollars: number
  slowestOwner: { name: string; days: number } | null
}

/**
 * The numbers a coordinator would actually quote at a Monday meeting. Kept
 * here rather than in the view so the inbox and any summary agree.
 */
export function approvalStats(rows: ApprovalQueueRow[], nowIso: string): ApprovalStats {
  const open = rows.filter(
    (r) => !r.state.startsWith('Closed_') && r.state !== 'AutoApproved',
  )
  const needsYou = open.filter((r) => r.state.startsWith('NeedsYou_'))
  const waiting = open.filter((r) => r.state.startsWith('Awaiting_'))
  const auto = rows.filter((r) => r.state === 'AutoApproved')

  const decided = rows.filter((r) => r.decided_at_iso)
  const avg =
    decided.length > 0
      ? decided.reduce((sum, r) => sum + daysWaiting(r, nowIso), 0) / decided.length
      : null

  // Slowest owner by how long their still-open requests have been sitting.
  let slowest: { name: string; days: number } | null = null
  for (const r of open) {
    const d = daysWaiting(r, nowIso)
    if (!slowest || d > slowest.days) slowest = { name: r.owner_name, days: d }
  }

  return {
    openCount: open.length,
    needsYouCount: needsYou.length,
    waitingOnOwnerCount: waiting.length,
    dollarsHeldUp: open.reduce((sum, r) => sum + r.quote_usd, 0),
    avgDaysToDecision: avg,
    autoApprovedCount: auto.length,
    autoApprovedDollars: auto.reduce((sum, r) => sum + r.quote_usd, 0),
    slowestOwner: slowest,
  }
}

/**
 * True when the owner approved a figure below what was quoted. Dispatching on
 * one of these without noticing leaves the manager holding the difference.
 */
export function isCappedBelowQuote(r: ApprovalQueueRow): boolean {
  return (
    r.state === 'NeedsYou_Approved' &&
    r.approved_amount_usd !== null &&
    r.approved_amount_usd < r.quote_usd
  )
}

export function setApprovalState(id: string, state: ApprovalState) {
  db.prepare(`UPDATE approval_requests SET state = ? WHERE id = ?`).run(state, id)
}

export function recordDecision(id: string, decidedAtIso: string, amountUsd: number | null) {
  db.prepare(
    `UPDATE approval_requests SET decided_at_iso = ?, approved_amount_usd = ? WHERE id = ?`,
  ).run(decidedAtIso, amountUsd, id)
}
