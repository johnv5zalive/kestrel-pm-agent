/**
 * Owner-approval seed. Deterministic and idempotent, same as the visit seed.
 *
 * Treat this as UX writing. Every quote, reply and hold-up is meant to be a
 * situation a property manager recognises immediately:
 *
 *   - a habitability repair with a statutory clock running
 *   - an owner who says yes but caps the figure below the quote
 *   - an owner who wants a second quote, which looks like a no and is not
 *   - a small repair that never needed asking about at all
 *   - an owner who has simply gone quiet for six days
 *
 * The point being made is that the money and the delay live here, not in
 * getting a date for a filter change.
 */

import { db } from './client.js'
import type { ApprovalState, Urgency } from '../agent/approval_state.js'
import type { OwnerReplyClassification } from '../agent/approval_state.js'

export interface SeedOwner {
  id: string
  name: string
  company?: string
  email?: string
  phone?: string
  lineType?: 'mobile' | 'landline' | 'voip'
  approvalLimitUsd: number
  preferredChannel: 'email' | 'sms' | 'voice'
  typicalResponseDays?: number
  notes?: string
}

interface SeedOutreach {
  channel: 'email' | 'sms' | 'voice'
  recipient: string
  subject?: string
  body: string
  sentAt: string
}

interface SeedReply {
  channel: 'email' | 'sms' | 'voice-keypress'
  fromAddress: string
  rawText: string
  classification?: OwnerReplyClassification
  parsedAmountUsd?: number
  confidence?: number
  receivedAt: string
}

interface SeedLog {
  ts: string
  level: 'info' | 'warn' | 'error' | 'success'
  line: string
}

interface SeedTransition {
  from: ApprovalState | null
  to: ApprovalState
  reason: string
  at: string
}

export interface SeedApproval {
  id: string
  locationId: string
  ownerId: string
  vendorId?: string
  summary: string
  detail?: string
  trade?: string
  quoteUsd: number
  tenantImpact?: string
  urgency: Urgency
  respondByIso?: string
  statuteNote?: string
  raisedAtIso: string
  state: ApprovalState
  decidedAtIso?: string
  approvedAmountUsd?: number
  outreach: SeedOutreach[]
  replies: SeedReply[]
  logs: SeedLog[]
  transitions: SeedTransition[]
}

export const OWNERS: SeedOwner[] = [
  {
    id: 'OWN-HALVERSON',
    name: 'Dale Halverson',
    company: 'Halverson Family Trust',
    email: 'dale@halversontrust.com',
    phone: '(919) 555-0801',
    lineType: 'mobile',
    approvalLimitUsd: 500,
    preferredChannel: 'email',
    typicalResponseDays: 1.5,
    notes: 'Answers quickly. Wants the tenant impact spelled out.',
  },
  {
    id: 'OWN-NAKASHIMA',
    name: 'Yuki Nakashima',
    email: 'y.nakashima@outlook.com',
    phone: '(984) 555-0812',
    lineType: 'mobile',
    approvalLimitUsd: 250,
    preferredChannel: 'sms',
    typicalResponseDays: 0.5,
    notes: 'Prefers text. Low limit, so most things need asking about.',
  },
  {
    id: 'OWN-BRENNAN',
    name: 'Margaret Brennan',
    company: 'Brennan Holdings LLC',
    email: 'accounts@brennanholdings.com',
    phone: '(919) 555-0823',
    lineType: 'landline',
    approvalLimitUsd: 1000,
    preferredChannel: 'email',
    typicalResponseDays: 5.5,
    notes: 'Slow. Goes through an accounts inbox rather than a person.',
  },
  {
    id: 'OWN-OKONKWO',
    name: 'Chidi Okonkwo',
    email: 'chidi.okonkwo@gmail.com',
    phone: '(984) 555-0834',
    lineType: 'mobile',
    approvalLimitUsd: 400,
    preferredChannel: 'email',
    typicalResponseDays: 2,
    notes: 'Price-sensitive. Usually asks for a second quote above $1,500.',
  },
  {
    id: 'OWN-VASQUEZ',
    name: 'Rosa Vasquez',
    company: 'Vasquez Property Group',
    email: 'rosa@vasquezpg.com',
    phone: '(919) 555-0845',
    lineType: 'mobile',
    approvalLimitUsd: 2500,
    preferredChannel: 'email',
    typicalResponseDays: 1,
    notes: 'High limit and quick. Rarely needs chasing.',
  },
  {
    id: 'OWN-DELACROIX',
    name: 'Bradford Place HOA Board',
    company: 'Bradford Place Townhomes HOA',
    email: 'board@bradfordplacehoa.com',
    phone: '(919) 555-0310',
    lineType: 'landline',
    approvalLimitUsd: 750,
    preferredChannel: 'email',
    typicalResponseDays: 9,
    notes: 'A board, not a person. Anything over the limit waits for a meeting.',
  },
]

/** Which owner holds which property. */
export const LOCATION_OWNERS: Record<string, string> = {
  'LOC-MAPLEWOOD-MAIN': 'OWN-VASQUEZ',
  'LOC-NORTHGATE-MAIN': 'OWN-VASQUEZ',
  'LOC-HARBOR-POINT': 'OWN-BRENNAN',
  'LOC-CEDAR-RIDGE-MAIN': 'OWN-DELACROIX',
  'LOC-FILLMORE-MAIN': 'OWN-BRENNAN',
  'LOC-SYCAMORE-MAIN': 'OWN-HALVERSON',
  'LOC-BRADFORD-MAIN': 'OWN-DELACROIX',
  'LOC-OAKMONT-MAIN': 'OWN-NAKASHIMA',
  'LOC-WESTGATE-MAIN': 'OWN-BRENNAN',
  'LOC-BEACON-MAIN': 'OWN-VASQUEZ',
  'LOC-MAGNOLIA-MAIN': 'OWN-OKONKWO',
  'LOC-STONEBRIDGE-MAIN': 'OWN-BRENNAN',
  'LOC-PARKSIDE-MAIN': 'OWN-OKONKWO',
  'LOC-ASHFORD-MAIN': 'OWN-HALVERSON',
  'LOC-RIVERSIDE-MAIN': 'OWN-NAKASHIMA',
  'LOC-BROOKHAVEN-MAIN': 'OWN-HALVERSON',
}

const SIGN = '\n\nThanks,\nKestrel Property Management'

export const APPROVALS: SeedApproval[] = [
  // ---- 1. Approved, ready to dispatch. The happy path, and fast. ----
  {
    id: 'APR-2026-0141',
    locationId: 'LOC-SYCAMORE-MAIN',
    ownerId: 'OWN-HALVERSON',
    summary: 'Water heater failed, unit 4B',
    detail:
      'Tank has split at the seam and is leaking into the pan. Not repairable. Quote is for a like-for-like 50-gallon replacement including haul-away.',
    trade: 'Plumbing',
    quoteUsd: 1450,
    tenantImpact: 'No hot water since Tuesday evening',
    urgency: 'urgent',
    respondByIso: '2026-04-30T18:00:00.000Z',
    statuteNote:
      'Loss of hot water. Most states put this in the shortest habitability tier, commonly 24 to 72 hours to begin work.',
    raisedAtIso: '2026-04-28T14:10:00.000Z',
    state: 'NeedsYou_Approved',
    decidedAtIso: '2026-04-29T08:22:00.000Z',
    approvedAmountUsd: 1450,
    outreach: [
      {
        channel: 'email',
        recipient: 'dale@halversontrust.com',
        subject: 'Approval needed: water heater replacement at Sycamore Court, unit 4B ($1,450)',
        body:
          'Hi Dale,\n\nThe water heater in unit 4B has split and is leaking. It cannot be repaired.\n\nQuote is $1,450 from Tidewater Plumbing for a like-for-like 50-gallon replacement, including removing the old tank.\n\nThe resident has had no hot water since Tuesday evening, so this one is on a clock. Reply approve and we will book it for tomorrow.' +
          SIGN,
        sentAt: '2026-04-28T14:12:00.000Z',
      },
    ],
    replies: [
      {
        channel: 'email',
        fromAddress: 'dale@halversontrust.com',
        rawText:
          'Yes go ahead, get it done. Please make sure they take the old one away, last time we were left with it in the car park for a week.',
        classification: 'approved',
        confidence: 0.94,
        receivedAt: '2026-04-29T08:22:00.000Z',
      },
    ],
    logs: [
      {
        ts: '2026-04-28T14:10:00.000Z',
        level: 'info',
        line: 'Quote of $1,450 is above Dale Halverson’s $500 limit, so approval is needed.',
      },
      {
        ts: '2026-04-28T14:10:30.000Z',
        level: 'warn',
        line: 'Loss of hot water. Response clock set to Apr 30, 6:00 PM.',
      },
      { ts: '2026-04-28T14:12:00.000Z', level: 'success', line: 'Emailed Dale Halverson.' },
      {
        ts: '2026-04-29T08:22:00.000Z',
        level: 'success',
        line: 'Reply read as approved. Answered in 18 hours, against a typical 1.5 days.',
      },
    ],
    transitions: [
      { from: null, to: 'Awaiting_FirstAsk', reason: 'Approval requested', at: '2026-04-28T14:12:00.000Z' },
      { from: 'Awaiting_FirstAsk', to: 'NeedsYou_Approved', reason: 'Owner approved $1,450', at: '2026-04-29T08:22:00.000Z' },
    ],
  },

  // ---- 2. Approved, but capped below the quote. The trap. ----
  {
    id: 'APR-2026-0138',
    locationId: 'LOC-BROOKHAVEN-MAIN',
    ownerId: 'OWN-HALVERSON',
    summary: 'HVAC compressor replacement, unit 12',
    detail:
      'Compressor has seized. Unit is fourteen years old, so the vendor has quoted a replacement condenser rather than a repair.',
    trade: 'HVAC',
    quoteUsd: 3200,
    tenantImpact: 'No cooling, resident using portable units',
    urgency: 'urgent',
    raisedAtIso: '2026-04-27T09:30:00.000Z',
    state: 'NeedsYou_Approved',
    decidedAtIso: '2026-04-28T17:45:00.000Z',
    approvedAmountUsd: 2500,
    outreach: [
      {
        channel: 'email',
        recipient: 'dale@halversontrust.com',
        subject: 'Approval needed: HVAC compressor at Brookhaven Flats, unit 12 ($3,200)',
        body:
          'Hi Dale,\n\nThe compressor in unit 12 has seized. The unit is fourteen years old and the vendor does not recommend repairing it.\n\nQuote is $3,200 from Carolina Air for a replacement condenser, parts and labour.\n\nThe resident is running portable coolers in the meantime. Reply approve and we will schedule it.' +
          SIGN,
        sentAt: '2026-04-27T09:32:00.000Z',
      },
    ],
    replies: [
      {
        channel: 'email',
        fromAddress: 'dale@halversontrust.com',
        rawText:
          'Approved up to $2,500. If it comes in higher than that come back to me first.',
        classification: 'approved',
        parsedAmountUsd: 2500,
        confidence: 0.7,
        receivedAt: '2026-04-28T17:45:00.000Z',
      },
    ],
    logs: [
      {
        ts: '2026-04-27T09:30:00.000Z',
        level: 'info',
        line: 'Quote of $3,200 is above Dale Halverson’s $500 limit, so approval is needed.',
      },
      { ts: '2026-04-27T09:32:00.000Z', level: 'success', line: 'Emailed Dale Halverson.' },
      {
        ts: '2026-04-28T17:45:00.000Z',
        level: 'warn',
        line: 'Reply read as approved, but capped at $2,500 against a $3,200 quote. Held for a person rather than dispatched.',
      },
    ],
    transitions: [
      { from: null, to: 'Awaiting_FirstAsk', reason: 'Approval requested', at: '2026-04-27T09:32:00.000Z' },
      { from: 'Awaiting_FirstAsk', to: 'NeedsYou_Approved', reason: 'Owner approved, capped at $2,500', at: '2026-04-28T17:45:00.000Z' },
    ],
  },

  // ---- 3. Counter-offer. Looks like a no, is not a no. ----
  {
    id: 'APR-2026-0136',
    locationId: 'LOC-MAGNOLIA-MAIN',
    ownerId: 'OWN-OKONKWO',
    summary: 'Roof leak above unit 7, building 2',
    detail:
      'Water staining across the ceiling of the back bedroom. Roofer found lifted shingles over a ten foot run and has quoted a section repair.',
    trade: 'Roofing',
    quoteUsd: 2890,
    tenantImpact: 'Water ingress in one bedroom during rain',
    urgency: 'urgent',
    raisedAtIso: '2026-04-26T11:05:00.000Z',
    state: 'NeedsYou_CounterOffer',
    decidedAtIso: '2026-04-28T10:14:00.000Z',
    outreach: [
      {
        channel: 'email',
        recipient: 'chidi.okonkwo@gmail.com',
        subject: 'Approval needed: roof repair at Magnolia Grove, building 2 ($2,890)',
        body:
          'Hi Chidi,\n\nThere is water coming through the ceiling of the back bedroom in unit 7 when it rains. The roofer found lifted shingles over about ten feet.\n\nQuote is $2,890 from Piedmont Roofing for a section repair, not a full replacement.\n\nLeft alone this turns into a ceiling replacement and possibly mould, so I would not wait on it. Reply approve and we will get it booked.' +
          SIGN,
        sentAt: '2026-04-26T11:07:00.000Z',
      },
    ],
    replies: [
      {
        channel: 'email',
        fromAddress: 'chidi.okonkwo@gmail.com',
        rawText:
          'That seems high for ten feet of shingles. Can we get a second quote before committing? I am not saying no, I just want to compare.',
        classification: 'counter-offer',
        confidence: 0.89,
        receivedAt: '2026-04-28T10:14:00.000Z',
      },
    ],
    logs: [
      {
        ts: '2026-04-26T11:05:00.000Z',
        level: 'info',
        line: 'Quote of $2,890 is above Chidi Okonkwo’s $400 limit, so approval is needed.',
      },
      { ts: '2026-04-26T11:07:00.000Z', level: 'success', line: 'Emailed Chidi Okonkwo.' },
      {
        ts: '2026-04-28T10:14:00.000Z',
        level: 'info',
        line: 'Reply read as wanting another quote, not as a refusal. Kept open.',
      },
    ],
    transitions: [
      { from: null, to: 'Awaiting_FirstAsk', reason: 'Approval requested', at: '2026-04-26T11:07:00.000Z' },
      { from: 'Awaiting_FirstAsk', to: 'NeedsYou_CounterOffer', reason: 'Owner wants a second quote', at: '2026-04-28T10:14:00.000Z' },
    ],
  },

  // ---- 4. Question. ----
  {
    id: 'APR-2026-0134',
    locationId: 'LOC-PARKSIDE-MAIN',
    ownerId: 'OWN-OKONKWO',
    summary: 'Dishwasher replacement, unit 3C',
    detail: 'Pump has failed. Repair quote is $410 against $620 to replace with a comparable model.',
    trade: 'Appliance',
    quoteUsd: 620,
    tenantImpact: 'No dishwasher, everything else in the kitchen works',
    urgency: 'routine',
    raisedAtIso: '2026-04-27T15:40:00.000Z',
    state: 'NeedsYou_Question',
    decidedAtIso: '2026-04-29T12:03:00.000Z',
    outreach: [
      {
        channel: 'email',
        recipient: 'chidi.okonkwo@gmail.com',
        subject: 'Approval needed: dishwasher at Parkside Residences, unit 3C ($620)',
        body:
          'Hi Chidi,\n\nThe dishwasher pump in unit 3C has failed. Repairing it is $410 and replacing it with a comparable model is $620.\n\nGiven the machine is nine years old we would suggest replacing rather than repairing, but either is fine.\n\nReply with which you would prefer and we will arrange it.' +
          SIGN,
        sentAt: '2026-04-27T15:42:00.000Z',
      },
    ],
    replies: [
      {
        channel: 'email',
        fromAddress: 'chidi.okonkwo@gmail.com',
        rawText:
          'Is the dishwasher actually our responsibility under this lease, or is it the tenant’s? I thought appliances were excluded.',
        classification: 'question',
        confidence: 0.91,
        receivedAt: '2026-04-29T12:03:00.000Z',
      },
    ],
    logs: [
      {
        ts: '2026-04-27T15:40:00.000Z',
        level: 'info',
        line: 'Quote of $620 is above Chidi Okonkwo’s $400 limit, so approval is needed.',
      },
      { ts: '2026-04-27T15:42:00.000Z', level: 'success', line: 'Emailed Chidi Okonkwo.' },
      {
        ts: '2026-04-29T12:03:00.000Z',
        level: 'info',
        line: 'Reply read as a question about lease responsibility. Answering this needs a person.',
      },
    ],
    transitions: [
      { from: null, to: 'Awaiting_FirstAsk', reason: 'Approval requested', at: '2026-04-27T15:42:00.000Z' },
      { from: 'Awaiting_FirstAsk', to: 'NeedsYou_Question', reason: 'Owner asked a question', at: '2026-04-29T12:03:00.000Z' },
    ],
  },

  // ---- 5. Six days of silence. The pain the research names. ----
  {
    id: 'APR-2026-0129',
    locationId: 'LOC-WESTGATE-MAIN',
    ownerId: 'OWN-BRENNAN',
    summary: 'Parking lot lighting, two poles out',
    detail:
      'Two of the six lot lights are dead. Electrician has traced it to a failed ballast on one and a broken conduit run on the other.',
    trade: 'Electrical',
    quoteUsd: 1875,
    tenantImpact: 'Half the car park unlit after dark',
    urgency: 'routine',
    raisedAtIso: '2026-04-23T10:00:00.000Z',
    state: 'Escalated_NoResponse',
    outreach: [
      {
        channel: 'email',
        recipient: 'accounts@brennanholdings.com',
        subject: 'Approval needed: car park lighting at Westgate Plaza ($1,875)',
        body:
          'Hi Margaret,\n\nTwo of the six car park lights at Westgate are out. One has a failed ballast and the other has a broken conduit run.\n\nQuote is $1,875 from Trinity Electric for both.\n\nHalf the car park is unlit after dark, which is worth resolving before it becomes a liability question. Reply approve and we will book it.' +
          SIGN,
        sentAt: '2026-04-23T10:02:00.000Z',
      },
      {
        channel: 'email',
        recipient: 'accounts@brennanholdings.com',
        subject: 'Re: Approval needed: car park lighting at Westgate Plaza ($1,875)',
        body:
          'Hi Margaret,\n\nFollowing up on the car park lighting at Westgate. We have not heard back and the lights are still out.\n\nReply approve and we will get it scheduled this week.' +
          SIGN,
        sentAt: '2026-04-25T10:02:00.000Z',
      },
      {
        channel: 'email',
        recipient: 'accounts@brennanholdings.com',
        subject: 'Re: Approval needed: car park lighting at Westgate Plaza ($1,875)',
        body:
          'Hi Margaret,\n\nThird attempt on the Westgate car park lighting, quoted at $1,875.\n\nIf we do not hear back this is going to sit unresolved, so I will call instead. If it is easier to approve by phone, let me know a good time.' +
          SIGN,
        sentAt: '2026-04-27T10:02:00.000Z',
      },
    ],
    replies: [],
    logs: [
      {
        ts: '2026-04-23T10:00:00.000Z',
        level: 'info',
        line: 'Quote of $1,875 is above Brennan Holdings’ $1,000 limit, so approval is needed.',
      },
      { ts: '2026-04-23T10:02:00.000Z', level: 'success', line: 'Emailed the Brennan Holdings accounts inbox.' },
      { ts: '2026-04-25T10:02:00.000Z', level: 'info', line: 'No answer after two days. Reminder sent.' },
      { ts: '2026-04-27T10:02:00.000Z', level: 'warn', line: 'Still no answer. Final notice sent.' },
      {
        ts: '2026-04-29T10:02:00.000Z',
        level: 'error',
        line: 'Six days with no decision. This one needs a phone call.',
      },
    ],
    transitions: [
      { from: null, to: 'Awaiting_FirstAsk', reason: 'Approval requested', at: '2026-04-23T10:02:00.000Z' },
      { from: 'Awaiting_FirstAsk', to: 'Awaiting_Reminded', reason: 'No answer after two days', at: '2026-04-25T10:02:00.000Z' },
      { from: 'Awaiting_Reminded', to: 'Awaiting_FinalNotice', reason: 'No answer after four days', at: '2026-04-27T10:02:00.000Z' },
      { from: 'Awaiting_FinalNotice', to: 'Escalated_NoResponse', reason: 'Six days, no decision', at: '2026-04-29T10:02:00.000Z' },
    ],
  },

  // ---- 6. Declined. ----
  {
    id: 'APR-2026-0132',
    locationId: 'LOC-RIVERSIDE-MAIN',
    ownerId: 'OWN-NAKASHIMA',
    summary: 'Replace worn carpet, unit 2A',
    detail: 'Carpet in the living area is worn through at the doorway. Resident has asked twice.',
    trade: 'Flooring',
    quoteUsd: 1240,
    tenantImpact: 'Cosmetic, no safety issue',
    urgency: 'routine',
    raisedAtIso: '2026-04-25T13:20:00.000Z',
    state: 'NeedsYou_Declined',
    decidedAtIso: '2026-04-25T19:41:00.000Z',
    outreach: [
      {
        channel: 'sms',
        recipient: '(984) 555-0812',
        body:
          'Kestrel Property Management: carpet replacement at Riverside Commons unit 2A quoted at $1,240. Worn through at the doorway, resident has asked twice. Reply APPROVE or DECLINE. Reply STOP to opt out.',
        sentAt: '2026-04-25T13:22:00.000Z',
      },
    ],
    replies: [
      {
        channel: 'sms',
        fromAddress: '(984) 555-0812',
        rawText:
          'Hold off on that one, the lease is up in September and I would rather do the whole unit then.',
        classification: 'declined',
        confidence: 0.88,
        receivedAt: '2026-04-25T19:41:00.000Z',
      },
    ],
    logs: [
      {
        ts: '2026-04-25T13:20:00.000Z',
        level: 'info',
        line: 'Quote of $1,240 is above Yuki Nakashima’s $250 limit, so approval is needed.',
      },
      { ts: '2026-04-25T13:22:00.000Z', level: 'success', line: 'Texted Yuki Nakashima, who prefers text.' },
      {
        ts: '2026-04-25T19:41:00.000Z',
        level: 'info',
        line: 'Reply read as declined, with a reason. Someone should tell the resident.',
      },
    ],
    transitions: [
      { from: null, to: 'Awaiting_FirstAsk', reason: 'Approval requested', at: '2026-04-25T13:22:00.000Z' },
      { from: 'Awaiting_FirstAsk', to: 'NeedsYou_Declined', reason: 'Owner declined, deferring to turnover', at: '2026-04-25T19:41:00.000Z' },
    ],
  },

  // ---- 7. Emergency, asked minutes ago, clock running. ----
  {
    id: 'APR-2026-0143',
    locationId: 'LOC-OAKMONT-MAIN',
    ownerId: 'OWN-NAKASHIMA',
    summary: 'Electrical panel arcing, main building',
    detail:
      'Electrician called out for a tripping breaker found arcing at the main panel and has isolated the affected circuits. Panel needs replacing.',
    trade: 'Electrical',
    quoteUsd: 4300,
    tenantImpact: 'Four units without power to kitchen circuits',
    urgency: 'emergency',
    respondByIso: '2026-04-30T15:00:00.000Z',
    statuteNote:
      'Loss of electricity to occupied units. Commonly the 24-hour habitability tier, and an active fire risk besides.',
    raisedAtIso: '2026-04-30T07:45:00.000Z',
    state: 'Awaiting_FirstAsk',
    outreach: [
      {
        channel: 'sms',
        recipient: '(984) 555-0812',
        body:
          'Kestrel Property Management: URGENT. Electrician found arcing at the main panel at Oakmont Manor and has isolated four units. Panel replacement quoted at $4,300. This is a fire risk and we need a decision today. Reply APPROVE to proceed. Reply STOP to opt out.',
        sentAt: '2026-04-30T07:47:00.000Z',
      },
      {
        channel: 'email',
        recipient: 'y.nakashima@outlook.com',
        subject: 'URGENT approval needed: electrical panel at Oakmont Manor ($4,300)',
        body:
          'Hi Yuki,\n\nI have also texted you about this.\n\nThe electrician attending a tripping breaker at Oakmont Manor found arcing at the main panel. He has isolated the affected circuits, which has left four units without power to their kitchens.\n\nQuote is $4,300 from Trinity Electric to replace the panel. They can start this afternoon.\n\nThis is a live fire risk and four units are affected, so we need a decision today. Reply approve and I will have them on site by 2pm.' +
          SIGN,
        sentAt: '2026-04-30T07:48:00.000Z',
      },
    ],
    replies: [],
    logs: [
      {
        ts: '2026-04-30T07:45:00.000Z',
        level: 'warn',
        line: 'Flagged as an emergency: arcing panel with occupied units affected.',
      },
      {
        ts: '2026-04-30T07:45:30.000Z',
        level: 'warn',
        line: 'Loss of electricity to four units. Response clock set to Apr 30, 3:00 PM.',
      },
      {
        ts: '2026-04-30T07:47:00.000Z',
        level: 'success',
        line: 'Texted Yuki Nakashima, who prefers text.',
      },
      {
        ts: '2026-04-30T07:48:00.000Z',
        level: 'success',
        line: 'Emailed as well. Emergencies go out on both channels rather than waiting.',
      },
    ],
    transitions: [
      { from: null, to: 'Awaiting_FirstAsk', reason: 'Emergency approval requested', at: '2026-04-30T07:47:00.000Z' },
    ],
  },

  // ---- 8. Reminded, waiting. The HOA board that meets monthly. ----
  {
    id: 'APR-2026-0135',
    locationId: 'LOC-BRADFORD-MAIN',
    ownerId: 'OWN-DELACROIX',
    summary: 'Pool house heat pump replacement',
    detail:
      'Pool house heat pump has failed and is beyond economical repair at eleven years old. Quote covers removal and replacement.',
    trade: 'HVAC',
    quoteUsd: 5400,
    tenantImpact: 'Pool unheated, amenity closed',
    urgency: 'routine',
    raisedAtIso: '2026-04-26T09:15:00.000Z',
    state: 'Awaiting_Reminded',
    outreach: [
      {
        channel: 'email',
        recipient: 'board@bradfordplacehoa.com',
        subject: 'Approval needed: pool house heat pump at Bradford Place ($5,400)',
        body:
          'Hi all,\n\nThe pool house heat pump has failed. At eleven years old the vendor does not recommend repairing it.\n\nQuote is $5,400 from Carolina Air to remove and replace.\n\nThe pool is closed until this is resolved, so the sooner the board can decide the better. Reply approve and we will book it.' +
          SIGN,
        sentAt: '2026-04-26T09:17:00.000Z',
      },
      {
        channel: 'email',
        recipient: 'board@bradfordplacehoa.com',
        subject: 'Re: Approval needed: pool house heat pump at Bradford Place ($5,400)',
        body:
          'Hi all,\n\nFollowing up on the pool house heat pump, quoted at $5,400. The pool remains closed.\n\nIf this needs to wait for the next board meeting, reply and tell me the date and I will stop chasing until then.' +
          SIGN,
        sentAt: '2026-04-28T09:17:00.000Z',
      },
    ],
    replies: [],
    logs: [
      {
        ts: '2026-04-26T09:15:00.000Z',
        level: 'info',
        line: 'Quote of $5,400 is above the board’s $750 limit, so approval is needed.',
      },
      { ts: '2026-04-26T09:17:00.000Z', level: 'success', line: 'Emailed the Bradford Place board.' },
      {
        ts: '2026-04-28T09:17:00.000Z',
        level: 'info',
        line: 'No answer after two days. Reminder sent, offering to pause until their next meeting.',
      },
      {
        ts: '2026-04-28T09:17:30.000Z',
        level: 'info',
        line: 'This owner typically takes 9 days. Expect a slow decision.',
      },
    ],
    transitions: [
      { from: null, to: 'Awaiting_FirstAsk', reason: 'Approval requested', at: '2026-04-26T09:17:00.000Z' },
      { from: 'Awaiting_FirstAsk', to: 'Awaiting_Reminded', reason: 'No answer after two days', at: '2026-04-28T09:17:00.000Z' },
    ],
  },

  // ---- 9. Never asked. Under the limit. ----
  {
    id: 'APR-2026-0142',
    locationId: 'LOC-BEACON-MAIN',
    ownerId: 'OWN-VASQUEZ',
    summary: 'Garbage disposal replacement, unit 9',
    detail: 'Motor seized. Replacement of a like-for-like half horsepower unit including fitting.',
    trade: 'Plumbing',
    quoteUsd: 180,
    tenantImpact: 'Disposal out of use',
    urgency: 'routine',
    raisedAtIso: '2026-04-29T16:20:00.000Z',
    state: 'AutoApproved',
    decidedAtIso: '2026-04-29T16:20:00.000Z',
    approvedAmountUsd: 180,
    outreach: [],
    replies: [],
    logs: [
      {
        ts: '2026-04-29T16:20:00.000Z',
        level: 'success',
        line: 'Quote of $180 is under Rosa Vasquez’s $2,500 limit. Approved automatically, nobody asked, nothing waited.',
      },
      {
        ts: '2026-04-29T16:20:05.000Z',
        level: 'info',
        line: 'Included in the monthly owner summary rather than sent as its own request.',
      },
    ],
    transitions: [
      { from: null, to: 'AutoApproved', reason: 'Under the owner’s limit', at: '2026-04-29T16:20:00.000Z' },
    ],
  },

  // ---- 10. Settled, for the closed lane. ----
  {
    id: 'APR-2026-0127',
    locationId: 'LOC-STONEBRIDGE-MAIN',
    ownerId: 'OWN-BRENNAN',
    summary: 'Suite 200 door closer replacement',
    detail: 'Closer failed and the fire door no longer latches.',
    trade: 'General',
    quoteUsd: 1320,
    tenantImpact: 'Fire door not latching',
    urgency: 'urgent',
    raisedAtIso: '2026-04-21T08:00:00.000Z',
    state: 'Closed_Dispatched',
    decidedAtIso: '2026-04-22T14:30:00.000Z',
    approvedAmountUsd: 1320,
    outreach: [
      {
        channel: 'email',
        recipient: 'accounts@brennanholdings.com',
        subject: 'Approval needed: fire door closer at Stonebridge Offices ($1,320)',
        body:
          'Hi Margaret,\n\nThe closer on the suite 200 fire door has failed and the door is no longer latching, which is a fire code problem.\n\nQuote is $1,320 from Trinity Contracting to replace it.\n\nReply approve and we will book it.' +
          SIGN,
        sentAt: '2026-04-21T08:02:00.000Z',
      },
    ],
    replies: [
      {
        channel: 'email',
        fromAddress: 'accounts@brennanholdings.com',
        rawText: 'Approved. Please proceed and send the invoice through as usual.',
        classification: 'approved',
        confidence: 0.95,
        receivedAt: '2026-04-22T14:30:00.000Z',
      },
    ],
    logs: [
      {
        ts: '2026-04-21T08:00:00.000Z',
        level: 'info',
        line: 'Quote of $1,320 is above Brennan Holdings’ $1,000 limit, so approval is needed.',
      },
      { ts: '2026-04-21T08:02:00.000Z', level: 'success', line: 'Emailed the Brennan Holdings accounts inbox.' },
      { ts: '2026-04-22T14:30:00.000Z', level: 'success', line: 'Reply read as approved.' },
      { ts: '2026-04-22T15:10:00.000Z', level: 'success', line: 'Vendor dispatched by the coordinator.' },
    ],
    transitions: [
      { from: null, to: 'Awaiting_FirstAsk', reason: 'Approval requested', at: '2026-04-21T08:02:00.000Z' },
      { from: 'Awaiting_FirstAsk', to: 'NeedsYou_Approved', reason: 'Owner approved $1,320', at: '2026-04-22T14:30:00.000Z' },
      { from: 'NeedsYou_Approved', to: 'Closed_Dispatched', reason: 'Vendor dispatched', at: '2026-04-22T15:10:00.000Z' },
    ],
  },
]

export function seedApprovals() {
  const insOwner = db.prepare(`
    INSERT INTO owners (id, name, company, email, phone, line_type, approval_limit_usd,
                        preferred_channel, typical_response_days, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insApproval = db.prepare(`
    INSERT INTO approval_requests
      (id, location_id, owner_id, vendor_id, summary, detail, trade, quote_usd, tenant_impact,
       urgency, respond_by_iso, statute_note, raised_at_iso, state, decided_at_iso, approved_amount_usd)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insOutreach = db.prepare(`
    INSERT INTO outreach_attempts
      (subject_type, subject_id, channel, contact_id, recipient, subject, body_text, sent_at_demo_clock, intercepted)
    VALUES ('approval', ?, ?, NULL, ?, ?, ?, ?, 1)
  `)
  const insReply = db.prepare(`
    INSERT INTO inbound_replies
      (subject_type, subject_id, channel, contact_id, from_address, raw_text, classification,
       parsed_date, parsed_amount_usd, llm_confidence, received_at_demo_clock)
    VALUES ('approval', ?, ?, NULL, ?, ?, ?, NULL, ?, ?, ?)
  `)
  const insLog = db.prepare(`
    INSERT INTO agent_logs (subject_type, subject_id, ts_demo_clock, level, line)
    VALUES ('approval', ?, ?, ?, ?)
  `)
  const insTransition = db.prepare(`
    INSERT INTO state_transitions (subject_type, subject_id, from_state, to_state, reason, at_demo_clock)
    VALUES ('approval', ?, ?, ?, ?, ?)
  `)

  for (const o of OWNERS) {
    insOwner.run(
      o.id,
      o.name,
      o.company ?? null,
      o.email ?? null,
      o.phone ?? null,
      o.lineType ?? null,
      o.approvalLimitUsd,
      o.preferredChannel,
      o.typicalResponseDays ?? null,
      o.notes ?? null,
    )
  }

  // Attach owners to the properties seeded by the visit track.
  const setOwner = db.prepare(`UPDATE locations SET owner_id = ? WHERE id = ?`)
  for (const [locationId, ownerId] of Object.entries(LOCATION_OWNERS)) {
    setOwner.run(ownerId, locationId)
  }

  for (const a of APPROVALS) {
    insApproval.run(
      a.id,
      a.locationId,
      a.ownerId,
      a.vendorId ?? null,
      a.summary,
      a.detail ?? null,
      a.trade ?? null,
      a.quoteUsd,
      a.tenantImpact ?? null,
      a.urgency,
      a.respondByIso ?? null,
      a.statuteNote ?? null,
      a.raisedAtIso,
      a.state,
      a.decidedAtIso ?? null,
      a.approvedAmountUsd ?? null,
    )
    for (const o of a.outreach) {
      insOutreach.run(a.id, o.channel, o.recipient, o.subject ?? null, o.body, o.sentAt)
    }
    for (const r of a.replies) {
      insReply.run(
        a.id,
        r.channel,
        r.fromAddress,
        r.rawText,
        r.classification ?? null,
        r.parsedAmountUsd ?? null,
        r.confidence ?? null,
        r.receivedAt,
      )
    }
    for (const l of a.logs) insLog.run(a.id, l.ts, l.level, l.line)
    for (const t of a.transitions) insTransition.run(a.id, t.from, t.to, t.reason, t.at)
  }
}
