/**
 * Owner-approval state machine.
 *
 * The problem this models, in a coordinator's own words: approval takes four
 * days to a week while the repair itself takes a day, every owner has a
 * different spend limit and a different preferred channel, and the tenant
 * blames the property manager rather than the owner.
 *
 * So the states are built around who is holding the job up, not around what
 * the agent last did. "Waiting on the owner" and "waiting on you" are the two
 * that matter; everything else is a variation on one of them.
 */

export const APPROVAL_STATES = [
  // Under the owner's pre-authorised limit. Never sent, never chased.
  'AutoApproved',
  // Asked, waiting.
  'Awaiting_FirstAsk',
  'Awaiting_Reminded',
  'Awaiting_FinalNotice',
  // Owner answered. A person needs to do something with the answer.
  'NeedsYou_Approved',
  'NeedsYou_Declined',
  'NeedsYou_Question',
  'NeedsYou_CounterOffer',
  // Nobody answered and the clock ran out.
  'Escalated_NoResponse',
  // Done.
  'Closed_Dispatched',
  'Closed_Declined',
  'Closed_Withdrawn',
] as const

export type ApprovalState = (typeof APPROVAL_STATES)[number]

export const OWNER_REPLY_CLASSIFICATIONS = [
  'approved',
  'declined',
  'question',
  'counter-offer',
  'irrelevant',
] as const
export type OwnerReplyClassification = (typeof OWNER_REPLY_CLASSIFICATIONS)[number]

export type ApprovalLane = 'needs-you' | 'waiting-owner' | 'overdue' | 'settled'

export type Urgency = 'routine' | 'urgent' | 'emergency'

export interface ApprovalStateMeta {
  lane: ApprovalLane
  shortLabel: string
  longLabel: string
  badgeColor: 'upcoming' | 'progress' | 'awaiting' | 'escalated' | 'closed'
  /** What a person should do next, phrased as an action. Null when nothing is owed. */
  cta: { label: string; class: 'btn-block' | 'btn-primary' | 'btn-ghost' } | null
  description: string
  isTerminal: boolean
}

export const APPROVAL_META: Record<ApprovalState, ApprovalStateMeta> = {
  AutoApproved: {
    lane: 'settled',
    shortLabel: 'Auto-approved',
    longLabel: 'Approved automatically',
    badgeColor: 'closed',
    cta: null,
    description:
      'Under this owner’s pre-authorised limit, so nobody was asked and nothing waited.',
    isTerminal: true,
  },
  Awaiting_FirstAsk: {
    lane: 'waiting-owner',
    shortLabel: 'Asked',
    longLabel: 'Waiting on the owner',
    badgeColor: 'progress',
    cta: null,
    description: 'The owner has been asked and has not answered yet.',
    isTerminal: false,
  },
  Awaiting_Reminded: {
    lane: 'waiting-owner',
    shortLabel: 'Reminded',
    longLabel: 'Waiting on the owner · reminded',
    badgeColor: 'progress',
    cta: null,
    description: 'Still nothing back, so the agent has sent a reminder.',
    isTerminal: false,
  },
  Awaiting_FinalNotice: {
    lane: 'waiting-owner',
    shortLabel: 'Final notice',
    longLabel: 'Waiting on the owner · final notice sent',
    badgeColor: 'awaiting',
    cta: null,
    description:
      'Last automated attempt. If this one goes unanswered it comes to you for a call.',
    isTerminal: false,
  },
  NeedsYou_Approved: {
    lane: 'needs-you',
    shortLabel: 'Approved',
    longLabel: 'Owner approved · ready to dispatch',
    badgeColor: 'awaiting',
    cta: { label: 'Dispatch the vendor', class: 'btn-block' },
    description: 'The owner said yes. Send the vendor and this is finished.',
    isTerminal: false,
  },
  NeedsYou_Declined: {
    lane: 'needs-you',
    shortLabel: 'Declined',
    longLabel: 'Owner declined',
    badgeColor: 'escalated',
    cta: { label: 'Close and tell the resident', class: 'btn-primary' },
    description: 'The owner said no. Someone has to tell the resident.',
    isTerminal: false,
  },
  NeedsYou_Question: {
    lane: 'needs-you',
    shortLabel: 'Question',
    longLabel: 'Owner asked a question',
    badgeColor: 'awaiting',
    cta: { label: 'Answer the owner', class: 'btn-block' },
    description: 'The owner wants something explained before they decide.',
    isTerminal: false,
  },
  NeedsYou_CounterOffer: {
    lane: 'needs-you',
    shortLabel: 'Wants options',
    longLabel: 'Owner wants a cheaper option or another quote',
    badgeColor: 'awaiting',
    cta: { label: 'Get another quote', class: 'btn-block' },
    description:
      'The owner has not said no, but will not approve this figure as it stands.',
    isTerminal: false,
  },
  Escalated_NoResponse: {
    lane: 'overdue',
    shortLabel: 'No response',
    longLabel: 'Escalated · owner has not answered',
    badgeColor: 'escalated',
    cta: { label: 'Call the owner', class: 'btn-primary' },
    description:
      'Every automated attempt has been used. This one needs a phone call.',
    isTerminal: false,
  },
  Closed_Dispatched: {
    lane: 'settled',
    shortLabel: 'Dispatched',
    longLabel: 'Approved and dispatched',
    badgeColor: 'closed',
    cta: null,
    description: 'Approved and the vendor is booked.',
    isTerminal: true,
  },
  Closed_Declined: {
    lane: 'settled',
    shortLabel: 'Not proceeding',
    longLabel: 'Closed · owner declined',
    badgeColor: 'closed',
    cta: null,
    description: 'Closed. The owner chose not to proceed.',
    isTerminal: true,
  },
  Closed_Withdrawn: {
    lane: 'settled',
    shortLabel: 'Withdrawn',
    longLabel: 'Closed · withdrawn',
    badgeColor: 'closed',
    cta: null,
    description: 'Pulled before a decision, usually because the problem resolved itself.',
    isTerminal: true,
  },
}

export const APPROVAL_LANE_ORDER: ApprovalLane[] = [
  'needs-you',
  'overdue',
  'waiting-owner',
  'settled',
]

export const APPROVAL_LANE_LABELS: Record<ApprovalLane, string> = {
  'needs-you': 'Waiting on you',
  overdue: 'Owner has gone quiet',
  'waiting-owner': 'Waiting on the owner',
  settled: 'Settled',
}

/**
 * How hard to chase, by urgency.
 *
 * The whole point of the track is that a repair takes a day and an approval
 * takes a week, so an emergency is chased in hours rather than days. These are
 * days from the moment the request was raised.
 */
export const CHASE_CADENCE: Record<Urgency, { remind: number; final: number; escalate: number }> = {
  emergency: { remind: 0.25, final: 0.75, escalate: 1.5 },
  urgent: { remind: 1, final: 2, escalate: 3 },
  routine: { remind: 2, final: 4, escalate: 6 },
}

export const URGENCY_META: Record<Urgency, { label: string; cls: string }> = {
  emergency: { label: 'Emergency', cls: 'bg-red-100 text-red-800 border-red-300' },
  urgent: { label: 'Urgent', cls: 'bg-amber-100 text-amber-900 border-amber-300' },
  routine: { label: 'Routine', cls: 'bg-slate-100 text-slate-700 border-slate-300' },
}

export function isAwaitingOwner(s: ApprovalState): boolean {
  return APPROVAL_META[s].lane === 'waiting-owner'
}

export const ALLOWED_APPROVAL_TRANSITIONS: Record<ApprovalState, ApprovalState[]> = {
  AutoApproved: ['Closed_Dispatched'],
  Awaiting_FirstAsk: [
    'Awaiting_Reminded',
    'NeedsYou_Approved',
    'NeedsYou_Declined',
    'NeedsYou_Question',
    'NeedsYou_CounterOffer',
    'Closed_Withdrawn',
  ],
  Awaiting_Reminded: [
    'Awaiting_FinalNotice',
    'NeedsYou_Approved',
    'NeedsYou_Declined',
    'NeedsYou_Question',
    'NeedsYou_CounterOffer',
    'Closed_Withdrawn',
  ],
  Awaiting_FinalNotice: [
    'Escalated_NoResponse',
    'NeedsYou_Approved',
    'NeedsYou_Declined',
    'NeedsYou_Question',
    'NeedsYou_CounterOffer',
    'Closed_Withdrawn',
  ],
  Escalated_NoResponse: [
    'NeedsYou_Approved',
    'NeedsYou_Declined',
    'Closed_Withdrawn',
  ],
  NeedsYou_Approved: ['Closed_Dispatched', 'Closed_Withdrawn'],
  NeedsYou_Declined: ['Closed_Declined', 'NeedsYou_CounterOffer', 'Closed_Withdrawn'],
  NeedsYou_Question: [
    'Awaiting_FirstAsk',
    'NeedsYou_Approved',
    'NeedsYou_Declined',
    'Closed_Withdrawn',
  ],
  NeedsYou_CounterOffer: [
    'Awaiting_FirstAsk',
    'NeedsYou_Approved',
    'Closed_Declined',
    'Closed_Withdrawn',
  ],
  Closed_Dispatched: [],
  Closed_Declined: [],
  Closed_Withdrawn: [],
}
