/**
 * One list across all three tracks.
 *
 * A coordinator does not think in tracks. They arrive in the morning wanting
 * to know what is on fire, what is waiting on them, and what has gone quiet.
 * The three queues answer "what is happening in this area"; this answers
 * "what should I do first", which is the question actually being asked.
 *
 * The aging clock lives here too. Pain number four on the practitioner's list
 * was invisible aging work orders: no escalation, and delays discovered only
 * when the tenant rang back angry. So anything open that has not moved is
 * surfaced on its own, regardless of which track it belongs to.
 */

import { STATE_META, type AgentState } from '../agent/state_machine.js'
import { APPROVAL_META, URGENCY_META, type Urgency } from '../agent/approval_state.js'
import { COMPLIANCE_META, DOC_TYPE_LABELS, daysUntil } from '../agent/compliance_state.js'
import { listApprovals, type ApprovalQueueRow, isCappedBelowQuote } from './approvals.js'
import { listCompliance, type ComplianceRow } from './compliance.js'
import { listJobs, type JobQueueRow } from './queries_inbox.js'
import type { SubjectType } from './threads.js'

export type WorkLane = 'needs-you' | 'gone-quiet' | 'waiting' | 'settled'

export interface WorkItem {
  track: SubjectType
  id: string
  href: string
  title: string
  subtitle: string
  stateLabel: string
  lane: WorkLane
  ctaLabel: string | null
  valueUsd: number | null
  urgency: Urgency | null
  lastActivityIso: string | null
  /** Days since anything at all happened on this item. */
  agingDays: number
  /** The single line explaining why this one deserves attention now. */
  riskNote: string | null
}

/**
 * How long an open item may sit untouched before it counts as having gone
 * quiet. Money waiting on a decision gets the shortest leash; a certificate
 * that is months from expiring gets the longest.
 */
const QUIET_AFTER_DAYS: Record<SubjectType, number> = {
  approval: 2,
  visit: 3,
  compliance: 7,
}

const TRACK_LABELS: Record<SubjectType, string> = {
  visit: 'Visit',
  approval: 'Approval',
  compliance: 'Compliance',
}

export const trackLabel = (t: SubjectType) => TRACK_LABELS[t]

function ageDays(lastIso: string | null, nowIso: string): number {
  if (!lastIso) return 0
  return Math.max(0, (new Date(nowIso).getTime() - new Date(lastIso).getTime()) / 86_400_000)
}

function visitItem(j: JobQueueRow, nowIso: string): WorkItem {
  const meta = STATE_META[j.state as AgentState]
  const aging = ageDays(j.last_activity_iso, nowIso)
  const isOpen = !meta.isTerminal
  const quiet = isOpen && aging > QUIET_AFTER_DAYS.visit && meta.lane !== 'queue-awaiting'

  let lane: WorkLane = 'waiting'
  if (meta.lane === 'queue-closed') lane = 'settled'
  else if (meta.lane === 'queue-awaiting' || meta.lane === 'queue-escalated') lane = 'needs-you'
  if (quiet) lane = 'gone-quiet'

  return {
    track: 'visit',
    id: j.rse_id,
    href: `/inbox/${j.rse_id}`,
    title: j.customer_name,
    subtitle: `${j.recurring_service_name} · due ${j.due_date}`,
    stateLabel: meta.shortLabel,
    lane,
    ctaLabel: meta.cta?.label ?? null,
    valueUsd: null,
    urgency: null,
    lastActivityIso: j.last_activity_iso,
    agingDays: aging,
    riskNote: quiet
      ? `No movement for ${aging.toFixed(0)} days. Visits that go quiet turn into an angry call.`
      : null,
  }
}

function approvalItem(a: ApprovalQueueRow, nowIso: string): WorkItem {
  const meta = APPROVAL_META[a.state]
  const aging = ageDays(a.last_activity_iso, nowIso)
  const isOpen = !meta.isTerminal && a.state !== 'AutoApproved'
  const quiet = isOpen && meta.lane === 'waiting-owner' && aging > QUIET_AFTER_DAYS.approval

  let lane: WorkLane = 'waiting'
  if (meta.lane === 'settled') lane = 'settled'
  else if (meta.lane === 'needs-you' || meta.lane === 'overdue') lane = 'needs-you'
  if (quiet) lane = 'gone-quiet'
  // An open emergency belongs in front of a person whatever the agent is
  // currently doing about it. Waiting politely on a reply is not good enough
  // when four units have no power.
  if (isOpen && a.urgency === 'emergency') lane = 'needs-you'

  let risk: string | null = null
  if (isCappedBelowQuote(a)) {
    risk = `Approved at $${(a.approved_amount_usd ?? 0).toLocaleString()} against a $${a.quote_usd.toLocaleString()} quote. Do not book it as it stands.`
  } else if (a.urgency === 'emergency' && isOpen && !a.decided_at_iso) {
    risk = a.respond_by_iso
      ? `Emergency, no answer yet. Response needed by ${new Date(a.respond_by_iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' })}. Worth a call rather than another message.`
      : 'Emergency with no answer yet. Worth a call rather than another message.'
  } else if (a.respond_by_iso && !a.decided_at_iso) {
    const overdue = new Date(a.respond_by_iso).getTime() < new Date(nowIso).getTime()
    risk = overdue
      ? 'The response deadline on this one has already passed.'
      : `Response needed by ${new Date(a.respond_by_iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'UTC' })}.`
  } else if (quiet) {
    risk = `${a.owner_name} has not answered in ${aging.toFixed(0)} days.`
  }

  return {
    track: 'approval',
    id: a.id,
    href: `/approvals/${a.id}`,
    title: a.summary,
    subtitle: `${a.property_name} · ${a.owner_name}`,
    stateLabel: meta.shortLabel,
    lane,
    ctaLabel: meta.cta?.label ?? null,
    valueUsd: a.quote_usd,
    urgency: a.urgency,
    lastActivityIso: a.last_activity_iso,
    agingDays: aging,
    riskNote: risk,
  }
}

function complianceItem(d: ComplianceRow, nowIso: string): WorkItem {
  const meta = COMPLIANCE_META[d.state]
  const aging = ageDays(d.last_activity_iso, nowIso)
  const days = daysUntil(d.expires_on, nowIso)
  const isOpen = !meta.isTerminal
  const quiet = isOpen && meta.lane === 'chasing' && aging > QUIET_AFTER_DAYS.compliance

  let lane: WorkLane = 'waiting'
  if (meta.lane === 'current') lane = 'settled'
  else if (meta.lane === 'lapsed' || meta.lane === 'needs-you') lane = 'needs-you'
  if (quiet) lane = 'gone-quiet'

  let risk: string | null = null
  if (meta.blocksDispatch && d.open_job_count > 0) {
    risk = `Cover lapsed and this vendor is on ${d.open_job_count} live ${d.open_job_count === 1 ? 'job' : 'jobs'} worth $${d.open_job_value_usd.toLocaleString()}.`
  } else if (meta.blocksDispatch) {
    risk = 'Cover lapsed. This vendor cannot be dispatched.'
  } else if (quiet) {
    risk = `No response in ${aging.toFixed(0)} days, ${days} days before it expires.`
  }

  return {
    track: 'compliance',
    id: d.id,
    href: `/compliance/${d.id}`,
    title: d.vendor_name,
    subtitle: `${DOC_TYPE_LABELS[d.doc_type] ?? d.doc_type} · expires ${d.expires_on}`,
    stateLabel: meta.shortLabel,
    lane,
    ctaLabel: meta.cta?.label ?? null,
    valueUsd: meta.blocksDispatch && d.open_job_count > 0 ? d.open_job_value_usd : null,
    urgency: null,
    lastActivityIso: d.last_activity_iso,
    agingDays: aging,
    riskNote: risk,
  }
}

/** Rank: emergencies, then anything with a risk note, then oldest first. */
function severity(i: WorkItem): number {
  if (i.urgency === 'emergency') return 0
  if (i.riskNote) return 1
  if (i.urgency === 'urgent') return 2
  return 3
}

export function buildWorklist(nowIso: string): WorkItem[] {
  const items = [
    ...listJobs().map((j) => visitItem(j, nowIso)),
    ...listApprovals().map((a) => approvalItem(a, nowIso)),
    ...listCompliance().map((d) => complianceItem(d, nowIso)),
  ]
  return items.sort((a, b) => {
    const s = severity(a) - severity(b)
    if (s !== 0) return s
    return b.agingDays - a.agingDays
  })
}

export interface WorklistSummary {
  needsYou: number
  goneQuiet: number
  waiting: number
  dollarsHeldUp: number
  blockedVendors: number
  emergencies: number
}

export function summarise(items: WorkItem[]): WorklistSummary {
  const needsYou = items.filter((i) => i.lane === 'needs-you')
  return {
    needsYou: needsYou.length,
    goneQuiet: items.filter((i) => i.lane === 'gone-quiet').length,
    waiting: items.filter((i) => i.lane === 'waiting').length,
    dollarsHeldUp: items
      .filter((i) => i.track === 'approval' && i.lane !== 'settled')
      .reduce((s, i) => s + (i.valueUsd ?? 0), 0),
    blockedVendors: items.filter(
      (i) => i.track === 'compliance' && i.lane === 'needs-you' && i.stateLabel === 'Lapsed',
    ).length,
    emergencies: items.filter((i) => i.urgency === 'emergency').length,
  }
}

export { URGENCY_META }
