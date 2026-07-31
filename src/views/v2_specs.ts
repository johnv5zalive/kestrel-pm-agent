/**
 * v2 chips — every Out-of-Scope item from the PRD gets a chip + dialog at its
 * natural location. Click the chip → opens <dialog id="v2-${id}"> with a
 * concrete spec. No tooltips. No "coming soon" copy. No temporal commitments.
 */

import { html } from 'hono/html'

export interface V2Spec {
  id: string
  title: string
  status: 'On the roadmap' | 'In v2' | 'Future phase'
  forWho: string
  whatItDoes: string
  whyItMatters: string
  dependencies: string[]
}

export const V2_SPECS: V2Spec[] = [
  {
    id: 'auto-book',
    title: 'Auto-book in AppFolio',
    status: 'On the roadmap',
    forWho: 'Maintenance Coordinator',
    whatItDoes:
      'Once a contact has given a date and you have confirmed it, the agent creates the work order in AppFolio itself, so nobody re-types it.',
    whyItMatters:
      'Today the agent stops once it has a date, and a person confirms it. That was deliberate: a wrong date never reaches a calendar unseen. This closes the loop once you trust it.',
    dependencies: [
      'The direct AppFolio connection, which is the only path that can create a work order',
      'Approval to write to production AppFolio',
      'Conflict-resolution rules: technician availability, equipment lead time',
    ],
  },
  {
    id: 'conv-voice',
    title: 'Conversational AI voice agent',
    status: 'Future phase',
    forWho: 'Landline-only contacts',
    whatItDoes:
      'Replace the 30-second IVR fallback with a real conversational AI that holds a date-negotiation phone call, captures the date, and surfaces it to the queue exactly like an inbound text would.',
    whyItMatters:
      'People are rightly cautious about AI phone calls, so today the call is deliberately simple: press 1 or press 2. This brings a real conversation in carefully, with every call recorded and read before anything is booked.',
    dependencies: [
      'A managed voice-agent platform',
      'It can use the same phone number, so nothing needs re-registering',
      'A decision on whether it books directly or always checks with you first',
    ],
  },
  {
    id: 'faq-thread',
    title: 'FAQ in-thread answering',
    status: 'In v2',
    forWho: 'Maintenance Coordinator',
    whatItDoes:
      'When a contact asks a question instead of proposing a date ("is this covered under our management agreement?"), the agent answers it in-thread from a Kestrel Property Management knowledge base, then re-asks for the booking date.',
    whyItMatters:
      'Today every question comes to you. This answers the repetitive ones about scope, coverage and scheduling rules, and only passes on the genuinely new ones.',
    dependencies: [
      'Knowledge base seeded from Coordinator history',
      'Confidence threshold below which questions still escalate',
      'Audit log: every agent answer reviewable by Coordinator',
    ],
  },
  {
    id: 'generic-inbox',
    title: 'Generic team inbox',
    status: 'On the roadmap',
    forWho: 'Kestrel Property Management operations + dispatch',
    whatItDoes:
      'Widen this inbox to cover every email and text thread with a contact, not just scheduled maintenance. One place to find a conversation, whoever it was with.',
    whyItMatters:
      'A common ask from operations teams, and the way the data is already stored means it does not need rebuilding to support it.',
    dependencies: [
      'Per-thread routing rules: who owns which channel',
      'Who is allowed to see and reply to what',
      'Search that still works once there are thousands of threads',
    ],
  },
  {
    id: 'invoice-agent',
    title: 'Invoice review agent',
    status: 'On the roadmap',
    forWho: 'Office / billing',
    whatItDoes:
      'A second agent that checks AppFolio invoices before they reach QuickBooks, flagging missing lines, wrong categories and inconsistent labour rates.',
    whyItMatters:
      'The next back-office pain after scheduling. Left out of this build deliberately so scheduling could ship first. A strong candidate for the next one.',
    dependencies: [
      'AppFolio + QuickBooks both reachable',
      'Kestrel Property Management\'s invoice format conventions',
      'Which problems it fixes itself and which it brings to you',
    ],
  },
  {
    id: 'auto-enroll',
    title: 'Auto-enroll new properties',
    status: 'Future phase',
    forWho: 'Kestrel Property Management sales',
    whatItDoes:
      'When a turnover or repair closes in AppFolio, set the property up on the right maintenance cadence automatically instead of someone remembering to.',
    whyItMatters:
      'Today the agent reads the maintenance schedule it is given. It does not add anything to it. This closes the gap between a one-off job and ongoing coverage.',
    dependencies: [
      'The direct AppFolio connection, with permission to write',
      'Rules for which equipment needs servicing how often',
      'Contact opt-in confirmation flow',
    ],
  },
  {
    id: 'predict-score',
    title: 'Predictive booking-likelihood scoring',
    status: 'In v2',
    forWho: 'Maintenance Coordinator',
    whatItDoes:
      'Work out which visits will settle over email and which will need a call, and sort your list so the calls you actually have to make are at the top.',
    whyItMatters:
      'Cuts phone time further by spotting the contacts who need a person before the reminders even go out.',
    dependencies: [
      'Six months or so of reply history per property',
      'How fast each contact usually replies, and with what',
      'Equipment age and service type as signals',
    ],
  },
  {
    id: 'imessage',
    title: 'iMessage outbound',
    status: 'Future phase',
    forWho: 'Contacts on iMessage',
    whatItDoes:
      'Send messages through Apple Messages for Business, which skips carrier registration entirely for iPhone numbers.',
    whyItMatters:
      'Considered as a way around the wait for carrier registration and rejected. It needs Apple approval and a lot of setup, and most contacts here are on business numbers not registered with Apple. Ordinary texting reaches more people sooner.',
    dependencies: [
      'Apple Messages for Business approval',
      'Working out which numbers are eligible',
      'Rules for when to use it and when to fall back to a normal text',
    ],
  },
]

export const v2DialogsHtml = () => html`
  ${V2_SPECS.map(
    (s) => html`
      <dialog
        id="v2-${s.id}"
        class="rounded-xl border border-canvas-deep p-0 max-w-xl w-full backdrop:bg-ink/40 backdrop:backdrop-blur-sm"
      >
        <div class="p-6">
          <div class="flex items-start justify-between gap-3 mb-3">
            <div>
              <span
                class="inline-flex items-center gap-1.5 rounded-full bg-demo-gold-soft text-demo-gold-deep border border-demo-gold-line/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider mb-2"
              >
                ${s.status}
              </span>
              <h2 class="font-black text-ink text-xl tracking-tight">${s.title}</h2>
            </div>
            <button
              type="button"
              data-v2-close
              aria-label="Close"
              class="text-ink-muted hover:text-ink p-1"
            >
              <svg
                class="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <dl class="space-y-3 text-sm mt-4">
            <div>
              <dt class="text-[11px] uppercase tracking-wider text-ink-muted font-bold mb-0.5">For</dt>
              <dd class="text-ink">${s.forWho}</dd>
            </div>
            <div>
              <dt class="text-[11px] uppercase tracking-wider text-ink-muted font-bold mb-0.5">What it does</dt>
              <dd class="text-ink leading-relaxed">${s.whatItDoes}</dd>
            </div>
            <div>
              <dt class="text-[11px] uppercase tracking-wider text-ink-muted font-bold mb-0.5">Why it matters</dt>
              <dd class="text-ink leading-relaxed">${s.whyItMatters}</dd>
            </div>
            <div>
              <dt class="text-[11px] uppercase tracking-wider text-ink-muted font-bold mb-1">Dependencies</dt>
              <dd>
                <ul class="list-disc list-inside text-ink leading-relaxed space-y-0.5">
                  ${s.dependencies.map((d) => html`<li>${d}</li>`)}
                </ul>
              </dd>
            </div>
          </dl>

          <div class="mt-6 pt-4 border-t border-canvas-deep flex justify-end">
            <button type="button" data-v2-close class="btn-ghost text-sm">Close</button>
          </div>
        </div>
      </dialog>
    `,
  )}
`
