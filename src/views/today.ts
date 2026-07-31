import { html } from 'hono/html'
import { URGENCY_META } from '../agent/approval_state.js'
import {
  summarise,
  trackLabel,
  type WorkItem,
  type WorkLane,
} from '../db/worklist.js'
import { layout } from './layout.js'
import { formatRelative } from './_components.js'

interface Props {
  items: WorkItem[]
  demoClockIso: string
}

const money = (n: number) => `$${n.toLocaleString('en-US')}`

const TRACK_TONE: Record<string, string> = {
  visit: 'bg-brand-sky-soft text-brand-navy border-brand-sky/40',
  approval: 'bg-demo-gold-soft text-demo-gold-deep border-demo-gold-line/50',
  compliance: 'bg-slate-100 text-slate-700 border-slate-300',
}

export const todayPage = (p: Props) => {
  const s = summarise(p.items)
  const lanes: Array<{ lane: WorkLane; title: string; blurb: string }> = [
    {
      lane: 'needs-you',
      title: 'Waiting on you',
      blurb: 'Someone has answered, or a deadline has passed. Nothing moves until you act.',
    },
    {
      lane: 'gone-quiet',
      title: 'Gone quiet',
      blurb:
        'Open, but nothing has happened for a while. This is where jobs get lost.',
    },
    {
      lane: 'waiting',
      title: 'The agent is handling these',
      blurb: 'Chased and waiting on a reply. No action needed from you.',
    },
  ]
  return layout({
    title: 'Today · Kestrel Maintenance Scheduling Agent',
    currentPath: '/today',
    body: html`
      <div class="max-w-7xl mx-auto px-6 py-8">
        <div class="mb-6">
          <h1 class="font-black text-ink text-3xl tracking-tight">Today</h1>
          <p class="text-ink-fade mt-1 max-w-3xl">
            Everything the agent is working on, in one list, ordered by what actually
            needs a person. Scheduled visits, owner approvals and vendor insurance all
            appear here together, because that is how the day arrives.
          </p>
        </div>

        ${summaryBar(s)}

        <div class="space-y-8">
          ${lanes.map((l) => {
            const rows = p.items.filter((i) => i.lane === l.lane)
            if (rows.length === 0) return ''
            return html`
              <section ${l.lane === 'needs-you' ? html`data-tour-highlight="lane-today"` : ''}>
                <div class="flex items-baseline gap-3 mb-1">
                  <h2 class="font-bold text-ink text-lg tracking-tight">${l.title}</h2>
                  <span class="text-ink-muted text-sm">${rows.length}</span>
                </div>
                <p class="text-[11px] text-ink-muted mb-3">${l.blurb}</p>
                <div class="rounded-lg border border-canvas-deep bg-white divide-y divide-canvas-deep">
                  ${rows.map((i) => row(i, p.demoClockIso))}
                </div>
              </section>
            `
          })}
        </div>

        <div class="mt-10 grid sm:grid-cols-3 gap-3">
          ${trackLink('/inbox', 'Scheduled visits', 'Getting a date agreed for maintenance that is already booked in.')}
          ${trackLink('/approvals', 'Owner approvals', 'Repairs over the owner’s limit that cannot start without a yes.')}
          ${trackLink('/compliance', 'Vendor compliance', 'Insurance certificates, and who cannot be dispatched today.')}
        </div>
      </div>
    `,
  })
}

const summaryBar = (s: ReturnType<typeof summarise>) => html`
  <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
    ${card(String(s.needsYou), s.needsYou === 1 ? 'thing needs you' : 'things need you', s.emergencies > 0 ? `${s.emergencies} marked emergency` : 'Nothing marked emergency', s.emergencies > 0 ? 'red' : 'sky')}
    ${card(String(s.goneQuiet), 'have gone quiet', 'Open, with no recent movement', s.goneQuiet > 0 ? 'gold' : 'plain')}
    ${card(money(s.dollarsHeldUp), 'waiting on a decision', 'Across all open approvals', 'plain')}
    ${card(String(s.blockedVendors), s.blockedVendors === 1 ? 'vendor blocked' : 'vendors blocked', 'Lapsed cover, cannot be dispatched', s.blockedVendors > 0 ? 'red' : 'green')}
  </div>
`

const card = (value: string, label: string, sub: string, tone: 'red' | 'gold' | 'sky' | 'green' | 'plain') => {
  const cls = {
    red: 'border-red-300 bg-red-50/70',
    gold: 'border-demo-gold-line/50 bg-demo-gold-soft/40',
    sky: 'border-brand-sky/40 bg-brand-sky-soft/40',
    green: 'border-emerald-200 bg-emerald-50/60',
    plain: 'border-canvas-deep bg-white',
  }[tone]
  return html`
    <div class="rounded-lg border ${cls} p-4">
      <div class="font-black text-ink text-2xl tracking-tight leading-none">${value}</div>
      <div class="text-sm text-ink mt-1.5 font-medium">${label}</div>
      <div class="text-[11px] text-ink-muted mt-1">${sub}</div>
    </div>
  `
}

const row = (i: WorkItem, nowIso: string) => html`
  <a href="${i.href}" class="block px-4 py-3 hover:bg-canvas transition-colors group">
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2 flex-wrap mb-0.5">
          <span
            class="inline-flex items-center rounded border font-bold uppercase tracking-wider text-[10px] px-1.5 py-0.5 ${TRACK_TONE[i.track]}"
            >${trackLabel(i.track)}</span
          >
          ${i.urgency && i.urgency !== 'routine'
            ? html`<span
                class="inline-flex items-center rounded-full border font-bold uppercase tracking-wider text-[10px] px-1.5 py-0.5 ${URGENCY_META[i.urgency].cls}"
                >${URGENCY_META[i.urgency].label}</span
              >`
            : ''}
          <span class="font-bold text-ink text-sm group-hover:text-brand-navy transition-colors truncate">
            ${i.title}
          </span>
        </div>
        <div class="text-xs text-ink-muted truncate">${i.subtitle}</div>
        ${i.riskNote
          ? html`<div class="text-[11px] text-red-800 mt-1 leading-snug">${i.riskNote}</div>`
          : ''}
      </div>
      <div class="text-right flex-shrink-0">
        ${i.valueUsd ? html`<div class="font-bold text-ink text-sm">${money(i.valueUsd)}</div>` : ''}
        <div class="text-[11px] text-ink-muted">${i.stateLabel}</div>
        ${i.lastActivityIso
          ? html`<div class="text-[11px] text-ink-muted">${formatRelative(i.lastActivityIso, nowIso)}</div>`
          : ''}
      </div>
    </div>
    ${i.ctaLabel
      ? html`<div class="mt-2">
          <span class="btn-block-sm pointer-events-none">${i.ctaLabel}</span>
        </div>`
      : ''}
  </a>
`

const trackLink = (href: string, title: string, blurb: string) => html`
  <a
    href="${href}"
    class="block rounded-lg border border-canvas-deep bg-white p-4 hover:border-brand-navy/30 hover:shadow-card transition-all group"
  >
    <div class="font-bold text-ink text-sm group-hover:text-brand-navy transition-colors mb-1">
      ${title}
    </div>
    <p class="text-xs text-ink-fade leading-relaxed">${blurb}</p>
  </a>
`
