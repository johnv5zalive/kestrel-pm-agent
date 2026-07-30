/**
 * Agent state machine — designed before any view code per sagan-engineering-patterns §3.
 *
 * Every pause-point in the user's mental model gets a distinct state. The PRD names 5
 * lifecycle states (Upcoming → In-Progress → Awaiting Human → Escalated → Closed); we
 * expand each pause-point into its own state so views never collapse two genuinely
 * different moments into one badge.
 *
 * Inbound classifications are pinned to the four PRD names exactly:
 *   proposed-date | question | opt-out | irrelevant
 */

export const AGENT_STATES = [
  'Upcoming',
  'InProgress_EmailT10_Sent',
  'InProgress_EmailT5_Sent',
  'InProgress_SmsT5_Sent',
  'InProgress_VoiceT0_Attempted',
  'AwaitingHuman_DateProposed',
  'AwaitingHuman_AmbiguousReply',
  'AwaitingHuman_Question',
  'Escalated',
  'Closed_Booked',
  'Closed_OptedOut',
  'Closed_BookedOutsideAgent',
  'Skipped_PreSendCheckCancelled',
] as const

export type AgentState = (typeof AGENT_STATES)[number]

export const INBOUND_CLASSIFICATIONS = [
  'proposed-date',
  'question',
  'opt-out',
  'irrelevant',
] as const
export type InboundClassification = (typeof INBOUND_CLASSIFICATIONS)[number]

export type StateLane =
  | 'queue-upcoming'
  | 'queue-in-progress'
  | 'queue-awaiting'
  | 'queue-escalated'
  | 'queue-closed'

export type CtaClass = 'btn-block' | 'btn-primary' | 'btn-ghost' | null

export interface StateMeta {
  lane: StateLane
  shortLabel: string
  longLabel: string
  badgeColor: 'upcoming' | 'progress' | 'awaiting' | 'escalated' | 'closed'
  cta: { label: string; class: CtaClass } | null
  description: string
  isTerminal: boolean
  adapter1Only: boolean
}

export const STATE_META: Record<AgentState, StateMeta> = {
  Upcoming: {
    lane: 'queue-upcoming',
    shortLabel: 'Upcoming',
    longLabel: 'Upcoming · sequence not started',
    badgeColor: 'upcoming',
    cta: null,
    description: 'Ingested from AppFolio. Outreach starts at T-10 days.',
    isTerminal: false,
    adapter1Only: false,
  },
  InProgress_EmailT10_Sent: {
    lane: 'queue-in-progress',
    shortLabel: 'Email T-10 sent',
    longLabel: 'In progress · first email sent',
    badgeColor: 'progress',
    cta: null,
    description: 'First outreach email sent. Awaiting reply.',
    isTerminal: false,
    adapter1Only: false,
  },
  InProgress_EmailT5_Sent: {
    lane: 'queue-in-progress',
    shortLabel: 'Email T-5 sent',
    longLabel: 'In progress · second email sent',
    badgeColor: 'progress',
    cta: null,
    description: 'Second outreach email sent. Awaiting reply.',
    isTerminal: false,
    adapter1Only: false,
  },
  InProgress_SmsT5_Sent: {
    lane: 'queue-in-progress',
    shortLabel: 'SMS T-5 sent',
    longLabel: 'In progress · SMS sent',
    badgeColor: 'progress',
    cta: null,
    description: 'T-5 SMS sent (active when 10DLC clears). Awaiting reply.',
    isTerminal: false,
    adapter1Only: false,
  },
  InProgress_VoiceT0_Attempted: {
    lane: 'queue-in-progress',
    shortLabel: 'Voice IVR attempted',
    longLabel: 'In progress · voice IVR fallback',
    badgeColor: 'progress',
    cta: null,
    description: 'Landline-only contact — short voice IVR attempted at month start.',
    isTerminal: false,
    adapter1Only: false,
  },
  AwaitingHuman_DateProposed: {
    lane: 'queue-awaiting',
    shortLabel: 'Date proposed',
    longLabel: 'Awaiting human · date proposed',
    badgeColor: 'awaiting',
    cta: { label: 'Confirm to mark booked', class: 'btn-block' },
    description: 'Customer proposed a date. Confirm to mark booked.',
    isTerminal: false,
    adapter1Only: false,
  },
  AwaitingHuman_AmbiguousReply: {
    lane: 'queue-awaiting',
    shortLabel: 'Ambiguous reply',
    longLabel: 'Awaiting human · reply needs clarification',
    badgeColor: 'awaiting',
    cta: { label: 'Open & reply', class: 'btn-block' },
    description: 'Customer replied but the date intent is unclear.',
    isTerminal: false,
    adapter1Only: false,
  },
  AwaitingHuman_Question: {
    lane: 'queue-awaiting',
    shortLabel: 'Question',
    longLabel: 'Awaiting human · customer asked a question',
    badgeColor: 'awaiting',
    cta: { label: 'Open & reply', class: 'btn-block' },
    description: 'Customer asked a question. FAQ in-thread is Phase 2 — answer manually.',
    isTerminal: false,
    adapter1Only: false,
  },
  Escalated: {
    lane: 'queue-escalated',
    shortLabel: 'Escalated',
    longLabel: 'Escalated · all channels exhausted',
    badgeColor: 'escalated',
    cta: { label: 'Call manually', class: 'btn-primary' },
    description: 'No reply through any async channel. Coordinator phone follow-up needed.',
    isTerminal: false,
    adapter1Only: false,
  },
  Closed_Booked: {
    lane: 'queue-closed',
    shortLabel: 'Booked',
    longLabel: 'Closed · booked',
    badgeColor: 'closed',
    cta: null,
    description: 'Coordinator booked the job in AppFolio.',
    isTerminal: true,
    adapter1Only: false,
  },
  Closed_OptedOut: {
    lane: 'queue-closed',
    shortLabel: 'Opted out',
    longLabel: 'Closed · opted out',
    badgeColor: 'closed',
    cta: null,
    description: 'Customer opted out of PM outreach.',
    isTerminal: true,
    adapter1Only: false,
  },
  Closed_BookedOutsideAgent: {
    lane: 'queue-closed',
    shortLabel: 'Booked outside agent',
    longLabel: 'Closed · booked outside agent',
    badgeColor: 'closed',
    cta: null,
    description: 'Pre-send check found the job already booked in AppFolio.',
    isTerminal: true,
    adapter1Only: true,
  },
  Skipped_PreSendCheckCancelled: {
    lane: 'queue-closed',
    shortLabel: 'Send cancelled',
    longLabel: 'Skipped · pre-send check cancelled outreach',
    badgeColor: 'closed',
    cta: null,
    description: 'Pre-send check found the job already completed in AppFolio.',
    isTerminal: true,
    adapter1Only: true,
  },
}

export const STATE_LANE_ORDER: StateLane[] = [
  'queue-awaiting',
  'queue-in-progress',
  'queue-upcoming',
  'queue-escalated',
  'queue-closed',
]

export const STATE_LANE_LABELS: Record<StateLane, string> = {
  'queue-awaiting': 'Awaiting Human',
  'queue-in-progress': 'In Progress',
  'queue-upcoming': 'Upcoming',
  'queue-escalated': 'Escalated',
  'queue-closed': 'Closed',
}

/**
 * Allowed transitions. Used for validation when an agent run advances state
 * and to render the state-machine doc page in admin.
 */
export const ALLOWED_TRANSITIONS: Record<AgentState, AgentState[]> = {
  Upcoming: [
    'InProgress_EmailT10_Sent',
    'Skipped_PreSendCheckCancelled',
  ],
  InProgress_EmailT10_Sent: [
    'InProgress_EmailT5_Sent',
    'InProgress_SmsT5_Sent',
    'InProgress_VoiceT0_Attempted',
    'AwaitingHuman_DateProposed',
    'AwaitingHuman_AmbiguousReply',
    'AwaitingHuman_Question',
    'Closed_OptedOut',
    'Closed_BookedOutsideAgent',
    'Skipped_PreSendCheckCancelled',
  ],
  InProgress_EmailT5_Sent: [
    'InProgress_SmsT5_Sent',
    'InProgress_VoiceT0_Attempted',
    'AwaitingHuman_DateProposed',
    'AwaitingHuman_AmbiguousReply',
    'AwaitingHuman_Question',
    'Escalated',
    'Closed_OptedOut',
    'Closed_BookedOutsideAgent',
    'Skipped_PreSendCheckCancelled',
  ],
  InProgress_SmsT5_Sent: [
    'InProgress_VoiceT0_Attempted',
    'AwaitingHuman_DateProposed',
    'AwaitingHuman_AmbiguousReply',
    'AwaitingHuman_Question',
    'Escalated',
    'Closed_OptedOut',
    'Closed_BookedOutsideAgent',
    'Skipped_PreSendCheckCancelled',
  ],
  InProgress_VoiceT0_Attempted: [
    'AwaitingHuman_DateProposed',
    'AwaitingHuman_AmbiguousReply',
    'Escalated',
    'Closed_OptedOut',
    'Closed_BookedOutsideAgent',
  ],
  AwaitingHuman_DateProposed: ['Closed_Booked', 'Closed_OptedOut'],
  AwaitingHuman_AmbiguousReply: [
    'AwaitingHuman_DateProposed',
    'Closed_Booked',
    'Closed_OptedOut',
  ],
  AwaitingHuman_Question: [
    'AwaitingHuman_DateProposed',
    'Closed_Booked',
    'Closed_OptedOut',
  ],
  Escalated: ['Closed_Booked', 'Closed_OptedOut'],
  Closed_Booked: [],
  Closed_OptedOut: [],
  Closed_BookedOutsideAgent: [],
  Skipped_PreSendCheckCancelled: [],
}

export function isValidTransition(from: AgentState, to: AgentState): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to)
}
