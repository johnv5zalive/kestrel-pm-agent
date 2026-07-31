/**
 * Vendor-compliance seed. Deterministic and idempotent.
 *
 * The scenarios are chosen so the risk is obvious at a glance:
 *   - a plumber whose liability cover lapsed four days ago, who is also the
 *     vendor on an open approval, so he is about to be sent somewhere
 *   - a roofer whose certificate arrived and needs a human to read the dates
 *   - an electrician on final notice with a week to run
 *   - several vendors perfectly in date, because most of them are
 *
 * Vendor names line up with the ones quoted on the approval requests, so the
 * two tracks tell one story rather than two.
 */

import { db } from './client.js'
import type { ComplianceState } from '../agent/compliance_state.js'

interface SeedVendor {
  id: string
  name: string
  trade: string
  contactName?: string
  email?: string
  phone?: string
  lineType?: 'mobile' | 'landline' | 'voip'
  notes?: string
}

interface SeedDoc {
  id: string
  vendorId: string
  docType: 'general_liability' | 'workers_comp' | 'auto' | 'license'
  carrier?: string
  policyNumber?: string
  coverageUsd?: number
  expiresOn: string
  state: ComplianceState
  receivedAtIso?: string
  notes?: string
  outreach: Array<{
    channel: 'email' | 'sms' | 'voice'
    recipient: string
    subject?: string
    body: string
    sentAt: string
  }>
  replies: Array<{
    channel: 'email' | 'sms'
    fromAddress: string
    rawText: string
    classification?: string
    receivedAt: string
  }>
  logs: Array<{ ts: string; level: 'info' | 'warn' | 'error' | 'success'; line: string }>
  transitions: Array<{
    from: ComplianceState | null
    to: ComplianceState
    reason: string
    at: string
  }>
}

const SIGN = '\n\nThanks,\nKestrel Property Management'

export const VENDORS: SeedVendor[] = [
  {
    id: 'VEN-TIDEWATER',
    name: 'Tidewater Plumbing',
    trade: 'Plumbing',
    contactName: 'Gus Pettigrew',
    email: 'gus@tidewaterplumbing.com',
    phone: '(919) 555-0901',
    lineType: 'mobile',
    notes: 'Reliable on the work, hopeless on paperwork.',
  },
  {
    id: 'VEN-CAROLINA-AIR',
    name: 'Carolina Air',
    trade: 'HVAC',
    contactName: 'Renata Salas',
    email: 'renata@carolinaair.com',
    phone: '(984) 555-0912',
    lineType: 'mobile',
  },
  {
    id: 'VEN-PIEDMONT-ROOF',
    name: 'Piedmont Roofing',
    trade: 'Roofing',
    contactName: 'Abe Lindqvist',
    email: 'office@piedmontroofing.com',
    phone: '(919) 555-0923',
    lineType: 'landline',
  },
  {
    id: 'VEN-TRINITY-ELEC',
    name: 'Trinity Electric',
    trade: 'Electrical',
    contactName: 'Marcus Boateng',
    email: 'marcus@trinityelectric.com',
    phone: '(919) 555-0934',
    lineType: 'mobile',
  },
  {
    id: 'VEN-BLUEJAY-APPL',
    name: 'Bluejay Appliance',
    trade: 'Appliance',
    contactName: 'Sondra Whitfield',
    email: 'service@bluejayappliance.com',
    phone: '(984) 555-0945',
    lineType: 'landline',
  },
  {
    id: 'VEN-GREENFIELD',
    name: 'Greenfield Grounds',
    trade: 'Landscaping',
    contactName: 'Toma Iliescu',
    email: 'toma@greenfieldgrounds.com',
    phone: '(919) 555-0956',
    lineType: 'mobile',
  },
]

export const DOCS: SeedDoc[] = [
  // ---- Lapsed, and he is the vendor on an open job. The whole point. ----
  {
    id: 'COI-TIDEWATER-GL',
    vendorId: 'VEN-TIDEWATER',
    docType: 'general_liability',
    carrier: 'Cumberland Mutual',
    policyNumber: 'CM-GL-884120',
    coverageUsd: 1000000,
    expiresOn: '2026-04-26',
    state: 'Lapsed',
    notes: 'Quoted on the water heater at Sycamore Court, which is approved and waiting to book.',
    outreach: [
      {
        channel: 'email',
        recipient: 'gus@tidewaterplumbing.com',
        subject: 'Insurance renewal needed: general liability expires 26 April',
        body:
          'Hi Gus,\n\nYour general liability certificate on file with us expires on 26 April.\n\nSend the renewal through when you have it and we will update your record. We cannot send you to a property once it has lapsed.' +
          SIGN,
        sentAt: '2026-03-27T09:00:00.000Z',
      },
      {
        channel: 'email',
        recipient: 'gus@tidewaterplumbing.com',
        subject: 'Re: Insurance renewal needed: general liability expires 26 April',
        body:
          'Hi Gus,\n\nStill waiting on the general liability renewal. It expires two weeks today.\n\nSend it through whenever it comes back from your broker.' +
          SIGN,
        sentAt: '2026-04-12T09:00:00.000Z',
      },
      {
        channel: 'email',
        recipient: 'gus@tidewaterplumbing.com',
        subject: 'Final notice: general liability expires in 7 days',
        body:
          'Hi Gus,\n\nYour general liability cover expires on 26 April, which is a week today.\n\nIf we do not have the renewal by then you come off the dispatch list until we do. That is not a decision anyone here makes, it is just what the cover requires.' +
          SIGN,
        sentAt: '2026-04-19T09:00:00.000Z',
      },
      {
        channel: 'sms',
        recipient: '(919) 555-0901',
        body:
          'Kestrel Property Management: Gus, your general liability certificate expired on 26 April and you are off our dispatch list until we have the renewal. Please send it through. Reply STOP to opt out.',
        sentAt: '2026-04-27T09:00:00.000Z',
      },
    ],
    replies: [
      {
        channel: 'sms',
        fromAddress: '(919) 555-0901',
        rawText: 'Broker says it is in hand, should have it early next week.',
        classification: 'promised',
        receivedAt: '2026-04-27T14:12:00.000Z',
      },
    ],
    logs: [
      { ts: '2026-03-27T09:00:00.000Z', level: 'info', line: 'Expires in 30 days. Renewal requested.' },
      { ts: '2026-04-12T09:00:00.000Z', level: 'info', line: 'Nothing back with 14 days left. Reminder sent.' },
      { ts: '2026-04-19T09:00:00.000Z', level: 'warn', line: 'Seven days left. Final notice sent.' },
      {
        ts: '2026-04-27T09:00:00.000Z',
        level: 'error',
        line: 'Cover lapsed on 26 April. Tidewater Plumbing removed from the dispatch list.',
      },
      {
        ts: '2026-04-27T09:00:05.000Z',
        level: 'error',
        line: 'Tidewater is the quoted vendor on APR-2026-0141, which is approved and waiting to book. Flagged before anyone sends them.',
      },
      {
        ts: '2026-04-27T14:12:00.000Z',
        level: 'info',
        line: 'Vendor says the renewal is coming. A promise is not a certificate, so the block stands.',
      },
    ],
    transitions: [
      { from: null, to: 'Current', reason: 'Certificate on file', at: '2026-03-01T09:00:00.000Z' },
      { from: 'Current', to: 'Chasing_30Day', reason: '30 days to expiry', at: '2026-03-27T09:00:00.000Z' },
      { from: 'Chasing_30Day', to: 'Chasing_14Day', reason: '14 days to expiry', at: '2026-04-12T09:00:00.000Z' },
      { from: 'Chasing_14Day', to: 'Chasing_7Day', reason: '7 days to expiry', at: '2026-04-19T09:00:00.000Z' },
      { from: 'Chasing_7Day', to: 'Lapsed', reason: 'Expired 26 April', at: '2026-04-27T09:00:00.000Z' },
    ],
  },

  // ---- Certificate arrived, needs a human to read it. ----
  {
    id: 'COI-PIEDMONT-GL',
    vendorId: 'VEN-PIEDMONT-ROOF',
    docType: 'general_liability',
    carrier: 'Ironbridge Casualty',
    policyNumber: 'IC-GL-220741',
    coverageUsd: 2000000,
    expiresOn: '2026-05-14',
    state: 'NeedsYou_DocReceived',
    receivedAtIso: '2026-04-29T11:30:00.000Z',
    outreach: [
      {
        channel: 'email',
        recipient: 'office@piedmontroofing.com',
        subject: 'Insurance renewal needed: general liability expires 14 May',
        body:
          'Hi Abe,\n\nYour general liability certificate expires on 14 May.\n\nSend the renewal through when you have it and we will update your record.' +
          SIGN,
        sentAt: '2026-04-14T09:00:00.000Z',
      },
    ],
    replies: [
      {
        channel: 'email',
        fromAddress: 'office@piedmontroofing.com',
        rawText:
          'Attached is the new certificate, runs to 14 May next year. Let me know if you need the workers comp one as well.',
        classification: 'document-received',
        receivedAt: '2026-04-29T11:30:00.000Z',
      },
    ],
    logs: [
      { ts: '2026-04-14T09:00:00.000Z', level: 'info', line: 'Expires in 30 days. Renewal requested.' },
      {
        ts: '2026-04-29T11:30:00.000Z',
        level: 'success',
        line: 'Certificate received from Piedmont Roofing.',
      },
      {
        ts: '2026-04-29T11:30:10.000Z',
        level: 'warn',
        line: 'A person needs to confirm the dates and the coverage figure. The agent does not file a certificate it has not had checked.',
      },
    ],
    transitions: [
      { from: null, to: 'Current', reason: 'Certificate on file', at: '2026-03-01T09:00:00.000Z' },
      { from: 'Current', to: 'Chasing_30Day', reason: '30 days to expiry', at: '2026-04-14T09:00:00.000Z' },
      {
        from: 'Chasing_30Day',
        to: 'NeedsYou_DocReceived',
        reason: 'Certificate received',
        at: '2026-04-29T11:30:00.000Z',
      },
    ],
  },

  // ---- Final notice, a week to run. ----
  {
    id: 'COI-TRINITY-WC',
    vendorId: 'VEN-TRINITY-ELEC',
    docType: 'workers_comp',
    carrier: 'Statewide Compensation',
    policyNumber: 'SC-WC-55190',
    coverageUsd: 500000,
    expiresOn: '2026-05-06',
    state: 'Chasing_7Day',
    outreach: [
      {
        channel: 'email',
        recipient: 'marcus@trinityelectric.com',
        subject: "Insurance renewal needed: workers' compensation expires 6 May",
        body:
          "Hi Marcus,\n\nYour workers' compensation certificate expires on 6 May.\n\nSend the renewal through when you have it." +
          SIGN,
        sentAt: '2026-04-06T09:00:00.000Z',
      },
      {
        channel: 'email',
        recipient: 'marcus@trinityelectric.com',
        subject: "Re: Insurance renewal needed: workers' compensation expires 6 May",
        body:
          "Hi Marcus,\n\nStill waiting on the workers' compensation renewal, which expires two weeks today." +
          SIGN,
        sentAt: '2026-04-22T09:00:00.000Z',
      },
      {
        channel: 'email',
        recipient: 'marcus@trinityelectric.com',
        subject: "Final notice: workers' compensation expires in 7 days",
        body:
          "Hi Marcus,\n\nYour workers' compensation cover expires on 6 May, a week today.\n\nWe have you quoted on two live jobs. If the cover lapses we cannot send you to either of them, so it is worth chasing your broker today." +
          SIGN,
        sentAt: '2026-04-29T09:00:00.000Z',
      },
    ],
    replies: [],
    logs: [
      { ts: '2026-04-06T09:00:00.000Z', level: 'info', line: 'Expires in 30 days. Renewal requested.' },
      { ts: '2026-04-22T09:00:00.000Z', level: 'info', line: 'Nothing back with 14 days left. Reminder sent.' },
      { ts: '2026-04-29T09:00:00.000Z', level: 'warn', line: 'Seven days left. Final notice sent.' },
      {
        ts: '2026-04-29T09:00:05.000Z',
        level: 'warn',
        line: 'Trinity Electric is quoted on two open jobs, including the emergency panel at Oakmont Manor.',
      },
    ],
    transitions: [
      { from: null, to: 'Current', reason: 'Certificate on file', at: '2026-03-01T09:00:00.000Z' },
      { from: 'Current', to: 'Chasing_30Day', reason: '30 days to expiry', at: '2026-04-06T09:00:00.000Z' },
      { from: 'Chasing_30Day', to: 'Chasing_14Day', reason: '14 days to expiry', at: '2026-04-22T09:00:00.000Z' },
      { from: 'Chasing_14Day', to: 'Chasing_7Day', reason: '7 days to expiry', at: '2026-04-29T09:00:00.000Z' },
    ],
  },

  // ---- Chasing, plenty of runway. ----
  {
    id: 'COI-BLUEJAY-GL',
    vendorId: 'VEN-BLUEJAY-APPL',
    docType: 'general_liability',
    carrier: 'Cumberland Mutual',
    policyNumber: 'CM-GL-771904',
    coverageUsd: 1000000,
    expiresOn: '2026-05-22',
    state: 'Chasing_30Day',
    outreach: [
      {
        channel: 'email',
        recipient: 'service@bluejayappliance.com',
        subject: 'Insurance renewal needed: general liability expires 22 May',
        body:
          'Hi Sondra,\n\nYour general liability certificate expires on 22 May.\n\nSend the renewal through when you have it and we will update your record.' +
          SIGN,
        sentAt: '2026-04-22T09:00:00.000Z',
      },
    ],
    replies: [],
    logs: [
      { ts: '2026-04-22T09:00:00.000Z', level: 'info', line: 'Expires in 30 days. Renewal requested.' },
    ],
    transitions: [
      { from: null, to: 'Current', reason: 'Certificate on file', at: '2026-03-01T09:00:00.000Z' },
      { from: 'Current', to: 'Chasing_30Day', reason: '30 days to expiry', at: '2026-04-22T09:00:00.000Z' },
    ],
  },

  // ---- Lapsed licence on a vendor nobody is using. Low drama, still wrong. ----
  {
    id: 'COI-GREENFIELD-LIC',
    vendorId: 'VEN-GREENFIELD',
    docType: 'license',
    carrier: 'NC Landscape Contractors Board',
    policyNumber: 'NCLCB-40218',
    expiresOn: '2026-04-18',
    state: 'Lapsed',
    notes: 'No open jobs, so this is paperwork rather than exposure.',
    outreach: [
      {
        channel: 'email',
        recipient: 'toma@greenfieldgrounds.com',
        subject: 'Trade licence renewal needed: expires 18 April',
        body:
          'Hi Toma,\n\nYour landscape contractor licence on file expires on 18 April.\n\nSend the renewal through when you have it.' +
          SIGN,
        sentAt: '2026-03-19T09:00:00.000Z',
      },
      {
        channel: 'email',
        recipient: 'toma@greenfieldgrounds.com',
        subject: 'Final notice: trade licence expires in 7 days',
        body:
          'Hi Toma,\n\nYour licence expires on 18 April. Without it we cannot put you on a work order.' +
          SIGN,
        sentAt: '2026-04-11T09:00:00.000Z',
      },
    ],
    replies: [],
    logs: [
      { ts: '2026-03-19T09:00:00.000Z', level: 'info', line: 'Expires in 30 days. Renewal requested.' },
      { ts: '2026-04-11T09:00:00.000Z', level: 'warn', line: 'Seven days left. Final notice sent.' },
      {
        ts: '2026-04-19T09:00:00.000Z',
        level: 'error',
        line: 'Licence lapsed on 18 April. Greenfield Grounds removed from the dispatch list.',
      },
      {
        ts: '2026-04-19T09:00:05.000Z',
        level: 'info',
        line: 'No open jobs with this vendor, so nothing is blocked by it today.',
      },
    ],
    transitions: [
      { from: null, to: 'Current', reason: 'Licence on file', at: '2026-02-01T09:00:00.000Z' },
      { from: 'Current', to: 'Chasing_30Day', reason: '30 days to expiry', at: '2026-03-19T09:00:00.000Z' },
      { from: 'Chasing_30Day', to: 'Chasing_7Day', reason: '7 days to expiry', at: '2026-04-11T09:00:00.000Z' },
      { from: 'Chasing_7Day', to: 'Lapsed', reason: 'Expired 18 April', at: '2026-04-19T09:00:00.000Z' },
    ],
  },

  // ---- In date, nothing happening. Most of the list looks like this. ----
  {
    id: 'COI-CAROLINA-GL',
    vendorId: 'VEN-CAROLINA-AIR',
    docType: 'general_liability',
    carrier: 'Ironbridge Casualty',
    policyNumber: 'IC-GL-118844',
    coverageUsd: 2000000,
    expiresOn: '2026-11-30',
    state: 'Current',
    outreach: [],
    replies: [],
    logs: [
      { ts: '2026-03-01T09:00:00.000Z', level: 'success', line: 'Certificate on file. Expires 30 November.' },
    ],
    transitions: [
      { from: null, to: 'Current', reason: 'Certificate on file', at: '2026-03-01T09:00:00.000Z' },
    ],
  },
  {
    id: 'COI-CAROLINA-WC',
    vendorId: 'VEN-CAROLINA-AIR',
    docType: 'workers_comp',
    carrier: 'Statewide Compensation',
    policyNumber: 'SC-WC-61277',
    coverageUsd: 500000,
    expiresOn: '2026-09-15',
    state: 'Current',
    outreach: [],
    replies: [],
    logs: [
      { ts: '2026-03-01T09:00:00.000Z', level: 'success', line: 'Certificate on file. Expires 15 September.' },
    ],
    transitions: [
      { from: null, to: 'Current', reason: 'Certificate on file', at: '2026-03-01T09:00:00.000Z' },
    ],
  },
  {
    id: 'COI-TRINITY-GL',
    vendorId: 'VEN-TRINITY-ELEC',
    docType: 'general_liability',
    carrier: 'Cumberland Mutual',
    policyNumber: 'CM-GL-903318',
    coverageUsd: 2000000,
    expiresOn: '2026-08-01',
    state: 'Current',
    outreach: [],
    replies: [],
    logs: [
      { ts: '2026-03-01T09:00:00.000Z', level: 'success', line: 'Certificate on file. Expires 1 August.' },
    ],
    transitions: [
      { from: null, to: 'Current', reason: 'Certificate on file', at: '2026-03-01T09:00:00.000Z' },
    ],
  },
  {
    id: 'COI-TIDEWATER-WC',
    vendorId: 'VEN-TIDEWATER',
    docType: 'workers_comp',
    carrier: 'Statewide Compensation',
    policyNumber: 'SC-WC-48802',
    coverageUsd: 500000,
    expiresOn: '2026-07-19',
    state: 'Current',
    outreach: [],
    replies: [],
    logs: [
      { ts: '2026-03-01T09:00:00.000Z', level: 'success', line: 'Certificate on file. Expires 19 July.' },
    ],
    transitions: [
      { from: null, to: 'Current', reason: 'Certificate on file', at: '2026-03-01T09:00:00.000Z' },
    ],
  },
]

/** Which vendor is quoted on which approval, so a lapse can be tied to live work. */
export const APPROVAL_VENDORS: Record<string, string> = {
  'APR-2026-0141': 'VEN-TIDEWATER',
  'APR-2026-0138': 'VEN-CAROLINA-AIR',
  'APR-2026-0136': 'VEN-PIEDMONT-ROOF',
  'APR-2026-0134': 'VEN-BLUEJAY-APPL',
  'APR-2026-0129': 'VEN-TRINITY-ELEC',
  'APR-2026-0143': 'VEN-TRINITY-ELEC',
  'APR-2026-0135': 'VEN-CAROLINA-AIR',
  'APR-2026-0142': 'VEN-TIDEWATER',
  'APR-2026-0127': 'VEN-TRINITY-ELEC',
}

export function seedCompliance() {
  const insVendor = db.prepare(`
    INSERT INTO vendors (id, name, trade, contact_name, email, phone, line_type, active, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
  `)
  const insDoc = db.prepare(`
    INSERT INTO vendor_documents
      (id, vendor_id, doc_type, carrier, policy_number, coverage_usd, expires_on, state, received_at_iso, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insOutreach = db.prepare(`
    INSERT INTO outreach_attempts
      (subject_type, subject_id, channel, contact_id, recipient, subject, body_text, sent_at_demo_clock, intercepted)
    VALUES ('compliance', ?, ?, NULL, ?, ?, ?, ?, 1)
  `)
  const insReply = db.prepare(`
    INSERT INTO inbound_replies
      (subject_type, subject_id, channel, contact_id, from_address, raw_text, classification,
       parsed_date, parsed_amount_usd, llm_confidence, received_at_demo_clock)
    VALUES ('compliance', ?, ?, NULL, ?, ?, ?, NULL, NULL, NULL, ?)
  `)
  const insLog = db.prepare(`
    INSERT INTO agent_logs (subject_type, subject_id, ts_demo_clock, level, line)
    VALUES ('compliance', ?, ?, ?, ?)
  `)
  const insTransition = db.prepare(`
    INSERT INTO state_transitions (subject_type, subject_id, from_state, to_state, reason, at_demo_clock)
    VALUES ('compliance', ?, ?, ?, ?, ?)
  `)

  for (const v of VENDORS) {
    insVendor.run(
      v.id,
      v.name,
      v.trade,
      v.contactName ?? null,
      v.email ?? null,
      v.phone ?? null,
      v.lineType ?? null,
      v.notes ?? null,
    )
  }

  for (const d of DOCS) {
    insDoc.run(
      d.id,
      d.vendorId,
      d.docType,
      d.carrier ?? null,
      d.policyNumber ?? null,
      d.coverageUsd ?? null,
      d.expiresOn,
      d.state,
      d.receivedAtIso ?? null,
      d.notes ?? null,
    )
    for (const o of d.outreach) {
      insOutreach.run(d.id, o.channel, o.recipient, o.subject ?? null, o.body, o.sentAt)
    }
    for (const r of d.replies) {
      insReply.run(d.id, r.channel, r.fromAddress, r.rawText, r.classification ?? null, r.receivedAt)
    }
    for (const l of d.logs) insLog.run(d.id, l.ts, l.level, l.line)
    for (const t of d.transitions) insTransition.run(d.id, t.from, t.to, t.reason, t.at)
  }

  // Tie approvals to the vendor that quoted them, so a lapse can be shown
  // against live work rather than in the abstract.
  const setVendor = db.prepare(`UPDATE approval_requests SET vendor_id = ? WHERE id = ?`)
  for (const [approvalId, vendorId] of Object.entries(APPROVAL_VENDORS)) {
    setVendor.run(vendorId, approvalId)
  }
}
