import { db } from './client.js'
import type { AgentState, InboundClassification } from '../agent/state_machine.js'

export interface JobQueueRow {
  rse_id: string
  state: AgentState
  due_date: string
  customer_name: string
  location_name: string
  location_city: string
  location_state: string
  cadence: string
  recurring_service_name: string
  appfolio_status: string
  equipment_count: number
  contact_count: number
  outreach_count: number
  reply_count: number
  last_activity_iso: string | null
  latest_reply_text: string | null
  latest_reply_classification: InboundClassification | null
  latest_reply_parsed_date: string | null
}

export function listJobs(): JobQueueRow[] {
  return db
    .prepare(
      `
    SELECT
      r.id AS rse_id,
      r.state AS state,
      r.due_date AS due_date,
      r.appfolio_status AS appfolio_status,
      c.name AS customer_name,
      l.name AS location_name,
      l.address_city AS location_city,
      l.address_state AS location_state,
      rs.cadence AS cadence,
      rs.name AS recurring_service_name,
      (SELECT COUNT(*) FROM equipment e WHERE e.location_id = l.id) AS equipment_count,
      (SELECT COUNT(*) FROM contacts cn WHERE cn.location_id = l.id) AS contact_count,
      (SELECT COUNT(*) FROM outreach_attempts oa WHERE oa.rse_id = r.id) AS outreach_count,
      (SELECT COUNT(*) FROM inbound_replies ir WHERE ir.rse_id = r.id) AS reply_count,
      (
        SELECT MAX(ts) FROM (
          SELECT MAX(received_at_demo_clock) AS ts FROM inbound_replies WHERE rse_id = r.id
          UNION ALL
          SELECT MAX(sent_at_demo_clock) AS ts FROM outreach_attempts WHERE rse_id = r.id
          UNION ALL
          SELECT MAX(at_demo_clock) AS ts FROM state_transitions WHERE rse_id = r.id
        )
      ) AS last_activity_iso,
      (
        SELECT raw_text FROM inbound_replies WHERE rse_id = r.id ORDER BY received_at_demo_clock DESC LIMIT 1
      ) AS latest_reply_text,
      (
        SELECT classification FROM inbound_replies WHERE rse_id = r.id ORDER BY received_at_demo_clock DESC LIMIT 1
      ) AS latest_reply_classification,
      (
        SELECT parsed_date FROM inbound_replies WHERE rse_id = r.id ORDER BY received_at_demo_clock DESC LIMIT 1
      ) AS latest_reply_parsed_date
    FROM recurring_service_events r
    JOIN recurring_services rs ON rs.id = r.recurring_service_id
    JOIN locations l ON l.id = rs.location_id
    JOIN customers c ON c.id = l.customer_id
    ORDER BY r.due_date ASC
  `,
    )
    .all() as JobQueueRow[]
}

export interface JobDetail {
  rse: {
    id: string
    recurring_service_id: string
    state: AgentState
    due_date: string
    appfolio_status: string
    booking_availability: string
    ingested_at_iso: string
    ingested_via_adapter: string
  }
  recurring_service: {
    id: string
    name: string
    cadence: string
    job_summary: string | null
    membership_status: string
  }
  customer: {
    id: string
    name: string
    primary_phone: string | null
    primary_email: string | null
  }
  location: {
    id: string
    name: string
    primary_phone: string | null
    primary_email: string | null
    address_street: string | null
    address_city: string | null
    address_state: string | null
    address_zip: string | null
    service_zone: string | null
    business_unit: string | null
  }
  contacts: Array<{
    id: string
    name: string
    role: string | null
    role_rank: number
    phone: string | null
    email: string | null
    line_type: 'mobile' | 'landline' | 'voip' | null
    is_primary: number
    do_not_text: number
    do_not_email: number
    do_not_call: number
  }>
  equipment: Array<{
    id: string
    item_name: string
    item_description: string | null
  }>
  outreach: Array<{
    id: number
    channel: 'email' | 'sms' | 'voice'
    contact_id: string | null
    recipient: string
    subject: string | null
    body_text: string
    sent_at_demo_clock: string
    intercepted: number
  }>
  replies: Array<{
    id: number
    channel: 'email' | 'sms' | 'voice-keypress'
    contact_id: string | null
    from_address: string
    raw_text: string
    classification: InboundClassification | null
    parsed_date: string | null
    llm_confidence: number | null
    received_at_demo_clock: string
  }>
  logs: Array<{
    id: number
    ts_demo_clock: string
    level: 'info' | 'warn' | 'error' | 'success'
    line: string
  }>
  transitions: Array<{
    id: number
    from_state: AgentState | null
    to_state: AgentState
    reason: string | null
    at_demo_clock: string
  }>
}

export function getJobDetail(rseId: string): JobDetail | null {
  const rse = db
    .prepare(`SELECT * FROM recurring_service_events WHERE id = ?`)
    .get(rseId) as JobDetail['rse'] | undefined
  if (!rse) return null
  const rsRow = db
    .prepare(`SELECT * FROM recurring_services WHERE id = ?`)
    .get(rse.recurring_service_id) as (JobDetail['recurring_service'] & { location_id: string }) | undefined
  if (!rsRow) return null
  const { location_id, ...recurring_service } = rsRow
  const locRow = db
    .prepare(`SELECT * FROM locations WHERE id = ?`)
    .get(location_id) as (JobDetail['location'] & { customer_id: string }) | undefined
  if (!locRow) return null
  const { customer_id, ...location } = locRow
  const customer = db
    .prepare(`SELECT * FROM customers WHERE id = ?`)
    .get(customer_id) as JobDetail['customer']
  const contacts = db
    .prepare(
      `SELECT * FROM contacts WHERE location_id = ? ORDER BY is_primary DESC, role_rank ASC`,
    )
    .all(location_id) as JobDetail['contacts']
  const equipment = db
    .prepare(`SELECT * FROM equipment WHERE location_id = ? ORDER BY id ASC`)
    .all(location_id) as JobDetail['equipment']
  const outreach = db
    .prepare(
      `SELECT * FROM outreach_attempts WHERE rse_id = ? ORDER BY sent_at_demo_clock ASC`,
    )
    .all(rseId) as JobDetail['outreach']
  const replies = db
    .prepare(
      `SELECT * FROM inbound_replies WHERE rse_id = ? ORDER BY received_at_demo_clock ASC`,
    )
    .all(rseId) as JobDetail['replies']
  const logs = db
    .prepare(
      `SELECT id, ts_demo_clock, level, line FROM agent_logs WHERE rse_id = ? ORDER BY id ASC`,
    )
    .all(rseId) as JobDetail['logs']
  const transitions = db
    .prepare(
      `SELECT id, from_state, to_state, reason, at_demo_clock FROM state_transitions WHERE rse_id = ? ORDER BY id ASC`,
    )
    .all(rseId) as JobDetail['transitions']
  return {
    rse,
    recurring_service,
    customer,
    location,
    contacts,
    equipment,
    outreach,
    replies,
    logs,
    transitions,
  }
}

export function getLogsSince(rseId: string, sinceId: number) {
  return db
    .prepare(
      `SELECT id, ts_demo_clock, level, line FROM agent_logs WHERE rse_id = ? AND id > ? ORDER BY id ASC LIMIT 500`,
    )
    .all(rseId, sinceId) as Array<{
    id: number
    ts_demo_clock: string
    level: 'info' | 'warn' | 'error' | 'success'
    line: string
  }>
}

export function appendLog(
  rseId: string,
  level: 'info' | 'warn' | 'error' | 'success',
  line: string,
  tsDemoClock: string,
) {
  db.prepare(
    `INSERT INTO agent_logs (rse_id, ts_demo_clock, level, line) VALUES (?, ?, ?, ?)`,
  ).run(rseId, tsDemoClock, level, line)
}

/** RSE IDs that transitioned at exactly this clock (the most recent tick). */
export function listRsesTransitionedAt(atDemoClock: string): string[] {
  return (
    db
      .prepare(
        `SELECT DISTINCT rse_id FROM state_transitions WHERE at_demo_clock = ?`,
      )
      .all(atDemoClock) as Array<{ rse_id: string }>
  ).map((r) => r.rse_id)
}

export function transition(
  rseId: string,
  toState: AgentState,
  reason: string,
  atDemoClock: string,
) {
  const cur = db
    .prepare(`SELECT state FROM recurring_service_events WHERE id = ?`)
    .get(rseId) as { state: AgentState } | undefined
  if (!cur) throw new Error(`unknown rse: ${rseId}`)
  db.prepare(`UPDATE recurring_service_events SET state = ? WHERE id = ?`).run(toState, rseId)
  db.prepare(
    `INSERT INTO state_transitions (rse_id, from_state, to_state, reason, at_demo_clock) VALUES (?, ?, ?, ?, ?)`,
  ).run(rseId, cur.state, toState, reason, atDemoClock)
}
