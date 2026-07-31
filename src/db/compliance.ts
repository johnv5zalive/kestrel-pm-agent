import { db } from './client.js'
import { COMPLIANCE_META, daysUntil, type ComplianceState } from '../agent/compliance_state.js'
import { compliance, getThread, type Thread } from './threads.js'

export interface ComplianceRow {
  id: string
  vendor_id: string
  vendor_name: string
  trade: string
  contact_name: string | null
  vendor_email: string | null
  vendor_phone: string | null
  doc_type: string
  carrier: string | null
  policy_number: string | null
  coverage_usd: number | null
  expires_on: string
  state: ComplianceState
  received_at_iso: string | null
  notes: string | null
  outreach_count: number
  reply_count: number
  last_activity_iso: string | null
  /** Open approvals this vendor is quoted on. The reason a lapse matters today. */
  open_job_count: number
  open_job_value_usd: number
}

const SELECT = `
  SELECT
    d.id, d.vendor_id, d.doc_type, d.carrier, d.policy_number, d.coverage_usd,
    d.expires_on, d.state, d.received_at_iso, d.notes,
    v.name AS vendor_name, v.trade, v.contact_name,
    v.email AS vendor_email, v.phone AS vendor_phone,
    (SELECT COUNT(*) FROM outreach_attempts oa
      WHERE oa.subject_type = 'compliance' AND oa.subject_id = d.id) AS outreach_count,
    (SELECT COUNT(*) FROM inbound_replies ir
      WHERE ir.subject_type = 'compliance' AND ir.subject_id = d.id) AS reply_count,
    (
      SELECT MAX(ts) FROM (
        SELECT MAX(received_at_demo_clock) AS ts FROM inbound_replies
          WHERE subject_type = 'compliance' AND subject_id = d.id
        UNION ALL
        SELECT MAX(sent_at_demo_clock) FROM outreach_attempts
          WHERE subject_type = 'compliance' AND subject_id = d.id
        UNION ALL
        SELECT MAX(at_demo_clock) FROM state_transitions
          WHERE subject_type = 'compliance' AND subject_id = d.id
      )
    ) AS last_activity_iso,
    (SELECT COUNT(*) FROM approval_requests ar
      WHERE ar.vendor_id = d.vendor_id
        AND ar.state NOT LIKE 'Closed_%') AS open_job_count,
    (SELECT COALESCE(SUM(quote_usd), 0) FROM approval_requests ar
      WHERE ar.vendor_id = d.vendor_id
        AND ar.state NOT LIKE 'Closed_%') AS open_job_value_usd
  FROM vendor_documents d
  JOIN vendors v ON v.id = d.vendor_id
`

export function listCompliance(): ComplianceRow[] {
  return db.prepare(`${SELECT} ORDER BY d.expires_on ASC`).all() as ComplianceRow[]
}

export interface ComplianceDetail {
  doc: ComplianceRow
  thread: Thread
  /** The live jobs this vendor is on, so a block can be shown in context. */
  openJobs: Array<{ id: string; summary: string; quote_usd: number; state: string }>
}

export function getComplianceDetail(id: string): ComplianceDetail | null {
  const doc = db.prepare(`${SELECT} WHERE d.id = ?`).get(id) as ComplianceRow | undefined
  if (!doc) return null
  const openJobs = db
    .prepare(
      `SELECT id, summary, quote_usd, state FROM approval_requests
        WHERE vendor_id = ? AND state NOT LIKE 'Closed_%'
        ORDER BY quote_usd DESC`,
    )
    .all(doc.vendor_id) as ComplianceDetail['openJobs']
  return { doc, thread: getThread(compliance(id)), openJobs }
}

export interface ComplianceStats {
  lapsedCount: number
  /** Lapsed vendors who are on live work. The number that should worry someone. */
  lapsedWithOpenWork: number
  exposedDollars: number
  chasingCount: number
  needsYouCount: number
  currentCount: number
  nextExpiryDays: number | null
}

export function complianceStats(rows: ComplianceRow[], nowIso: string): ComplianceStats {
  const live = rows.filter((r) => !COMPLIANCE_META[r.state].isTerminal)
  const lapsed = live.filter((r) => COMPLIANCE_META[r.state].blocksDispatch)
  const lapsedWithWork = lapsed.filter((r) => r.open_job_count > 0)
  const chasing = live.filter((r) => COMPLIANCE_META[r.state].lane === 'chasing')
  const needsYou = live.filter((r) => COMPLIANCE_META[r.state].lane === 'needs-you')
  const current = live.filter((r) => COMPLIANCE_META[r.state].lane === 'current')

  const upcoming = live
    .filter((r) => daysUntil(r.expires_on, nowIso) >= 0)
    .map((r) => daysUntil(r.expires_on, nowIso))
    .sort((a, b) => a - b)

  return {
    lapsedCount: lapsed.length,
    lapsedWithOpenWork: lapsedWithWork.length,
    exposedDollars: lapsedWithWork.reduce((s, r) => s + r.open_job_value_usd, 0),
    chasingCount: chasing.length,
    needsYouCount: needsYou.length,
    currentCount: current.length,
    nextExpiryDays: upcoming.length > 0 ? upcoming[0] : null,
  }
}

/** Vendor ids that must not be dispatched right now. */
export function blockedVendorIds(): Set<string> {
  const rows = db
    .prepare(`SELECT DISTINCT vendor_id FROM vendor_documents WHERE state = 'Lapsed'`)
    .all() as Array<{ vendor_id: string }>
  return new Set(rows.map((r) => r.vendor_id))
}
