/**
 * Deterministic, idempotent seed. Restart-demo lands on byte-identical state.
 * Treat this file as UX writing — every property name, equipment record, reply,
 * and timeline line is part of the Coordinator's narrative.
 *
 * Demo clock anchor: 2026-04-30T09:00:00Z (Wednesday before May 1, 2026).
 * Most RSEs have May 2026 due-dates so all the activity around them shows up
 * in the Coordinator's queue at this moment in time.
 */

import { db } from './client.js'
import type { AgentState, InboundClassification } from '../agent/state_machine.js'

export const DEMO_CLOCK_ISO = '2026-04-30T09:00:00.000Z'

interface Equipment {
  id: string
  itemName: string
  itemDescription?: string
}

interface Contact {
  id: string
  name: string
  role?: string
  roleRank: number
  phone?: string
  email?: string
  lineType?: 'mobile' | 'landline' | 'voip'
  isPrimary?: boolean
  doNotText?: boolean
  doNotEmail?: boolean
  doNotCall?: boolean
}

interface OutreachAttempt {
  channel: 'email' | 'sms' | 'voice'
  contactId?: string
  recipient: string
  subject?: string
  body: string
  sentAt: string
}

interface InboundReply {
  channel: 'email' | 'sms' | 'voice-keypress'
  contactId?: string
  fromAddress: string
  rawText: string
  classification?: InboundClassification
  parsedDate?: string
  llmConfidence?: number
  receivedAt: string
}

interface AgentLog {
  ts: string
  level: 'info' | 'warn' | 'error' | 'success'
  line: string
}

interface StateTransition {
  from: AgentState | null
  to: AgentState
  reason: string
  at: string
}

interface SeedJob {
  customerId: string
  customerName: string
  locationId: string
  locationName?: string
  city: string
  state: string
  zip: string
  street: string
  serviceZone: string
  primaryPhone?: string
  primaryEmail?: string
  contacts: Contact[]
  equipment: Equipment[]
  recurringServiceId: string
  recurringServiceName: string
  cadence: 'annual' | 'biannual' | 'quarterly' | 'monthly'
  jobSummary: string
  rseId: string
  dueDate: string
  agentState: AgentState
  appfolioStatus: string
  outreach: OutreachAttempt[]
  replies: InboundReply[]
  logs: AgentLog[]
  transitions: StateTransition[]
}

// ===== The 15-job showcase =====
// One entry per UI surface in the default-view state machine.
// Adapter-1-only states (Closed_BookedOutsideAgent, Skipped_PreSendCheckCancelled)
// are added as conditional jobs that activate when adapter toggle = adapter1.
//
// The "customer" in the data model is the property Kestrel manages; the
// "contacts" are the on-site people (property managers, building supers,
// resident points-of-contact) the agent reaches to schedule access for a
// recurring maintenance visit.

const JOBS: SeedJob[] = [
  // ---- 1. UPCOMING — sequence not started ----
  {
    customerId: 'CUST-MAPLEWOOD',
    customerName: 'Maplewood Apartments',
    locationId: 'LOC-MAPLEWOOD-MAIN',
    city: 'Raleigh',
    state: 'NC',
    zip: '27604',
    street: '4180 Newton Rd',
    serviceZone: 'NC01',
    primaryPhone: '(919) 555-0129',
    primaryEmail: 'office@maplewoodapts.com',
    contacts: [
      {
        id: 'CONT-MAPLEWOOD-1',
        name: 'Maplewood Leasing Office',
        role: 'On-site Office',
        roleRank: 30,
        phone: '(919) 555-0129',
        email: 'office@maplewoodapts.com',
        lineType: 'landline',
        isPrimary: true,
      },
    ],
    equipment: [
      {
        id: 'EQ-MAPLEWOOD-1',
        itemName: 'Carrier 48TCED08',
        itemDescription: 'Carrier 7.5-ton rooftop packaged unit, leasing office',
      },
    ],
    recurringServiceId: 'RS-MAPLEWOOD-ANNUAL',
    recurringServiceName: 'Annual PM',
    cadence: 'annual',
    jobSummary:
      '1x rooftop HVAC unit serving the leasing office. Annual PM (filter + coil service). On-site office is the best contact.',
    rseId: 'RSE-MAPLEWOOD-2026-06',
    dueDate: '2026-06-15',
    agentState: 'Upcoming',
    appfolioStatus: 'Not Attempted',
    outreach: [],
    replies: [],
    logs: [
      {
        ts: '2026-04-26T20:14:00.000Z',
        level: 'info',
        line: 'Ingested from AppFolio via Adapter 2A (scheduled XLSX report).',
      },
      {
        ts: '2026-04-26T20:14:01.000Z',
        level: 'info',
        line: 'Extracted 1 equipment item from Work Order summary; no POC hint detected.',
      },
      {
        ts: '2026-04-26T20:14:01.000Z',
        level: 'info',
        line: 'Outreach scheduled: Email T-10 on 2026-06-05.',
      },
    ],
    transitions: [
      {
        from: null,
        to: 'Upcoming',
        reason: 'Ingested from AppFolio',
        at: '2026-04-26T20:14:00.000Z',
      },
    ],
  },

  // ---- 2. UPCOMING ----
  {
    customerId: 'CUST-NORTHGATE',
    customerName: 'Northgate Commons',
    locationId: 'LOC-NORTHGATE-MAIN',
    city: 'Durham',
    state: 'NC',
    zip: '27703',
    street: '8600 Sherron Rd',
    serviceZone: 'NC02',
    primaryPhone: '(984) 555-0140',
    primaryEmail: 'facilities@northgatecommons.com',
    contacts: [
      {
        id: 'CONT-NORTHGATE-1',
        name: 'Camila Ortiz',
        role: 'Property Manager',
        roleRank: 10,
        phone: '(984) 555-0141',
        email: 'cortiz@northgatecommons.com',
        lineType: 'mobile',
        isPrimary: true,
      },
    ],
    equipment: [
      {
        id: 'EQ-NORTHGATE-1',
        itemName: 'Trane XR16-036',
        itemDescription: 'Trane 3-ton split system, community clubhouse',
      },
      {
        id: 'EQ-NORTHGATE-2',
        itemName: 'AO Smith BTH-120',
        itemDescription: '60-gal commercial water heater, clubhouse',
      },
    ],
    recurringServiceId: 'RS-NORTHGATE-BIANNUAL',
    recurringServiceName: 'BiAnnual PM',
    cadence: 'biannual',
    jobSummary:
      'BiAnnual PM. 2 units in the clubhouse mechanical room. POC: Camila (property manager), prefers email.',
    rseId: 'RSE-NORTHGATE-2026-06',
    dueDate: '2026-06-22',
    agentState: 'Upcoming',
    appfolioStatus: 'Not Attempted',
    outreach: [],
    replies: [],
    logs: [
      {
        ts: '2026-04-26T20:14:02.000Z',
        level: 'info',
        line: 'Ingested from AppFolio via Adapter 2A.',
      },
      {
        ts: '2026-04-26T20:14:02.000Z',
        level: 'info',
        line: 'Extracted 2 equipment items; high-confidence POC hint: "Camila (property manager), prefers email".',
      },
    ],
    transitions: [
      {
        from: null,
        to: 'Upcoming',
        reason: 'Ingested from AppFolio',
        at: '2026-04-26T20:14:02.000Z',
      },
    ],
  },

  // ---- 3. UPCOMING ----
  {
    customerId: 'CUST-HARBOR-POINT',
    customerName: 'Harbor Point Lofts',
    locationId: 'LOC-HARBOR-POINT',
    city: 'Raleigh',
    state: 'NC',
    zip: '27601',
    street: '152 Blount St',
    serviceZone: 'NC01',
    primaryPhone: '(919) 555-0166',
    primaryEmail: 'super@harborpointlofts.com',
    contacts: [
      {
        id: 'CONT-HARBOR-1',
        name: 'Devin Rourke',
        role: 'Building Superintendent',
        roleRank: 5,
        phone: '(919) 555-0184',
        email: 'devin@harborpointlofts.com',
        lineType: 'mobile',
        isPrimary: true,
      },
    ],
    equipment: [
      {
        id: 'EQ-HARBOR-1',
        itemName: 'Weil-McLain CGa-6',
        itemDescription: 'Gas-fired hydronic boiler, basement mechanical room',
      },
      { id: 'EQ-HARBOR-2', itemName: 'Mitsubishi MSZ-GL24', itemDescription: 'Ductless mini-split, lobby' },
      { id: 'EQ-HARBOR-3', itemName: 'AO Smith BTH-199', itemDescription: '100-gal commercial water heater' },
    ],
    recurringServiceId: 'RS-HARBOR-MONTHLY',
    recurringServiceName: 'Monthly PM',
    cadence: 'monthly',
    jobSummary:
      'Monthly PM — occupied building, prefers early mornings before residents leave for work. Devin owns the schedule.',
    rseId: 'RSE-HARBOR-2026-06',
    dueDate: '2026-06-08',
    agentState: 'Upcoming',
    appfolioStatus: 'Not Attempted',
    outreach: [],
    replies: [],
    logs: [
      {
        ts: '2026-04-26T20:14:03.000Z',
        level: 'info',
        line: 'Ingested from AppFolio via Adapter 2A.',
      },
      {
        ts: '2026-04-26T20:14:03.000Z',
        level: 'info',
        line: 'Extracted 3 equipment items; POC hint: "Devin owns the schedule".',
      },
    ],
    transitions: [
      {
        from: null,
        to: 'Upcoming',
        reason: 'Ingested from AppFolio',
        at: '2026-04-26T20:14:03.000Z',
      },
    ],
  },

  // ---- 4. IN-PROGRESS · Email T-10 sent ----
  {
    customerId: 'CUST-CEDAR-RIDGE',
    customerName: 'Cedar Ridge HOA',
    locationId: 'LOC-CEDAR-RIDGE-MAIN',
    city: 'Cary',
    state: 'NC',
    zip: '27513',
    street: '7855 Kildaire Farm Rd',
    serviceZone: 'NC03',
    primaryPhone: '(919) 555-0188',
    primaryEmail: 'office@cedarridgehoa.com',
    contacts: [
      {
        id: 'CONT-CEDAR-1',
        name: 'Kelly Ambrose',
        role: 'HOA Office Manager',
        roleRank: 20,
        phone: '(919) 555-0188',
        email: 'kelly@cedarridgehoa.com',
        lineType: 'landline',
        isPrimary: true,
      },
    ],
    equipment: [
      {
        id: 'EQ-CEDAR-1',
        itemName: 'Rheem RP1436',
        itemDescription: 'Rheem 3-ton heat pump, clubhouse',
      },
    ],
    recurringServiceId: 'RS-CEDAR-BIANNUAL',
    recurringServiceName: 'BiAnnual PM',
    cadence: 'biannual',
    jobSummary: 'BiAnnual PM — single heat pump serving the community clubhouse.',
    rseId: 'RSE-CEDAR-2026-05',
    dueDate: '2026-05-05',
    agentState: 'InProgress_EmailT10_Sent',
    appfolioStatus: 'Contacted',
    outreach: [
      {
        channel: 'email',
        contactId: 'CONT-CEDAR-1',
        recipient: 'kelly@cedarridgehoa.com',
        subject: 'BiAnnual PM for Cedar Ridge HOA — let us know what date works',
        body:
          'Hi Kelly,\n\nYour next BiAnnual maintenance visit for the clubhouse heat pump is coming up around the first week of May. Reply with a date that works, or use the booking form at kestrelpm.com/request-service.\n\n— Kestrel Property Management',
        sentAt: '2026-04-25T13:30:00.000Z',
      },
    ],
    replies: [],
    logs: [
      {
        ts: '2026-04-21T20:14:00.000Z',
        level: 'info',
        line: 'Ingested from AppFolio via Adapter 2A.',
      },
      {
        ts: '2026-04-25T13:30:00.000Z',
        level: 'info',
        line: 'Sending Email T-10 to kelly@cedarridgehoa.com…',
      },
      {
        ts: '2026-04-25T13:30:01.000Z',
        level: 'success',
        line: 'Email T-10 sent (intercepted in demo — no real mail left the agent).',
      },
    ],
    transitions: [
      {
        from: null,
        to: 'Upcoming',
        reason: 'Ingested from AppFolio',
        at: '2026-04-21T20:14:00.000Z',
      },
      {
        from: 'Upcoming',
        to: 'InProgress_EmailT10_Sent',
        reason: 'Email T-10 sent',
        at: '2026-04-25T13:30:01.000Z',
      },
    ],
  },

  // ---- 5. IN-PROGRESS · Email T-10 sent ----
  {
    customerId: 'CUST-FILLMORE',
    customerName: 'Fillmore Commercial Plaza',
    locationId: 'LOC-FILLMORE-MAIN',
    city: 'Morrisville',
    state: 'NC',
    zip: '27560',
    street: '2200 Aviation Pkwy',
    serviceZone: 'NC02',
    primaryPhone: '(984) 555-0200',
    primaryEmail: 'ops@fillmoreplaza.com',
    contacts: [
      {
        id: 'CONT-FILLMORE-1',
        name: 'Nadia Okoro',
        role: 'Building Operations',
        roleRank: 10,
        phone: '(984) 555-0241',
        email: 'nokoro@fillmoreplaza.com',
        lineType: 'mobile',
        isPrimary: true,
      },
    ],
    equipment: [
      {
        id: 'EQ-FILLMORE-1',
        itemName: 'Carrier 48TCED12',
        itemDescription: 'Carrier 10-ton rooftop unit, Suite 100-140',
      },
      { id: 'EQ-FILLMORE-2', itemName: 'Carrier 48TCED06', itemDescription: '5-ton rooftop unit, common area' },
    ],
    recurringServiceId: 'RS-FILLMORE-MONTHLY',
    recurringServiceName: 'Monthly PM',
    cadence: 'monthly',
    jobSummary: 'Monthly PM — two rooftop units over leased suites. Schedule with Nadia.',
    rseId: 'RSE-FILLMORE-2026-05',
    dueDate: '2026-05-06',
    agentState: 'InProgress_EmailT10_Sent',
    appfolioStatus: 'Contacted',
    outreach: [
      {
        channel: 'email',
        contactId: 'CONT-FILLMORE-1',
        recipient: 'nokoro@fillmoreplaza.com',
        subject: 'Monthly PM for Fillmore Commercial Plaza — let us know what date works',
        body:
          'Hi Nadia,\n\nYour next Monthly maintenance visit for the rooftop units is coming up around the first week of May. Reply with a date that works, or use kestrelpm.com/request-service.\n\n— Kestrel Property Management',
        sentAt: '2026-04-26T13:30:00.000Z',
      },
    ],
    replies: [],
    logs: [
      {
        ts: '2026-04-21T20:14:01.000Z',
        level: 'info',
        line: 'Ingested from AppFolio via Adapter 2A.',
      },
      {
        ts: '2026-04-26T13:30:00.000Z',
        level: 'info',
        line: 'Sending Email T-10 to nokoro@fillmoreplaza.com…',
      },
      {
        ts: '2026-04-26T13:30:01.000Z',
        level: 'success',
        line: 'Email T-10 sent (intercepted in demo).',
      },
    ],
    transitions: [
      {
        from: null,
        to: 'Upcoming',
        reason: 'Ingested from AppFolio',
        at: '2026-04-21T20:14:01.000Z',
      },
      {
        from: 'Upcoming',
        to: 'InProgress_EmailT10_Sent',
        reason: 'Email T-10 sent',
        at: '2026-04-26T13:30:01.000Z',
      },
    ],
  },

  // ---- 6. IN-PROGRESS · Email T-5 sent ----
  {
    customerId: 'CUST-SYCAMORE',
    customerName: 'Sycamore Court Apartments',
    locationId: 'LOC-SYCAMORE-MAIN',
    city: 'Raleigh',
    state: 'NC',
    zip: '27607',
    street: '1450 Method Rd',
    serviceZone: 'NC01',
    primaryPhone: '(919) 555-0277',
    primaryEmail: 'maintenance@sycamorecourt.com',
    contacts: [
      {
        id: 'CONT-SYCAMORE-1',
        name: 'Trevor Nguyen',
        role: 'Maintenance Technician',
        roleRank: 5,
        phone: '(919) 555-0227',
        email: 'trevor@sycamorecourt.com',
        lineType: 'mobile',
        isPrimary: true,
      },
    ],
    equipment: [
      {
        id: 'EQ-SYCAMORE-1',
        itemName: 'Goodman GSXC18-048',
        itemDescription: 'Goodman 4-ton condenser, Building A',
      },
      {
        id: 'EQ-SYCAMORE-2',
        itemName: 'Goodman GSXC18-036',
        itemDescription: '3-ton condenser, Building B',
      },
    ],
    recurringServiceId: 'RS-SYCAMORE-MONTHLY',
    recurringServiceName: 'Monthly PM',
    cadence: 'monthly',
    jobSummary:
      'Monthly PM — two buildings. Trevor prefers a 2pm-4pm window (between morning turns and evening make-readies).',
    rseId: 'RSE-SYCAMORE-2026-05',
    dueDate: '2026-05-01',
    agentState: 'InProgress_EmailT5_Sent',
    appfolioStatus: 'Contacted',
    outreach: [
      {
        channel: 'email',
        contactId: 'CONT-SYCAMORE-1',
        recipient: 'trevor@sycamorecourt.com',
        subject: 'Monthly PM for Sycamore Court Apartments — let us know what date works',
        body:
          'Hi Trevor,\n\nYour Monthly maintenance visit is due around May 1. Best window is your usual 2-4pm gap. Reply with a date or use kestrelpm.com/request-service.\n\n— Kestrel Property Management',
        sentAt: '2026-04-21T13:30:00.000Z',
      },
      {
        channel: 'email',
        contactId: 'CONT-SYCAMORE-1',
        recipient: 'trevor@sycamorecourt.com',
        subject: 'Re: Monthly PM for Sycamore Court Apartments — quick follow-up',
        body:
          'Hi Trevor,\n\nFollowing up on the Monthly PM for May. Just need a date that works between now and the 8th. Reply or use kestrelpm.com/request-service.\n\n— Kestrel Property Management',
        sentAt: '2026-04-26T13:30:00.000Z',
      },
    ],
    replies: [],
    logs: [
      {
        ts: '2026-04-21T13:30:00.000Z',
        level: 'success',
        line: 'Email T-10 sent to trevor@sycamorecourt.com (intercepted in demo).',
      },
      {
        ts: '2026-04-26T13:30:00.000Z',
        level: 'info',
        line: 'No reply after T-10. Sending T-5 follow-up…',
      },
      {
        ts: '2026-04-26T13:30:01.000Z',
        level: 'success',
        line: 'Email T-5 sent (intercepted in demo).',
      },
    ],
    transitions: [
      { from: null, to: 'Upcoming', reason: 'Ingested', at: '2026-04-21T13:00:00.000Z' },
      {
        from: 'Upcoming',
        to: 'InProgress_EmailT10_Sent',
        reason: 'Email T-10 sent',
        at: '2026-04-21T13:30:01.000Z',
      },
      {
        from: 'InProgress_EmailT10_Sent',
        to: 'InProgress_EmailT5_Sent',
        reason: 'No reply — escalated to T-5 email',
        at: '2026-04-26T13:30:01.000Z',
      },
    ],
  },

  // ---- 7. IN-PROGRESS · Email T-5 sent ----
  {
    customerId: 'CUST-BRADFORD',
    customerName: 'Bradford Place Townhomes',
    locationId: 'LOC-BRADFORD-MAIN',
    city: 'Apex',
    state: 'NC',
    zip: '27502',
    street: '6225 Center St',
    serviceZone: 'NC03',
    primaryPhone: '(919) 555-0310',
    primaryEmail: 'manager@bradfordplacehoa.com',
    contacts: [
      {
        id: 'CONT-BRADFORD-1',
        name: 'Simone Delacroix',
        role: 'Community Manager',
        roleRank: 10,
        phone: '(919) 555-0315',
        email: 'sdelacroix@bradfordplacehoa.com',
        lineType: 'mobile',
        isPrimary: true,
      },
    ],
    equipment: [
      {
        id: 'EQ-BRADFORD-1',
        itemName: 'Lennox EL16XC1-042',
        itemDescription: 'Lennox 3.5-ton condenser, clubhouse',
      },
      {
        id: 'EQ-BRADFORD-2',
        itemName: 'Lennox EL16XC1-024',
        itemDescription: 'Lennox 2-ton condenser, pool house',
      },
    ],
    recurringServiceId: 'RS-BRADFORD-BIANNUAL',
    recurringServiceName: 'BiAnnual PM',
    cadence: 'biannual',
    jobSummary:
      'BiAnnual PM — two units, clubhouse and pool house. Schedule before weekend community events.',
    rseId: 'RSE-BRADFORD-2026-05',
    dueDate: '2026-05-04',
    agentState: 'InProgress_EmailT5_Sent',
    appfolioStatus: 'Contacted',
    outreach: [
      {
        channel: 'email',
        contactId: 'CONT-BRADFORD-1',
        recipient: 'sdelacroix@bradfordplacehoa.com',
        subject: 'BiAnnual PM for Bradford Place Townhomes',
        body:
          'Hi Simone,\n\nYour BiAnnual maintenance visit is due around May 4. Reply with a date that works (we know weekends are reserved for community events).\n\n— Kestrel Property Management',
        sentAt: '2026-04-24T13:30:00.000Z',
      },
      {
        channel: 'email',
        contactId: 'CONT-BRADFORD-1',
        recipient: 'sdelacroix@bradfordplacehoa.com',
        subject: 'Re: BiAnnual PM for Bradford Place Townhomes',
        body: "Hi Simone,\n\nQuick nudge — let us know a date and we'll lock it in.\n\n— Kestrel Property Management",
        sentAt: '2026-04-29T13:30:00.000Z',
      },
    ],
    replies: [],
    logs: [
      {
        ts: '2026-04-24T13:30:01.000Z',
        level: 'success',
        line: 'Email T-10 sent to sdelacroix@bradfordplacehoa.com.',
      },
      {
        ts: '2026-04-29T13:30:00.000Z',
        level: 'info',
        line: 'No reply after T-10. Sending T-5 follow-up…',
      },
      { ts: '2026-04-29T13:30:01.000Z', level: 'success', line: 'Email T-5 sent.' },
    ],
    transitions: [
      { from: null, to: 'Upcoming', reason: 'Ingested', at: '2026-04-24T13:00:00.000Z' },
      {
        from: 'Upcoming',
        to: 'InProgress_EmailT10_Sent',
        reason: 'Email T-10 sent',
        at: '2026-04-24T13:30:01.000Z',
      },
      {
        from: 'InProgress_EmailT10_Sent',
        to: 'InProgress_EmailT5_Sent',
        reason: 'No reply — escalated to T-5 email',
        at: '2026-04-29T13:30:01.000Z',
      },
    ],
  },

  // ---- 8a. AWAITING HUMAN · Voice IVR success (contact pressed 1 + spoke a date) ----
  {
    customerId: 'CUST-OAKMONT',
    customerName: 'Oakmont Manor',
    locationId: 'LOC-OAKMONT-MAIN',
    city: 'Raleigh',
    state: 'NC',
    zip: '27608',
    street: '2120 Fairview Rd',
    serviceZone: 'NC01',
    primaryPhone: '(919) 555-0390',
    primaryEmail: undefined,
    contacts: [
      {
        id: 'CONT-OAKMONT-1',
        name: 'Front desk',
        role: 'On-site Front Desk',
        roleRank: 50,
        phone: '(919) 555-0390',
        lineType: 'landline',
        isPrimary: true,
      },
    ],
    equipment: [
      {
        id: 'EQ-OAKMONT-1',
        itemName: 'Bryant macro 559J',
        itemDescription: 'Bryant 4-ton rooftop unit (community room)',
      },
    ],
    recurringServiceId: 'RS-OAKMONT-ANNUAL',
    recurringServiceName: 'Annual PM',
    cadence: 'annual',
    jobSummary:
      'Annual PM — small residential building. Landline only, no email on file. Whoever answers the front desk can take the date.',
    rseId: 'RSE-OAKMONT-2026-05',
    dueDate: '2026-05-01',
    agentState: 'AwaitingHuman_DateProposed',
    appfolioStatus: 'Contacted',
    outreach: [
      {
        channel: 'voice',
        contactId: 'CONT-OAKMONT-1',
        recipient: '(919) 555-0390',
        body:
          'IVR transcript:\n\n[Kestrel Property Management]: "This is a courtesy call from Kestrel Property Management about scheduled maintenance at your building. Press 1 to request a date. Press 2 to have a booking link emailed to you."\n\n[Contact pressed 1]\n\n[Kestrel Property Management]: "Please leave your preferred service date after the tone."\n\n[Contact]: "Next Tuesday after 1pm works, just need a couple hours notice so we can let the tech into the unit."\n\n[Call ended · 47 seconds]',
        sentAt: '2026-04-30T11:00:00.000Z',
      },
    ],
    replies: [
      {
        channel: 'voice-keypress',
        contactId: 'CONT-OAKMONT-1',
        fromAddress: '(919) 555-0390',
        rawText: 'Next Tuesday after 1pm works, just need a couple hours notice so we can let the tech into the unit.',
        classification: 'proposed-date',
        parsedDate: '2026-05-05',
        llmConfidence: 0.91,
        receivedAt: '2026-04-30T11:00:45.000Z',
      },
    ],
    logs: [
      {
        ts: '2026-04-21T13:30:01.000Z',
        level: 'info',
        line: 'Twilio Lookup: line type = landline. No email on contact record.',
      },
      {
        ts: '2026-04-21T13:30:02.000Z',
        level: 'info',
        line: 'Email T-10 skipped — no email address. SMS T-5 skipped — landline. Routing direct to T-0 voice IVR.',
      },
      {
        ts: '2026-04-30T11:00:00.000Z',
        level: 'info',
        line: 'Placing voice IVR call to (919) 555-0390…',
      },
      {
        ts: '2026-04-30T11:00:12.000Z',
        level: 'success',
        line: 'IVR keypress 1 detected — contact requested a date.',
      },
      {
        ts: '2026-04-30T11:00:45.000Z',
        level: 'success',
        line: 'IVR transcript captured. Contact said "Next Tuesday after 1pm".',
      },
      {
        ts: '2026-04-30T11:00:46.000Z',
        level: 'info',
        line: 'SoTA extraction: 2026-05-05 (after 1pm).',
      },
    ],
    transitions: [
      { from: null, to: 'Upcoming', reason: 'Ingested', at: '2026-04-21T13:00:00.000Z' },
      {
        from: 'Upcoming',
        to: 'InProgress_VoiceT0_Attempted',
        reason: 'Landline-only — routed direct to voice IVR',
        at: '2026-04-30T11:00:00.000Z',
      },
      {
        from: 'InProgress_VoiceT0_Attempted',
        to: 'AwaitingHuman_DateProposed',
        reason: 'IVR keypress + spoken date captured: 2026-05-05',
        at: '2026-04-30T11:00:46.000Z',
      },
    ],
  },

  // ---- 8b. IN-PROGRESS · Voice IVR attempted (no-keypress fallback) ----
  {
    customerId: 'CUST-WESTGATE',
    customerName: 'Westgate Plaza',
    locationId: 'LOC-WESTGATE-MAIN',
    city: 'Durham',
    state: 'NC',
    zip: '27707',
    street: '6903 Garrett Rd',
    serviceZone: 'NC02',
    primaryPhone: '(984) 555-0275',
    primaryEmail: undefined,
    contacts: [
      {
        id: 'CONT-WESTGATE-1',
        name: 'Management office',
        role: 'On-site Office',
        roleRank: 60,
        phone: '(984) 555-0275',
        lineType: 'landline',
        isPrimary: true,
      },
    ],
    equipment: [
      {
        id: 'EQ-WESTGATE-1',
        itemName: 'York ZF078',
        itemDescription: 'York 6.5-ton rooftop unit (retail strip common area)',
      },
    ],
    recurringServiceId: 'RS-WESTGATE-QUARTERLY',
    recurringServiceName: 'Quarterly PM',
    cadence: 'quarterly',
    jobSummary:
      'Quarterly PM — retail strip common area. No email on file; landline only. Ask for whoever is in the office.',
    rseId: 'RSE-WESTGATE-2026-05',
    dueDate: '2026-05-01',
    agentState: 'InProgress_VoiceT0_Attempted',
    appfolioStatus: 'Unreachable',
    outreach: [
      {
        channel: 'voice',
        contactId: 'CONT-WESTGATE-1',
        recipient: '(984) 555-0275',
        body:
          'IVR script: "This is a courtesy call from Kestrel Property Management about scheduled maintenance at your building. Press 1 to request a date. Press 2 to have a booking link emailed to you." (No keypress detected — call ended after 28 seconds.)',
        sentAt: '2026-04-29T15:00:00.000Z',
      },
    ],
    replies: [],
    logs: [
      {
        ts: '2026-04-21T13:30:01.000Z',
        level: 'info',
        line: 'Twilio Lookup: line type = landline. No email on contact record.',
      },
      {
        ts: '2026-04-21T13:30:02.000Z',
        level: 'info',
        line: 'Email T-10 skipped — no email address. SMS T-5 skipped — landline. Routing direct to T-0 voice IVR.',
      },
      {
        ts: '2026-04-29T15:00:00.000Z',
        level: 'info',
        line: 'Placing voice IVR call to (984) 555-0275…',
      },
      {
        ts: '2026-04-29T15:00:28.000Z',
        level: 'warn',
        line: 'Call ended without keypress. Awaiting potential return contact.',
      },
    ],
    transitions: [
      { from: null, to: 'Upcoming', reason: 'Ingested', at: '2026-04-21T13:00:00.000Z' },
      {
        from: 'Upcoming',
        to: 'InProgress_VoiceT0_Attempted',
        reason: 'Landline-only — routed direct to voice IVR',
        at: '2026-04-29T15:00:01.000Z',
      },
    ],
  },

  // ---- 9. AWAITING HUMAN · Date proposed (multi-contact, Beacon Ridge) ----
  {
    customerId: 'CUST-BEACON',
    customerName: 'Beacon Ridge Community',
    locationId: 'LOC-BEACON-MAIN',
    locationName: 'Beacon Ridge Condominiums',
    city: 'Raleigh',
    state: 'NC',
    zip: '27612',
    street: '4530 Lake Boone Trl',
    serviceZone: 'NC03',
    primaryPhone: '(919) 555-0300',
    primaryEmail: 'facilities@beaconridgehoa.com',
    contacts: [
      {
        id: 'CONT-BEACON-BOARD',
        name: 'Yvette Castellanos',
        role: 'HOA Board President',
        roleRank: 90,
        phone: '(984) 555-0154',
        email: 'ycastellanos@beaconridgehoa.com',
        lineType: 'mobile',
        isPrimary: false,
      },
      {
        id: 'CONT-BEACON-FAC',
        name: 'Owen Prescott',
        role: 'Facilities Director',
        roleRank: 5,
        phone: '(919) 555-0411',
        email: 'owen.prescott@beaconridgehoa.com',
        lineType: 'mobile',
        isPrimary: true,
      },
      {
        id: 'CONT-BEACON-OFF',
        name: 'Marla Quinn',
        role: 'Community Office Manager',
        roleRank: 30,
        phone: '(919) 555-0307',
        email: 'marla.quinn@beaconridgehoa.com',
        lineType: 'landline',
        isPrimary: false,
      },
    ],
    equipment: [
      {
        id: 'EQ-BEACON-1',
        itemName: 'Carrier 48TCED07',
        itemDescription: 'Carrier 6-ton rooftop unit (Building C clubhouse)',
      },
      {
        id: 'EQ-BEACON-2',
        itemName: 'Weil-McLain CGa-5',
        itemDescription: 'Building B hydronic boiler',
      },
      {
        id: 'EQ-BEACON-3',
        itemName: 'Rheem RP1442',
        itemDescription: 'Building A pool-house heat pump',
      },
      {
        id: 'EQ-BEACON-4',
        itemName: 'AO Smith BTH-150',
        itemDescription: 'Clubhouse commercial water heater',
      },
    ],
    recurringServiceId: 'RS-BEACON-QUARTERLY',
    recurringServiceName: 'Quarterly PM',
    cadence: 'quarterly',
    jobSummary:
      'Quarterly PM — multi-building community. 4+ units across the property. Coordinate with facilities team for after-hours building access.',
    rseId: 'RSE-BEACON-2026-05',
    dueDate: '2026-05-03',
    agentState: 'AwaitingHuman_DateProposed',
    appfolioStatus: 'Contacted',
    outreach: [
      {
        channel: 'email',
        contactId: 'CONT-BEACON-FAC',
        recipient: 'owen.prescott@beaconridgehoa.com',
        subject: 'Quarterly PM for Beacon Ridge Community — let us know what date works',
        body:
          'Hi Owen,\n\nYour Quarterly PM covering 4 units (Building C clubhouse, Building B boiler, Building A pool house, clubhouse water heater) is due around May 3. Reply with a date that works.\n\n— Kestrel Property Management',
        sentAt: '2026-04-23T13:30:00.000Z',
      },
      {
        channel: 'email',
        contactId: 'CONT-BEACON-OFF',
        recipient: 'marla.quinn@beaconridgehoa.com',
        subject: 'Quarterly PM for Beacon Ridge Community — let us know what date works',
        body: 'Hi Marla,\n\nSame as above — looping in the community office.\n\n— Kestrel Property Management',
        sentAt: '2026-04-23T13:30:01.000Z',
      },
    ],
    replies: [
      {
        channel: 'email',
        contactId: 'CONT-BEACON-FAC',
        fromAddress: 'owen.prescott@beaconridgehoa.com',
        rawText:
          "Tuesday May 5 in the afternoon works for me — after 1pm. Need to coordinate with the on-site team for Building C access so let me know what time you're starting.",
        classification: 'proposed-date',
        parsedDate: '2026-05-05',
        llmConfidence: 0.92,
        receivedAt: '2026-04-28T18:42:00.000Z',
      },
    ],
    logs: [
      {
        ts: '2026-04-21T13:00:00.000Z',
        level: 'info',
        line: 'Adapter 1 enabled — fetched 3 contacts via /api/v2/properties/{id}/contacts.',
      },
      {
        ts: '2026-04-21T13:00:01.000Z',
        level: 'info',
        line: 'Role-ranked contacts: Owen Prescott (Facilities, rank 5) → Marla Quinn (Office, 30) → Yvette Castellanos (Board President, 90, deprioritized).',
      },
      {
        ts: '2026-04-23T13:30:01.000Z',
        level: 'success',
        line: 'Email T-10 fan-out: 2 emails sent (Owen + Marla).',
      },
      {
        ts: '2026-04-28T18:42:00.000Z',
        level: 'success',
        line: 'Inbound email from owen.prescott@beaconridgehoa.com.',
      },
      {
        ts: '2026-04-28T18:42:01.000Z',
        level: 'info',
        line: 'Lightweight LLM classified reply as proposed-date. SoTA extraction: 2026-05-05 (after 1pm).',
      },
      {
        ts: '2026-04-28T18:42:02.000Z',
        level: 'info',
        line: 'Cancelling remaining outreach to Marla. Routing to human.',
      },
    ],
    transitions: [
      { from: null, to: 'Upcoming', reason: 'Ingested', at: '2026-04-21T13:00:00.000Z' },
      {
        from: 'Upcoming',
        to: 'InProgress_EmailT10_Sent',
        reason: 'Email T-10 fan-out',
        at: '2026-04-23T13:30:01.000Z',
      },
      {
        from: 'InProgress_EmailT10_Sent',
        to: 'AwaitingHuman_DateProposed',
        reason: 'Contact proposed 2026-05-05',
        at: '2026-04-28T18:42:02.000Z',
      },
    ],
  },

  // ---- 10. AWAITING HUMAN · Date proposed ----
  {
    customerId: 'CUST-MAGNOLIA',
    customerName: 'Magnolia Grove Apartments',
    locationId: 'LOC-MAGNOLIA-MAIN',
    city: 'Chapel Hill',
    state: 'NC',
    zip: '27514',
    street: '1340 Magnolia Dr',
    serviceZone: 'NC03',
    primaryPhone: '(919) 555-0500',
    primaryEmail: 'maintenance@magnoliagroveapts.com',
    contacts: [
      {
        id: 'CONT-MAGNOLIA-1',
        name: 'Desmond Pryor',
        role: 'Maintenance Lead',
        roleRank: 5,
        phone: '(919) 555-0518',
        email: 'dpryor@magnoliagroveapts.com',
        lineType: 'mobile',
        isPrimary: true,
      },
    ],
    equipment: [
      {
        id: 'EQ-MAGNOLIA-1',
        itemName: 'Trane XR14-048',
        itemDescription: 'Trane 4-ton condenser (Building 1)',
      },
      {
        id: 'EQ-MAGNOLIA-2',
        itemName: 'Trane XR14-036',
        itemDescription: 'Trane 3-ton condenser (Building 2)',
      },
    ],
    recurringServiceId: 'RS-MAGNOLIA-QUARTERLY',
    recurringServiceName: 'Quarterly PM',
    cadence: 'quarterly',
    jobSummary: 'Quarterly PM — two residential buildings. Desmond owns the schedule.',
    rseId: 'RSE-MAGNOLIA-2026-05',
    dueDate: '2026-05-01',
    agentState: 'AwaitingHuman_DateProposed',
    appfolioStatus: 'Contacted',
    outreach: [
      {
        channel: 'email',
        contactId: 'CONT-MAGNOLIA-1',
        recipient: 'dpryor@magnoliagroveapts.com',
        subject: 'Quarterly PM for Magnolia Grove Apartments — let us know what date works',
        body:
          'Hi Desmond,\n\nYour Quarterly maintenance visit is due around May 1 (Buildings 1 and 2). Reply with a date.\n\n— Kestrel Property Management',
        sentAt: '2026-04-21T13:30:00.000Z',
      },
    ],
    replies: [
      {
        channel: 'email',
        contactId: 'CONT-MAGNOLIA-1',
        fromAddress: 'dpryor@magnoliagroveapts.com',
        rawText:
          "How's Wednesday May 7? Morning preferred, before most residents head out for the day.",
        classification: 'proposed-date',
        parsedDate: '2026-05-07',
        llmConfidence: 0.95,
        receivedAt: '2026-04-27T11:15:00.000Z',
      },
    ],
    logs: [
      {
        ts: '2026-04-21T13:30:01.000Z',
        level: 'success',
        line: 'Email T-10 sent to dpryor@magnoliagroveapts.com.',
      },
      {
        ts: '2026-04-27T11:15:00.000Z',
        level: 'success',
        line: 'Inbound email from dpryor@magnoliagroveapts.com.',
      },
      {
        ts: '2026-04-27T11:15:01.000Z',
        level: 'info',
        line: 'Classified as proposed-date. Extracted: 2026-05-07 (morning).',
      },
    ],
    transitions: [
      { from: null, to: 'Upcoming', reason: 'Ingested', at: '2026-04-21T13:00:00.000Z' },
      {
        from: 'Upcoming',
        to: 'InProgress_EmailT10_Sent',
        reason: 'Email T-10 sent',
        at: '2026-04-21T13:30:01.000Z',
      },
      {
        from: 'InProgress_EmailT10_Sent',
        to: 'AwaitingHuman_DateProposed',
        reason: 'Contact proposed 2026-05-07',
        at: '2026-04-27T11:15:01.000Z',
      },
    ],
  },

  // ---- 11. AWAITING HUMAN · Ambiguous reply ----
  {
    customerId: 'CUST-STONEBRIDGE',
    customerName: 'Stonebridge Offices',
    locationId: 'LOC-STONEBRIDGE-MAIN',
    city: 'Raleigh',
    state: 'NC',
    zip: '27609',
    street: '6750 Six Forks Rd Ste 300',
    serviceZone: 'NC01',
    primaryPhone: '(919) 555-0400',
    primaryEmail: 'office@stonebridgeoffices.com',
    contacts: [
      {
        id: 'CONT-STONEBRIDGE-1',
        name: 'Bianca Sorrel',
        role: 'Office Manager',
        roleRank: 20,
        phone: '(919) 555-0412',
        email: 'bsorrel@stonebridgeoffices.com',
        lineType: 'mobile',
        isPrimary: true,
      },
    ],
    equipment: [
      {
        id: 'EQ-STONEBRIDGE-1',
        itemName: 'Daikin DZ14SA-036',
        itemDescription: 'Daikin 3-ton condenser (executive suite)',
      },
    ],
    recurringServiceId: 'RS-STONEBRIDGE-ANNUAL',
    recurringServiceName: 'Annual PM',
    cadence: 'annual',
    jobSummary: 'Annual PM — executive suite. After-hours access preferred.',
    rseId: 'RSE-STONEBRIDGE-2026-05',
    dueDate: '2026-05-04',
    agentState: 'AwaitingHuman_AmbiguousReply',
    appfolioStatus: 'Contacted',
    outreach: [
      {
        channel: 'email',
        contactId: 'CONT-STONEBRIDGE-1',
        recipient: 'bsorrel@stonebridgeoffices.com',
        subject: 'Annual PM for Stonebridge Offices',
        body: 'Hi Bianca,\n\nAnnual maintenance visit due around May 4. After-hours window?\n\n— Kestrel Property Management',
        sentAt: '2026-04-24T13:30:00.000Z',
      },
    ],
    replies: [
      {
        channel: 'email',
        contactId: 'CONT-STONEBRIDGE-1',
        fromAddress: 'bsorrel@stonebridgeoffices.com',
        rawText:
          "Sounds good — whenever y'all have availability. Just let me know what day and time and I'll make sure the suite's open.",
        classification: 'proposed-date',
        parsedDate: undefined,
        llmConfidence: 0.41,
        receivedAt: '2026-04-28T16:05:00.000Z',
      },
    ],
    logs: [
      {
        ts: '2026-04-24T13:30:01.000Z',
        level: 'success',
        line: 'Email T-10 sent to bsorrel@stonebridgeoffices.com.',
      },
      {
        ts: '2026-04-28T16:05:00.000Z',
        level: 'success',
        line: 'Inbound email from bsorrel@stonebridgeoffices.com.',
      },
      {
        ts: '2026-04-28T16:05:01.000Z',
        level: 'warn',
        line: 'Date intent ambiguous ("whenever y\'all have availability"). Routing to human for clarification.',
      },
    ],
    transitions: [
      { from: null, to: 'Upcoming', reason: 'Ingested', at: '2026-04-24T13:00:00.000Z' },
      {
        from: 'Upcoming',
        to: 'InProgress_EmailT10_Sent',
        reason: 'Email T-10 sent',
        at: '2026-04-24T13:30:01.000Z',
      },
      {
        from: 'InProgress_EmailT10_Sent',
        to: 'AwaitingHuman_AmbiguousReply',
        reason: 'Date intent unclear',
        at: '2026-04-28T16:05:01.000Z',
      },
    ],
  },

  // ---- 12. AWAITING HUMAN · Question ----
  {
    customerId: 'CUST-PARKSIDE',
    customerName: 'Parkside Residences',
    locationId: 'LOC-PARKSIDE-MAIN',
    city: 'Cary',
    state: 'NC',
    zip: '27519',
    street: '140 Crescent Green Dr',
    serviceZone: 'NC03',
    primaryPhone: '(919) 555-0600',
    primaryEmail: 'office@parksideresidences.com',
    contacts: [
      {
        id: 'CONT-PARKSIDE-1',
        name: 'Neil Ashby',
        role: 'Assistant Property Manager',
        roleRank: 25,
        phone: '(919) 555-0615',
        email: 'nashby@parksideresidences.com',
        lineType: 'mobile',
        isPrimary: true,
      },
    ],
    equipment: [
      {
        id: 'EQ-PARKSIDE-1',
        itemName: 'Carrier 48TCED05',
        itemDescription: 'Carrier 4-ton rooftop unit (leasing office)',
      },
    ],
    recurringServiceId: 'RS-PARKSIDE-BIANNUAL',
    recurringServiceName: 'BiAnnual PM',
    cadence: 'biannual',
    jobSummary: 'BiAnnual PM — leasing office rooftop unit. Neil handles vendor scheduling.',
    rseId: 'RSE-PARKSIDE-2026-05',
    dueDate: '2026-05-06',
    agentState: 'AwaitingHuman_Question',
    appfolioStatus: 'Contacted',
    outreach: [
      {
        channel: 'email',
        contactId: 'CONT-PARKSIDE-1',
        recipient: 'nashby@parksideresidences.com',
        subject: 'BiAnnual PM for Parkside Residences',
        body: 'Hi Neil,\n\nBiAnnual maintenance visit due around May 6.\n\n— Kestrel Property Management',
        sentAt: '2026-04-26T13:30:00.000Z',
      },
    ],
    replies: [
      {
        channel: 'email',
        contactId: 'CONT-PARKSIDE-1',
        fromAddress: 'nashby@parksideresidences.com',
        rawText:
          'Hey — quick question before I schedule: is the BiAnnual covered under our management agreement, or billed separately to the association? Want to confirm before I loop in the board.',
        classification: 'question',
        llmConfidence: 0.88,
        receivedAt: '2026-04-29T10:22:00.000Z',
      },
    ],
    logs: [
      {
        ts: '2026-04-26T13:30:01.000Z',
        level: 'success',
        line: 'Email T-10 sent to nashby@parksideresidences.com.',
      },
      {
        ts: '2026-04-29T10:22:00.000Z',
        level: 'success',
        line: 'Inbound email from nashby@parksideresidences.com.',
      },
      {
        ts: '2026-04-29T10:22:01.000Z',
        level: 'info',
        line: 'Classified as question. FAQ-in-thread is Phase 2 — routing to human for manual reply.',
      },
    ],
    transitions: [
      { from: null, to: 'Upcoming', reason: 'Ingested', at: '2026-04-26T13:00:00.000Z' },
      {
        from: 'Upcoming',
        to: 'InProgress_EmailT10_Sent',
        reason: 'Email T-10 sent',
        at: '2026-04-26T13:30:01.000Z',
      },
      {
        from: 'InProgress_EmailT10_Sent',
        to: 'AwaitingHuman_Question',
        reason: 'Contact asked a question — FAQ deferred to Phase 2',
        at: '2026-04-29T10:22:01.000Z',
      },
    ],
  },

  // ---- 13. ESCALATED · all channels exhausted ----
  {
    customerId: 'CUST-ASHFORD',
    customerName: 'Ashford Place Condos',
    locationId: 'LOC-ASHFORD-MAIN',
    city: 'Durham',
    state: 'NC',
    zip: '27705',
    street: '926 Ninth St',
    serviceZone: 'NC02',
    primaryPhone: '(984) 555-0685',
    primaryEmail: 'info@ashfordplacecondos.com',
    contacts: [
      {
        id: 'CONT-ASHFORD-1',
        name: 'Talia Okafor',
        role: 'Community Operations',
        roleRank: 15,
        phone: '(984) 555-0691',
        email: 'tokafor@ashfordplacecondos.com',
        lineType: 'mobile',
        isPrimary: true,
      },
    ],
    equipment: [
      {
        id: 'EQ-ASHFORD-1',
        itemName: 'Carrier 48TCED05',
        itemDescription: 'Carrier 4-ton rooftop unit (clubhouse)',
      },
    ],
    recurringServiceId: 'RS-ASHFORD-ANNUAL',
    recurringServiceName: 'Annual PM',
    cadence: 'annual',
    jobSummary: 'Annual PM — clubhouse rooftop unit. Talia handles operations.',
    rseId: 'RSE-ASHFORD-2026-05',
    dueDate: '2026-05-01',
    agentState: 'Escalated',
    appfolioStatus: 'Unreachable',
    outreach: [
      {
        channel: 'email',
        contactId: 'CONT-ASHFORD-1',
        recipient: 'tokafor@ashfordplacecondos.com',
        subject: 'Annual PM for Ashford Place Condos',
        body: 'Hi Talia,\n\nAnnual maintenance visit due around May 1.\n\n— Kestrel Property Management',
        sentAt: '2026-04-21T13:30:00.000Z',
      },
      {
        channel: 'email',
        contactId: 'CONT-ASHFORD-1',
        recipient: 'tokafor@ashfordplacecondos.com',
        subject: 'Re: Annual PM for Ashford Place Condos',
        body: "Hi Talia,\n\nFollowing up — let us know a day that works.\n\n— Kestrel Property Management",
        sentAt: '2026-04-26T13:30:00.000Z',
      },
      {
        channel: 'voice',
        contactId: 'CONT-ASHFORD-1',
        recipient: '(984) 555-0691',
        body: 'IVR script played. No keypress. Voicemail not engaged (ring-out).',
        sentAt: '2026-04-30T10:00:00.000Z',
      },
    ],
    replies: [],
    logs: [
      { ts: '2026-04-21T13:30:01.000Z', level: 'success', line: 'Email T-10 sent.' },
      { ts: '2026-04-26T13:30:01.000Z', level: 'success', line: 'Email T-5 sent.' },
      {
        ts: '2026-04-30T10:00:00.000Z',
        level: 'info',
        line: 'Placing voice IVR call to (984) 555-0691…',
      },
      {
        ts: '2026-04-30T10:00:30.000Z',
        level: 'warn',
        line: 'Call ended without keypress. All channels exhausted — escalating to Coordinator.',
      },
    ],
    transitions: [
      { from: null, to: 'Upcoming', reason: 'Ingested', at: '2026-04-21T13:00:00.000Z' },
      {
        from: 'Upcoming',
        to: 'InProgress_EmailT10_Sent',
        reason: 'Email T-10 sent',
        at: '2026-04-21T13:30:01.000Z',
      },
      {
        from: 'InProgress_EmailT10_Sent',
        to: 'InProgress_EmailT5_Sent',
        reason: 'No reply',
        at: '2026-04-26T13:30:01.000Z',
      },
      {
        from: 'InProgress_EmailT5_Sent',
        to: 'InProgress_VoiceT0_Attempted',
        reason: 'No reply',
        at: '2026-04-30T10:00:01.000Z',
      },
      {
        from: 'InProgress_VoiceT0_Attempted',
        to: 'Escalated',
        reason: 'All channels exhausted',
        at: '2026-04-30T10:00:30.000Z',
      },
    ],
  },

  // ---- 14. CLOSED · Booked ----
  {
    customerId: 'CUST-RIVERSIDE',
    customerName: 'Riverside Commons',
    locationId: 'LOC-RIVERSIDE-MAIN',
    locationName: 'Riverside Commons Community Center',
    city: 'Raleigh',
    state: 'NC',
    zip: '27610',
    street: '3030 New Bern Ave',
    serviceZone: 'NC01',
    primaryPhone: '(919) 555-0700',
    primaryEmail: 'facilities@riversidecommons.com',
    contacts: [
      {
        id: 'CONT-RIVERSIDE-1',
        name: 'Emilio Vargas',
        role: 'Building Services',
        roleRank: 10,
        phone: '(919) 555-0733',
        email: 'evargas@riversidecommons.com',
        lineType: 'mobile',
        isPrimary: true,
      },
    ],
    equipment: [
      {
        id: 'EQ-RIVERSIDE-1',
        itemName: 'Trane XR16-060',
        itemDescription: 'Trane 5-ton condenser (community center)',
      },
    ],
    recurringServiceId: 'RS-RIVERSIDE-ANNUAL',
    recurringServiceName: 'Annual PM',
    cadence: 'annual',
    jobSummary: 'Annual PM — community center HVAC.',
    rseId: 'RSE-RIVERSIDE-2026-05',
    dueDate: '2026-05-01',
    agentState: 'Closed_Booked',
    appfolioStatus: 'Booked',
    outreach: [
      {
        channel: 'email',
        contactId: 'CONT-RIVERSIDE-1',
        recipient: 'evargas@riversidecommons.com',
        subject: 'Annual PM for Riverside Commons',
        body: 'Hi Emilio,\n\nAnnual maintenance visit due around May 1.\n\n— Kestrel Property Management',
        sentAt: '2026-04-21T13:30:00.000Z',
      },
    ],
    replies: [
      {
        channel: 'email',
        contactId: 'CONT-RIVERSIDE-1',
        fromAddress: 'evargas@riversidecommons.com',
        rawText: 'Friday May 1 in the morning works. 9-11am window, I\'ll prop the mechanical room.',
        classification: 'proposed-date',
        parsedDate: '2026-05-01',
        llmConfidence: 0.97,
        receivedAt: '2026-04-25T09:18:00.000Z',
      },
    ],
    logs: [
      { ts: '2026-04-21T13:30:01.000Z', level: 'success', line: 'Email T-10 sent.' },
      {
        ts: '2026-04-25T09:18:00.000Z',
        level: 'success',
        line: 'Inbound email — proposed 2026-05-01.',
      },
      {
        ts: '2026-04-26T08:30:00.000Z',
        level: 'success',
        line: 'Coordinator marked as booked in AppFolio.',
      },
    ],
    transitions: [
      { from: null, to: 'Upcoming', reason: 'Ingested', at: '2026-04-21T13:00:00.000Z' },
      {
        from: 'Upcoming',
        to: 'InProgress_EmailT10_Sent',
        reason: 'Email T-10 sent',
        at: '2026-04-21T13:30:01.000Z',
      },
      {
        from: 'InProgress_EmailT10_Sent',
        to: 'AwaitingHuman_DateProposed',
        reason: 'Contact proposed 2026-05-01',
        at: '2026-04-25T09:18:01.000Z',
      },
      {
        from: 'AwaitingHuman_DateProposed',
        to: 'Closed_Booked',
        reason: 'Coordinator confirmed booking',
        at: '2026-04-26T08:30:00.000Z',
      },
    ],
  },

  // ---- 15. CLOSED · Opted out ----
  {
    customerId: 'CUST-BROOKHAVEN',
    customerName: 'Brookhaven Flats',
    locationId: 'LOC-BROOKHAVEN-MAIN',
    city: 'Garner',
    state: 'NC',
    zip: '27529',
    street: '155 Timber Dr',
    serviceZone: 'NC02',
    primaryPhone: '(919) 555-0800',
    primaryEmail: 'manager@brookhavenflats.com',
    contacts: [
      {
        id: 'CONT-BROOKHAVEN-1',
        name: 'Priscilla Tan',
        role: 'Property Manager',
        roleRank: 5,
        phone: '(919) 555-0807',
        email: 'priscilla@brookhavenflats.com',
        lineType: 'mobile',
        isPrimary: true,
      },
    ],
    equipment: [
      {
        id: 'EQ-BROOKHAVEN-1',
        itemName: 'Goodman GSXC18-042',
        itemDescription: 'Goodman 3.5-ton condenser (Building 1)',
      },
    ],
    recurringServiceId: 'RS-BROOKHAVEN-MONTHLY',
    recurringServiceName: 'Monthly PM',
    cadence: 'monthly',
    jobSummary: 'Monthly PM — small residential building.',
    rseId: 'RSE-BROOKHAVEN-2026-05',
    dueDate: '2026-05-01',
    agentState: 'Closed_OptedOut',
    appfolioStatus: 'Not Attempted',
    outreach: [
      {
        channel: 'email',
        contactId: 'CONT-BROOKHAVEN-1',
        recipient: 'priscilla@brookhavenflats.com',
        subject: 'Monthly PM for Brookhaven Flats',
        body: 'Hi Priscilla,\n\nMonthly maintenance visit due around May 1.\n\n— Kestrel Property Management',
        sentAt: '2026-04-21T13:30:00.000Z',
      },
    ],
    replies: [
      {
        channel: 'email',
        contactId: 'CONT-BROOKHAVEN-1',
        fromAddress: 'priscilla@brookhavenflats.com',
        rawText:
          "Please remove us from the recurring schedule — the property changed management companies last month. The new manager can reach out if they want to continue.",
        classification: 'opt-out',
        llmConfidence: 0.96,
        receivedAt: '2026-04-24T17:32:00.000Z',
      },
    ],
    logs: [
      { ts: '2026-04-21T13:30:01.000Z', level: 'success', line: 'Email T-10 sent.' },
      {
        ts: '2026-04-24T17:32:00.000Z',
        level: 'success',
        line: 'Inbound email from priscilla@brookhavenflats.com.',
      },
      {
        ts: '2026-04-24T17:32:01.000Z',
        level: 'info',
        line: 'Classified as opt-out (96%). Stopping outreach. Coordinator notified.',
      },
    ],
    transitions: [
      { from: null, to: 'Upcoming', reason: 'Ingested', at: '2026-04-21T13:00:00.000Z' },
      {
        from: 'Upcoming',
        to: 'InProgress_EmailT10_Sent',
        reason: 'Email T-10 sent',
        at: '2026-04-21T13:30:01.000Z',
      },
      {
        from: 'InProgress_EmailT10_Sent',
        to: 'Closed_OptedOut',
        reason: 'Contact opted out',
        at: '2026-04-24T17:32:01.000Z',
      },
    ],
  },
]

// ============================================================
//  SEED INSERT — wraps everything in a single transaction
// ============================================================

export function runSeed() {
  const tx = db.transaction(() => {
    // Wipe existing rows. CASCADE handles children.
    db.prepare('DELETE FROM customers').run()
    db.prepare('DELETE FROM agent_logs').run() // detached after CASCADE; defensive
    db.prepare('DELETE FROM agent_runs').run()
    db.prepare('DELETE FROM outreach_attempts').run()
    db.prepare('DELETE FROM inbound_replies').run()
    db.prepare('DELETE FROM state_transitions').run()
    db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('agent_logs','agent_runs','outreach_attempts','inbound_replies','state_transitions')").run()

    const insCustomer = db.prepare(`
      INSERT INTO customers (id, name, primary_phone, primary_email, address_street, address_city, address_state, address_zip)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const insLocation = db.prepare(`
      INSERT INTO locations (id, customer_id, name, primary_phone, primary_email, address_street, address_city, address_state, address_zip, service_zone, business_unit)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const insContact = db.prepare(`
      INSERT INTO contacts (id, location_id, name, role, role_rank, phone, email, line_type, do_not_text, do_not_email, do_not_call, is_primary)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const insEquipment = db.prepare(`
      INSERT INTO equipment (id, location_id, item_name, item_description) VALUES (?, ?, ?, ?)
    `)
    const insRecurringService = db.prepare(`
      INSERT INTO recurring_services (id, location_id, name, cadence, job_summary, membership_status)
      VALUES (?, ?, ?, ?, ?, 'Active')
    `)
    const insRse = db.prepare(`
      INSERT INTO recurring_service_events (id, recurring_service_id, due_date, state, ingested_at_iso, ingested_via_adapter, appfolio_status, booking_availability)
      VALUES (?, ?, ?, ?, ?, 'adapter2a', ?, 'Not Bookable')
    `)
    const insOutreach = db.prepare(`
      INSERT INTO outreach_attempts (rse_id, channel, contact_id, recipient, subject, body_text, sent_at_demo_clock, intercepted)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `)
    const insReply = db.prepare(`
      INSERT INTO inbound_replies (rse_id, channel, contact_id, from_address, raw_text, classification, parsed_date, llm_confidence, received_at_demo_clock)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const insLog = db.prepare(`
      INSERT INTO agent_logs (rse_id, ts_demo_clock, level, line) VALUES (?, ?, ?, ?)
    `)
    const insTransition = db.prepare(`
      INSERT INTO state_transitions (rse_id, from_state, to_state, reason, at_demo_clock) VALUES (?, ?, ?, ?, ?)
    `)

    for (const j of JOBS) {
      insCustomer.run(
        j.customerId,
        j.customerName,
        j.primaryPhone ?? null,
        j.primaryEmail ?? null,
        j.street,
        j.city,
        j.state,
        j.zip,
      )
      insLocation.run(
        j.locationId,
        j.customerId,
        j.locationName ?? j.customerName,
        j.primaryPhone ?? null,
        j.primaryEmail ?? null,
        j.street,
        j.city,
        j.state,
        j.zip,
        j.serviceZone,
        'PM',
      )
      for (const c of j.contacts) {
        insContact.run(
          c.id,
          j.locationId,
          c.name,
          c.role ?? null,
          c.roleRank,
          c.phone ?? null,
          c.email ?? null,
          c.lineType ?? null,
          c.doNotText ? 1 : 0,
          c.doNotEmail ? 1 : 0,
          c.doNotCall ? 1 : 0,
          c.isPrimary ? 1 : 0,
        )
      }
      for (const e of j.equipment) {
        insEquipment.run(e.id, j.locationId, e.itemName, e.itemDescription ?? null)
      }
      insRecurringService.run(
        j.recurringServiceId,
        j.locationId,
        j.recurringServiceName,
        j.cadence,
        j.jobSummary,
      )
      const ingestedAt = j.transitions[0]?.at ?? DEMO_CLOCK_ISO
      insRse.run(
        j.rseId,
        j.recurringServiceId,
        j.dueDate,
        j.agentState,
        ingestedAt,
        j.appfolioStatus,
      )
      for (const o of j.outreach) {
        insOutreach.run(
          j.rseId,
          o.channel,
          o.contactId ?? null,
          o.recipient,
          o.subject ?? null,
          o.body,
          o.sentAt,
        )
      }
      for (const r of j.replies) {
        insReply.run(
          j.rseId,
          r.channel,
          r.contactId ?? null,
          r.fromAddress,
          r.rawText,
          r.classification ?? null,
          r.parsedDate ?? null,
          r.llmConfidence ?? null,
          r.receivedAt,
        )
      }
      for (const l of j.logs) {
        insLog.run(j.rseId, l.ts, l.level, l.line)
      }
      for (const t of j.transitions) {
        insTransition.run(j.rseId, t.from, t.to, t.reason, t.at)
      }
    }

    // Reset settings to canonical demo state.
    db.prepare(
      `UPDATE settings SET demo_clock_iso = ?, sms_outbound_enabled = 0, ingest_adapter = 'adapter2a', updated_at_iso = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = 1`,
    ).run(DEMO_CLOCK_ISO)
  })
  tx()
}
