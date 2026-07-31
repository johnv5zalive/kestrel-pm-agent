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

// TODO(appfolio-naming): two strings below were inherited from the ServiceTitan
// build and describe screens that may not exist under these names in AppFolio.
// They have been replaced with neutral descriptions rather than guessed at:
//   - the source screen a coordinator exports from weekly (was "Follow-Ups screen")
//   - the API credential header AppFolio issues (was "ST-App-Key", see connectRealSection)
// Confirm both against a live AppFolio account before this goes in front of a
// customer, then put the real names back.
const ADAPTER_OPTIONS: Array<{ id: string; label: string; description: string; tier: string }> = [
  {
    id: 'adapter1',
    label: 'Direct connection',
    description:
      'The agent reads the maintenance schedule straight out of AppFolio, reaches every contact on a property, checks whether a visit was already booked, and writes its notes back.',
    tier: 'API add-on required',
  },
  {
    id: 'adapter2a',
    label: 'Automatic weekly report',
    description:
      'Your AppFolio admin schedules a maintenance report to email itself every week. The agent reads it on arrival. Nothing to remember, no API needed.',
    tier: 'No API add-on',
  },
  {
    id: 'adapter2b_full',
    label: 'Manual weekly export',
    description:
      'The coordinator exports the upcoming maintenance list once a week and drops it in. Contact phone and email come through on the export.',
    tier: 'No API add-on',
  },
  {
    id: 'adapter2b_degraded',
    label: 'Manual weekly export — no contact columns',
    description:
      'Same export, but phone and email are missing from it. The agent falls back to reading contact details out of the service notes.',
    tier: 'No API add-on',
  },
]

export const adminPage = (p: AdminProps) =>
  layout({
    title: 'Admin · Kestrel Maintenance Scheduling Agent',
    tourStep: p.tourStep,
    currentPath: '/admin',
    body: html`
      <div class="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <div>
          <h1 class="font-black text-ink text-3xl tracking-tight">Admin</h1>
          <p class="text-ink-fade mt-1">
            Choose how the agent gets your maintenance schedule, turn texting on or off,
            and preview any job in any state. Going live swaps the sample data for
            yours. Nothing here is rebuilt.
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
        <h2 class="font-bold text-ink text-lg tracking-tight">How the agent gets your schedule</h2>
        <p class="text-sm text-ink-fade mt-0.5">
          Three ways in, depending on what your AppFolio plan allows. The rest of the agent works the same either way.
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
            ? 'Texting is on. The agent sends a text five days before the visit if there has been no reply.'
            : 'Texting is off until carrier registration for business messaging clears.'}
          Replies by text are read either way.
        </p>
      </div>
      <form method="POST" action="/demo/_toggle-sms">
        <button
          type="submit"
          class="${enabled
            ? 'btn-ghost text-sm'
            : 'btn-block-sm'}"
        >
          ${enabled ? 'Turn texting off' : 'Turn texting on'}
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
        What setup looks like when you go live. Fields are switched off here — this is
        a preview of the steps, which Sagan walks you through.
      </p>
    </header>
    <div class="p-5 grid md:grid-cols-3 gap-3">
      ${connectCard(
        'appfolio',
        'AppFolio',
        'Turns on the direct connection once Kestrel authorizes the integration. Credentials are issued by AppFolio when API access is provisioned.',
      )}
      ${connectCard(
        'gmail',
        'Google Workspace',
        'Lets the agent send from and read replies at its own mailbox, and pick up the weekly maintenance report.',
      )}
      ${connectCard(
        'twilio',
        'Twilio',
        'Adds text messaging and the short voice call. Texting switches on once carrier registration for business messaging clears.',
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
        <h2 class="font-bold text-ink text-lg tracking-tight">Preview any job in any state</h2>
        <p class="text-sm text-ink-fade mt-0.5">
          Sample data only. Move a job to any point in its lifecycle to see how it looks.
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
