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
      'Once a contact has proposed a date and the Coordinator has confirmed, the agent creates the actual Work Order in AppFolio via the API — no manual AppFolio entry.',
    whyItMatters:
      'V1 stops at "Awaiting Human · date proposed." The team paused there deliberately: the agent captures the date, the Coordinator still confirms the booking. V2 closes that loop.',
    dependencies: [
      'Adapter 1 (REST API) — only path that can write Work Orders',
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
      'Some stakeholders are cautious about AI phone interactions — V1 keeps voice dumb (press-1 / press-2). V2 brings AI voice in carefully, with full call recording and Coordinator review of every transcript before booking confirms.',
    dependencies: [
      'Vapi (managed voice agent platform)',
      'Vapi can import the same Twilio number, no re-registration needed',
      'Coordinator confidence threshold — auto-book or always Awaiting Human?',
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
      'V1 routes every question directly to the Coordinator. V2 deflects the predictable ~80% (agreement coverage, scope, scheduling rules) and only escalates the genuinely novel ones.',
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
      'Extend this PM-specific inbox into a generic team inbox covering all contact-facing email + SMS threads (maintenance requests, dispatch, follow-ups). One place to find a conversation regardless of business unit.',
    whyItMatters:
      'A common ask from operations teams. The V1 schema is already designed to absorb this — the conversation/message tables are channel-agnostic.',
    dependencies: [
      'Per-thread routing rules: who owns which channel',
      'Auth roles (Coordinator vs Dispatch vs Owner)',
      'Search + filtering across high message volume',
    ],
  },
  {
    id: 'invoice-agent',
    title: 'Invoice review agent',
    status: 'On the roadmap',
    forWho: 'Office / billing',
    whatItDoes:
      'A sister agent that reviews AppFolio invoices for completeness and format before they export to QuickBooks — flags missing line items, miscoded categories, and inconsistent labor rates.',
    whyItMatters:
      'A frequent back-office pain after PM. Explicitly deprioritized for v1 in favor of PM, which solves a bigger, revenue-generating problem. Strong candidate for the next build.',
    dependencies: [
      'AppFolio + QuickBooks both reachable',
      'Kestrel Property Management\'s invoice format conventions',
      'Approval thresholds: which flags auto-fix, which escalate',
    ],
  },
  {
    id: 'auto-enroll',
    title: 'Auto-enroll new properties in PM',
    status: 'Future phase',
    forWho: 'Kestrel Property Management sales',
    whatItDoes:
      'When a new turnover or repair Work Order closes in AppFolio, automatically create a Recurring Service template at the appropriate cadence and add it to the PM rotation.',
    whyItMatters:
      'Surfaced during discovery. V1 reads existing Recurring Service Events; it doesn\'t enroll anyone. V2 closes the loop from a first-time property → ongoing PM coverage.',
    dependencies: [
      'Adapter 1 + Work-Order-write permissions',
      'Cadence-by-equipment-class rules (annual vs quarterly)',
      'Contact opt-in confirmation flow',
    ],
  },
  {
    id: 'predict-score',
    title: 'Predictive booking-likelihood scoring',
    status: 'In v2',
    forWho: 'Maintenance Coordinator',
    whatItDoes:
      'Score each upcoming RSE for "likely to convert async" vs "needs phone follow-up." Coordinator queue sorts the high-touch ones to the top of their phone list, deflecting the rest.',
    whyItMatters:
      'Reduces phone-time-per-booking even further by predicting which contacts need a human before the cadence runs.',
    dependencies: [
      '6+ months of agent reply data per property',
      'Contact reply latency + classification history',
      'Equipment age + service type as signal',
    ],
  },
  {
    id: 'imessage',
    title: 'iMessage outbound',
    status: 'Future phase',
    forWho: 'Contacts on iMessage',
    whatItDoes:
      'Send outbound business messages via Apple Messages for Business, bypassing 10DLC entirely for iPhone-registered numbers.',
    whyItMatters:
      'Considered as a bridge during the 10DLC waiting period. Rejected for v1: AMB requires Apple approval and extensive setup, and Kestrel Property Management\'s contact base is predominantly business and mobile phones (many not Apple-ID-registered). Inbound SMS at Phase 1 + full SMS at Phase 1.5 ships faster and reaches more contacts.',
    dependencies: [
      'Apple Messages for Business approval',
      'Contact base segmentation: which numbers iMessage-eligible',
      'Routing rules: iMessage when available, Twilio SMS otherwise',
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
