import { db } from './client.js'
import type { AgentState } from '../agent/state_machine.js'

export interface RseRow {
  id: string
  recurring_service_id: string
  due_date: string
  state: AgentState
  ingested_at_iso: string
  ingested_via_adapter: string
  raw_xlsx_row: string | null
  appfolio_status: string
  booking_availability: string
  notes: string | null
}

export interface CustomerRow {
  id: string
  name: string
  primary_phone: string | null
  primary_email: string | null
  address_street: string | null
  address_city: string | null
  address_state: string | null
  address_zip: string | null
  notes: string | null
}

export interface LocationRow {
  id: string
  customer_id: string
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

export interface ContactRow {
  id: string
  location_id: string
  name: string
  role: string | null
  role_rank: number
  phone: string | null
  email: string | null
  line_type: 'mobile' | 'landline' | 'voip' | null
  do_not_text: number
  do_not_email: number
  do_not_call: number
  is_primary: number
}

export interface EquipmentRow {
  id: string
  location_id: string
  item_name: string
  item_description: string | null
  notes: string | null
}

export interface RecurringServiceRow {
  id: string
  location_id: string
  name: string
  cadence: 'annual' | 'biannual' | 'quarterly' | 'monthly'
  job_summary: string | null
  membership_status: string
}

export interface AgentLogRow {
  id: number
  run_id: number | null
  rse_id: string
  ts_demo_clock: string
  level: 'info' | 'warn' | 'error' | 'success'
  line: string
  meta: string | null
}

export function listRsesByState(): Array<{ state: AgentState; n: number }> {
  return db
    .prepare(
      `SELECT state, COUNT(*) as n FROM recurring_service_events GROUP BY state ORDER BY state`,
    )
    .all() as Array<{ state: AgentState; n: number }>
}

export function getAgentLogsSince(rseId: string, sinceId: number): AgentLogRow[] {
  return db
    .prepare(
      `SELECT * FROM agent_logs WHERE rse_id = ? AND id > ? ORDER BY id ASC LIMIT 500`,
    )
    .all(rseId, sinceId) as AgentLogRow[]
}

export function getRse(rseId: string): RseRow | undefined {
  return db
    .prepare(`SELECT * FROM recurring_service_events WHERE id = ?`)
    .get(rseId) as RseRow | undefined
}
