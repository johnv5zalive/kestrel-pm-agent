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
    longLabel: 'Upcoming · not started yet',
    badgeColor: 'upcoming',
    cta: null,
    description: 'Read in from AppFolio. First reminder goes out 10 days before the visit.',
    isTerminal: false,
    adapter1Only: false,
  },
  InProgress_EmailT10_Sent: {
    lane: 'queue-in-progress',
    shortLabel: 'First reminder sent',
    longLabel: 'In progress · first reminder sent',
    badgeColor: 'progress',
    cta: null,
    description: 'First reminder emailed. Waiting on a reply.',
    isTerminal: false,
    adapter1Only: false,
  },
  InProgress_EmailT5_Sent: {
    lane: 'queue-in-progress',
    shortLabel: 'Second reminder sent',
    longLabel: 'In progress · second reminder sent',
    badgeColor: 'progress',
    cta: null,
    description: 'Second reminder emailed. Waiting on a reply.',
    isTerminal: false,
    adapter1Only: false,
  },
  InProgress_SmsT5_Sent: {
    lane: 'queue-in-progress',
    shortLabel: 'Text sent',
    longLabel: 'In progress · follow-up text sent',
    badgeColor: 'progress',
    cta: null,
    description: 'Follow-up text sent. Waiting on a reply.',
    isTerminal: false,
    adapter1Only: false,
  },
  InProgress_VoiceT0_Attempted: {
    lane: 'queue-in-progress',
    shortLabel: 'Called',
    longLabel: 'In progress · automated call placed',
    badgeColor: 'progress',
    cta: null,
    description: 'No mobile on file, so the agent placed a short automated call instead.',
    isTerminal: false,
    adapter1Only: false,
  },
  AwaitingHuman_DateProposed: {
    lane: 'queue-awaiting',
    shortLabel: 'Date proposed',
    longLabel: 'Awaiting human · date proposed',
    badgeColor: 'awaiting',
    cta: { label: 'Confirm to mark booked', class: 'btn-block' },
    description: 'They came back with a date. Confirm it to mark the visit booked.',
    isTerminal: false,
    adapter1Only: false,
  },
  AwaitingHuman_AmbiguousReply: {
    lane: 'queue-awaiting',
    shortLabel: 'Ambiguous reply',
    longLabel: 'Awaiting human · reply needs clarification',
    badgeColor: 'awaiting',
    cta: { label: 'Open & reply', class: 'btn-block' },
    description: 'They replied, but not with a date the agent could act on.',
    isTerminal: false,
    adapter1Only: false,
  },
  AwaitingHuman_Question: {
    lane: 'queue-awaiting',
    shortLabel: 'Question',
    longLabel: 'Awaiting human · customer asked a question',
    badgeColor: 'awaiting',
    cta: { label: 'Open & reply', class: 'btn-block' },
    description: 'They asked a question. Answer it yourself for now.',
    isTerminal: false,
    adapter1Only: false,
  },
  Escalated: {
    lane: 'queue-escalated',
    shortLabel: 'Escalated',
    longLabel: 'Escalated · no reply on any channel',
    badgeColor: 'escalated',
    cta: { label: 'Call manually', class: 'btn-primary' },
    description: 'No reply by email, text or phone. Worth a call.',
    isTerminal: false,
    adapter1Only: false,
  },
  Closed_Booked: {
    lane: 'queue-closed',
    shortLabel: 'Booked',
    longLabel: 'Closed · booked',
    badgeColor: 'closed',
    cta: null,
    description: 'Booked in AppFolio.',
    isTerminal: true,
    adapter1Only: false,
  },
  Closed_OptedOut: {
    lane: 'queue-closed',
    shortLabel: 'Opted out',
    longLabel: 'Closed · opted out',
    badgeColor: 'closed',
    cta: null,
    description: 'They asked not to be contacted about this.',
    isTerminal: true,
    adapter1Only: false,
  },
  Closed_BookedOutsideAgent: {
    lane: 'queue-closed',
    shortLabel: 'Booked outside agent',
    longLabel: 'Closed · booked outside agent',
    badgeColor: 'closed',
    cta: null,
    description: 'Already booked in AppFolio, so the agent left it alone.',
    isTerminal: true,
    adapter1Only: true,
  },
  Skipped_PreSendCheckCancelled: {
    lane: 'queue-closed',
    shortLabel: 'Send cancelled',
    longLabel: 'Skipped · pre-send check cancelled outreach',
    badgeColor: 'closed',
    cta: null,
    description: 'Already done in AppFolio, so no reminders were sent.',
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
