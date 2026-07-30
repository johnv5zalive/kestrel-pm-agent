import { html } from 'hono/html'
import { STATE_META, type AgentState } from '../agent/state_machine.js'
import type { JobQueueRow } from '../db/queries_inbox.js'
import { layout } from './layout.js'
import { samplePill, stateBadge, v2Chip } from './_components.js'

interface AdminProps {
  jobs: JobQueueRow[]
  ingestAdapter: string
  smsOutboundEnabled: boolean
  demoClockIso: string
  tourStep?: number
}

const ADAPTER_OPTIONS: Array<{ id: string; label: string; description: string; tier: string }> = [
  {
    id: 'adapter1',
    label: 'Adapter 1 — REST API',
    description:
      'Direct AppFolio API. Multi-contact fan-out, completion check, note writeback.',
    tier: 'API add-on required',
  },
  {
    id: 'adapter2a',
    label: 'Adapter 2A — Scheduled XLSX',
    description:
      'Account admin schedules a custom Recurring Service Events report → XLSX → ingest inbox weekly.',
    tier: 'API add-on required',
  },
  {
    id: 'adapter2b_full',
    label: 'Adapter 2B — Coordinator export (full cols)',
    description:
      'Coordinator exports the Follow-Ups screen weekly. Edit Columns confirmed to expose contact phone/email.',
    tier: 'No API add-on',
  },
  {
    id: 'adapter2b_degraded',
    label: 'Adapter 2B — Coordinator export (degraded)',
    description:
      'Same export, but contact phone/email columns unavailable. Falls back to Job-Summary-only extraction.',
    tier: 'No API add-on',
  },
]

export const adminPage = (p: AdminProps) =>
  layout({
    title: 'Admin · Kestrel PM Booking Agent',
    tourStep: p.tourStep,
    currentPath: '/admin',
    body: html`
      <div class="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 class="font-black text-ink text-3xl tracking-tight">Admin</h1>
          <p class="text-ink-fade mt-1">
            Synthetic-data CRUD, ingest adapter, SMS toggle, and demo clock.
            Production cutover is a data swap, not a code change.
          </p>
        </div>

        ${adapterSection(p.ingestAdapter)}
        ${smsToggleSection(p.smsOutboundEnabled)}
        ${connectRealSection()}
        ${jobOverrideSection(p.jobs)}
      </div>
    `,
  })

const adapterSection = (current: string) => html`
  <section data-tour-highlight="adapter-section" class="rounded-lg border border-canvas-deep bg-white">
    <header class="px-5 py-3 border-b border-canvas-deep flex items-center justify-between flex-wrap gap-3">
      <div>
        <h2 class="font-bold text-ink text-lg tracking-tight">AppFolio ingest adapter</h2>
        <p class="text-sm text-ink-fade mt-0.5">
          Switch the loader path to preview each tier's behavior.
        </p>
      </div>
      ${samplePill('AppFolio')}
    </header>
    <form method="POST" action="/demo/_set-adapter" class="p-5 grid md:grid-cols-2 gap-3">
      ${ADAPTER_OPTIONS.map(
        (a) => html`
          <label
            class="block rounded-lg border ${current === a.id
              ? 'border-brand-navy ring-2 ring-brand-navy/20 bg-brand-sky-soft/40'
              : 'border-canvas-deep bg-canvas hover:border-brand-navy/30'} p-4 cursor-pointer transition-all"
          >
            <div class="flex items-start gap-3">
              <input
                type="radio"
                name="adapter"
                value="${a.id}"
                ${current === a.id ? 'checked' : ''}
                class="mt-1 accent-brand-navy"
                onchange="this.form.submit()"
              />
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap mb-1">
                  <span class="font-bold text-ink text-sm">${a.label}</span>
                  <span class="text-[10px] uppercase tracking-wider text-ink-muted bg-canvas-deep px-1.5 py-0.5 rounded font-bold">
                    ${a.tier}
                  </span>
                </div>
                <p class="text-xs text-ink-fade leading-relaxed">${a.description}</p>
              </div>
            </div>
          </label>
        `,
      )}
      <noscript>
        <button type="submit" class="btn-primary col-span-full">Apply adapter</button>
      </noscript>
    </form>
  </section>
`

const smsToggleSection = (enabled: boolean) => html`
  <section class="rounded-lg border border-canvas-deep bg-white">
    <header class="px-5 py-4 flex items-center justify-between flex-wrap gap-3">
      <div>
        <h2 class="font-bold text-ink text-lg tracking-tight">Outbound SMS</h2>
        <p class="text-sm text-ink-fade mt-0.5">
          ${enabled
            ? 'Phase 1.5 active — outbound SMS sends as part of the T-5 step.'
            : 'Phase 1 — outbound SMS dark until A2P 10DLC brand + campaign clear in Twilio TCR.'}
          Inbound SMS is live regardless.
        </p>
      </div>
      <form method="POST" action="/demo/_toggle-sms">
        <button
          type="submit"
          class="${enabled
            ? 'btn-ghost text-sm'
            : 'btn-block-sm'}"
        >
          ${enabled ? 'Switch to Phase 1 (dark)' : 'Switch to Phase 1.5 (live)'}
        </button>
      </form>
    </header>
  </section>
`

const connectRealSection = () => html`
  <section data-tour-highlight="connect-real" class="rounded-lg border border-canvas-deep bg-white">
    <header class="px-5 py-3 border-b border-canvas-deep">
      <h2 class="font-bold text-ink text-lg tracking-tight">Connect real systems</h2>
      <p class="text-sm text-ink-fade mt-0.5">
        Production cutover wizards. All form fields are disabled in demo —
        this is a preview of what production setup looks like, with the runbook
        Sagan walks the customer through.
      </p>
    </header>
    <div class="p-5 grid md:grid-cols-3 gap-3">
      ${connectCard(
        'appfolio',
        'AppFolio',
        'OAuth2 client credentials + ST-App-Key. Unlocks Adapter 1 (API) when Kestrel Property Management authorizes the Sagan Integrator app.',
      )}
      ${connectCard(
        'gmail',
        'Google Workspace',
        'Service account + domain-wide delegation on gmail.modify. Two mailboxes: pm-agent@ + pm-agent-ingest@kestrelpm.com.',
      )}
      ${connectCard(
        'twilio',
        'Twilio',
        'Account SID + Auth Token + Messaging Service SID + From number. Outbound SMS gated by 10DLC brand+campaign registration.',
      )}
    </div>
  </section>
`

const connectCard = (id: string, name: string, description: string) => html`
  <a
    href="/admin/wizard/${id}"
    class="block rounded-lg border border-canvas-deep p-4 hover:border-brand-navy/30 transition-colors group"
  >
    <div class="flex items-center gap-2 mb-1">
      <span class="font-bold text-ink text-sm">${name}</span>
      <svg
        class="w-3.5 h-3.5 text-ink-muted group-hover:text-brand-navy transition-colors"
        fill="none"
        viewBox="0 0 24 24"
        stroke-width="2"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
      </svg>
    </div>
    <p class="text-xs text-ink-fade leading-relaxed">${description}</p>
  </a>
`

const jobOverrideSection = (jobs: JobQueueRow[]) => html`
  <section class="rounded-lg border border-canvas-deep bg-white">
    <header class="px-5 py-3 border-b border-canvas-deep flex items-start justify-between gap-3 flex-wrap">
      <div>
        <h2 class="font-bold text-ink text-lg tracking-tight">Synthetic data — RSE state override</h2>
        <p class="text-sm text-ink-fade mt-0.5">
          Force any job into any state. Useful for previewing specific lifecycle moments.
        </p>
      </div>
      ${v2Chip('auto-enroll', 'Auto-enroll new PM properties')}
    </header>
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead class="bg-canvas border-b border-canvas-deep">
          <tr class="text-[11px] uppercase tracking-wider text-ink-muted">
            <th class="text-left px-5 py-2 font-bold">Property</th>
            <th class="text-left px-3 py-2 font-bold">Service · Due</th>
            <th class="text-left px-3 py-2 font-bold">Current state</th>
            <th class="text-left px-5 py-2 font-bold">Override</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-canvas-deep">
          ${jobs.map(
            (j) => html`
              <tr class="hover:bg-canvas">
                <td class="px-5 py-2.5">
                  <a href="/inbox/${j.rse_id}" class="font-bold text-ink hover:text-brand-navy">
                    ${j.customer_name}
                  </a>
                  <div class="text-[11px] text-ink-muted font-mono">${j.rse_id}</div>
                </td>
                <td class="px-3 py-2.5 text-ink-fade">
                  ${j.recurring_service_name} · ${j.due_date}
                </td>
                <td class="px-3 py-2.5">${stateBadge(j.state, { size: 'sm' })}</td>
                <td class="px-5 py-2.5">
                  <form method="POST" action="/admin/_override-state" class="flex gap-2 items-center">
                    <input type="hidden" name="rseId" value="${j.rse_id}" />
                    <select
                      name="state"
                      class="text-xs rounded border border-canvas-deep px-2 py-1 bg-white"
                    >
                      ${(Object.keys(STATE_META) as AgentState[]).map(
                        (s) => html`<option value="${s}" ${s === j.state ? 'selected' : ''}>${STATE_META[s].shortLabel}</option>`,
                      )}
                    </select>
                    <button type="submit" class="btn-ghost text-xs">Apply</button>
                  </form>
                </td>
              </tr>
            `,
          )}
        </tbody>
      </table>
    </div>
  </section>
`
