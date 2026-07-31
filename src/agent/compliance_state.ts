/**
 * Vendor-compliance state machine.
 *
 * Certificates of insurance expire quietly. A coordinator managing twenty
 * vendors described losing hours every week chasing them, with the documents
 * scattered across shared drives and email. The failure it protects against is
 * simple and expensive: sending an uninsured contractor to a property, and
 * finding out only when something goes wrong there.
 *
 * The states are ordered by how much trouble you are in, not by what the agent
 * last did.
 */

export const COMPLIANCE_STATES = [
  // Plenty of time left. The agent is doing nothing.
  'Current',
  // Inside the chase window.
  'Chasing_30Day',
  'Chasing_14Day',
  'Chasing_7Day',
  // Something came back and a person has to look at it.
  'NeedsYou_DocReceived',
  // Past the expiry date. The vendor should not be dispatched.
  'Lapsed',
  // Done.
  'Closed_Renewed',
  'Closed_VendorRetired',
] as const

export type ComplianceState = (typeof COMPLIANCE_STATES)[number]

export type ComplianceLane = 'lapsed' | 'needs-you' | 'chasing' | 'current'

export interface ComplianceStateMeta {
  lane: ComplianceLane
  shortLabel: string
  longLabel: string
  cta: { label: string; class: 'btn-block' | 'btn-primary' | 'btn-ghost' } | null
  description: string
  /** True when this vendor must not be sent to a property. */
  blocksDispatch: boolean
  isTerminal: boolean
}

export const COMPLIANCE_META: Record<ComplianceState, ComplianceStateMeta> = {
  Current: {
    lane: 'current',
    shortLabel: 'Current',
    longLabel: 'Current',
    cta: null,
    description: 'In date, with more than 30 days to run. Nothing to do.',
    blocksDispatch: false,
    isTerminal: false,
  },
  Chasing_30Day: {
    lane: 'chasing',
    shortLabel: 'Renewal asked',
    longLabel: 'Renewal requested · 30 days out',
    cta: null,
    description: 'Expires within a month. The agent has asked for the renewal.',
    blocksDispatch: false,
    isTerminal: false,
  },
  Chasing_14Day: {
    lane: 'chasing',
    shortLabel: 'Reminded',
    longLabel: 'Renewal requested · reminded at 14 days',
    cta: null,
    description: 'Two weeks left and nothing back yet. Reminder sent.',
    blocksDispatch: false,
    isTerminal: false,
  },
  Chasing_7Day: {
    lane: 'chasing',
    shortLabel: 'Final notice',
    longLabel: 'Renewal requested · final notice at 7 days',
    cta: null,
    description:
      'A week left. The vendor has been told they come off the dispatch list if it lapses.',
    blocksDispatch: false,
    isTerminal: false,
  },
  NeedsYou_DocReceived: {
    lane: 'needs-you',
    shortLabel: 'Certificate in',
    longLabel: 'Certificate received · needs checking',
    cta: { label: 'Check and file it', class: 'btn-block' },
    description:
      'A document came back. Someone has to confirm the dates and the coverage before it counts.',
    blocksDispatch: false,
    isTerminal: false,
  },
  Lapsed: {
    lane: 'lapsed',
    shortLabel: 'Lapsed',
    longLabel: 'Lapsed · do not dispatch',
    cta: { label: 'Call the vendor', class: 'btn-primary' },
    description:
      'Expired. This vendor should not be sent to a property until it is renewed.',
    blocksDispatch: true,
    isTerminal: false,
  },
  Closed_Renewed: {
    lane: 'current',
    shortLabel: 'Renewed',
    longLabel: 'Renewed and filed',
    cta: null,
    description: 'New certificate received, checked and filed.',
    blocksDispatch: false,
    isTerminal: true,
  },
  Closed_VendorRetired: {
    lane: 'current',
    shortLabel: 'Vendor retired',
    longLabel: 'Closed · vendor no longer used',
    cta: null,
    description: 'No longer on the dispatch list, so the certificate stopped mattering.',
    blocksDispatch: false,
    isTerminal: true,
  },
}

export const COMPLIANCE_LANE_ORDER: ComplianceLane[] = [
  'lapsed',
  'needs-you',
  'chasing',
  'current',
]

export const COMPLIANCE_LANE_LABELS: Record<ComplianceLane, string> = {
  lapsed: 'Lapsed · do not dispatch',
  'needs-you': 'Waiting on you',
  chasing: 'Being chased',
  current: 'In date',
}

export const DOC_TYPE_LABELS: Record<string, string> = {
  general_liability: 'General liability',
  workers_comp: "Workers' compensation",
  auto: 'Commercial auto',
  license: 'Trade licence',
}

/** Days before expiry at which each escalation fires. */
export const COMPLIANCE_CADENCE = { first: 30, remind: 14, final: 7 } as const

export function daysUntil(expiresOn: string, nowIso: string): number {
  const end = new Date(`${expiresOn}T00:00:00.000Z`).getTime()
  const now = new Date(nowIso).getTime()
  return Math.floor((end - now) / (1000 * 60 * 60 * 24))
}

/**
 * What the state should be, purely from the expiry date. Used by the scheduler
 * when the clock moves; states that involve a human (a document arriving, a
 * vendor being retired) are never overwritten by this.
 */
export function stateFromExpiry(expiresOn: string, nowIso: string): ComplianceState {
  const d = daysUntil(expiresOn, nowIso)
  if (d < 0) return 'Lapsed'
  if (d <= COMPLIANCE_CADENCE.final) return 'Chasing_7Day'
  if (d <= COMPLIANCE_CADENCE.remind) return 'Chasing_14Day'
  if (d <= COMPLIANCE_CADENCE.first) return 'Chasing_30Day'
  return 'Current'
}
