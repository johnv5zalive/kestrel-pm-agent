import { html } from 'hono/html'
import {
  STATE_LANE_LABELS,
  STATE_LANE_ORDER,
  STATE_META,
  type StateLane,
} from '../agent/state_machine.js'
import type { JobQueueRow } from '../db/queries_inbox.js'
import {
  DEMO_CLOCK_RANGE,
  DEMO_SNAP_POINTS,
  offsetFromIso,
} from '../routes/demo.js'
import { layout } from './layout.js'
import {
  formatDueDate,
  formatRelative,
  stateBadge,
  v2Chip,
} from './_components.js'

interface InboxProps {
  jobs: JobQueueRow[]
  demoClockIso: string
  smsOutboundEnabled: boolean
  ingestAdapter: string
  tourStep?: number
  /** 'forward' = scheduler ran; 'back' = clock rewound, scheduler skipped. */
  tick?: 'forward' | 'back'
  tickDays?: number
  flashedRseIds?: string[]
}

const ADAPTER_LABEL: Record<string, string> = {
  adapter1: 'Direct connection',
  adapter2a: 'Automatic weekly report',
  adapter2b_full: 'Manual weekly export',
  adapter2b_degraded: 'Manual weekly export — no contact columns',
}

export const inboxPage = (p: InboxProps) =>
  layout({
    title: 'Coordinator inbox · Kestrel Maintenance Scheduling Agent',
    tourStep: p.tourStep,
    currentPath: '/inbox',
    body: html`
      <div class="max-w-7xl mx-auto px-6 py-8" data-job-count="${p.jobs.length}">
        ${inboxHeader(p)}
        ${tickToast(p)}
        ${timeTravelControl(p.demoClockIso)}
        ${laneList(p.jobs, new Set(p.flashedRseIds ?? []), p.demoClockIso)}
      </div>
    `,
  })

const tickToast = (p: InboxProps) => {
  if (!p.tick) return ''
  const flashed = p.flashedRseIds ?? []
  const days = p.tickDays ?? 0
  const dayLabel = days === 1 ? '1 day' : `${days} days`

  if (p.tick === 'back') {
    return html`
      <div
        class="rounded-md border border-canvas-deep bg-canvas px-4 py-2.5 mb-4 flex items-start gap-3 text-sm text-ink-fade"
      >
        <svg class="w-4 h-4 mt-0.5 text-ink-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <div>
          Moved back ${dayLabel}. <strong>Going back doesn't undo what already happened</strong>, so jobs stay where they are. Use
          <span class="font-medium">Restart demo</span> for a clean slate.
        </div>
      </div>
    `
  }

  if (flashed.length > 0) {
    return html`
      <div
        class="rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2.5 mb-4 flex items-start gap-3 text-sm text-emerald-900"
      >
        <svg class="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          Advanced ${dayLabel} ·
          <strong>${flashed.length} job${flashed.length === 1 ? '' : 's'} progressed.</strong>
          Highlighted cards are the ones that changed.
        </div>
      </div>
    `
  }

  return html`
    <div
      class="rounded-md border border-demo-gold-line/40 bg-demo-gold-soft/60 px-4 py-2.5 mb-4 flex items-start gap-3 text-sm text-demo-gold-deep"
    >
      <svg class="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
      </svg>
      <div>
        Advanced ${dayLabel} · <strong>nothing moved at this date.</strong>
        Keep dragging — the next visits to start their reminders are Maplewood,
        Northgate and Harbor Point in June.
      </div>
    </div>
  `
}

const inboxHeader = (p: InboxProps) => {
  const counts = countByLane(p.jobs)
  return html`
    <div class="flex items-start justify-between flex-wrap gap-4 mb-6">
      <div>
        <h1 class="font-black text-ink text-3xl tracking-tight">Coordinator inbox</h1>
        <p class="text-ink-fade mt-1">
          ${p.jobs.length} maintenance visits. Anything needing your attention is at the top.
        </p>
        <div class="flex flex-wrap gap-2 mt-3">
          ${v2Chip('predict-score', 'Predictive booking-likelihood')}
          ${v2Chip('generic-inbox', 'Generic team inbox')}
        </div>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <span
          class="inline-flex items-center gap-2 rounded-md border border-canvas-deep bg-white px-3 py-1.5 text-xs text-ink"
          title="The date the demo is currently set to"
        >
          <svg
            class="w-3.5 h-3.5 text-ink-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="2"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span class="text-ink-muted">Demo clock</span>
          <span class="font-mono">${formatClockShort(p.demoClockIso)}</span>
        </span>
        <span
          class="inline-flex items-center gap-2 rounded-md border border-canvas-deep bg-white px-3 py-1.5 text-xs"
          title="Where the agent is reading your schedule from. Change it in admin."
        >
          <span class="text-ink-muted">Ingest</span>
          <span class="font-mono text-ink">${ADAPTER_LABEL[p.ingestAdapter] ?? p.ingestAdapter}</span>
        </span>
        <span
          class="inline-flex items-center gap-2 rounded-md border ${p.smsOutboundEnabled
            ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
            : 'border-canvas-deep bg-white text-ink-muted'} px-3 py-1.5 text-xs"
          title="${p.smsOutboundEnabled
            ? 'The agent is sending texts'
            : 'Texting switches on once carrier registration clears'}"
        >
          <span class="w-1.5 h-1.5 rounded-full ${p.smsOutboundEnabled
            ? 'bg-emerald-500'
            : 'bg-ink-muted/40'}"></span>
          Texting ${p.smsOutboundEnabled ? 'on' : 'not on yet'}
        </span>
      </div>
    </div>
  `
}

const timeTravelControl = (clockIso: string) => {
  const offset = offsetFromIso(clockIso)
  const snapPercent = (o: number) =>
    ((o - DEMO_CLOCK_RANGE.min) / (DEMO_CLOCK_RANGE.max - DEMO_CLOCK_RANGE.min)) * 100
  return html`
    <section
      data-tour-highlight="time-travel"
      class="rounded-lg border border-canvas-deep bg-white p-4 mb-6"
      aria-label="Demo date control"
    >
      <div class="flex items-start justify-between mb-2 flex-wrap gap-3">
        <div class="min-w-0">
          <div class="flex items-baseline gap-2 flex-wrap">
            <span class="text-[11px] uppercase tracking-wider text-ink-muted font-bold">
              Move the date forward
            </span>
          </div>
          <p class="text-sm text-ink-fade mt-1 leading-snug max-w-xl">
            Drag to move the date forward. Ten days of reminders and replies
            compress into a few seconds.
          </p>
        </div>
        <form method="POST" action="/demo/_reset-seed" class="inline-flex">
          <button type="submit" class="btn-ghost text-xs">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.667 0l3.181-3.183m-4.991-2.691v4.992m0 0h4.992m-4.992 0l-3.181-3.183M2.985 9.348a8.25 8.25 0 0114.064-3.183l3.181 3.183" />
            </svg>
            Restart demo
          </button>
        </form>
      </div>
      <form
        method="POST"
        action="/demo/_set-clock"
        class="relative"
        onchange="this.submit()"
      >
        <input
          type="range"
          name="dayOffset"
          min="${DEMO_CLOCK_RANGE.min}"
          max="${DEMO_CLOCK_RANGE.max}"
          value="${offset}"
          step="1"
          aria-label="Demo clock"
          class="w-full accent-brand-navy"
          oninput="document.getElementById('clock-readout').textContent = (function(){
            const anchor = new Date('2026-04-15T09:00:00Z');
            anchor.setUTCDate(anchor.getUTCDate() + parseInt(this.value, 10));
            return anchor.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
          }).call(this)"
        />
        <noscript>
          <button type="submit" class="btn-primary text-xs mt-2">Apply</button>
        </noscript>
      </form>
      <div class="relative mt-1 h-5">
        ${DEMO_SNAP_POINTS.map(
          (s) => html`
            <div
              class="absolute top-0 -translate-x-1/2 text-[10px] text-ink-muted"
              style="left: ${snapPercent(s.offset)}%"
            >
              <div class="w-px h-1.5 bg-ink-muted/40 mx-auto"></div>
              <div class="text-center pt-0.5 leading-tight">
                <div class="font-bold uppercase tracking-wider text-[9px] text-ink-fade">
                  ${s.label}
                </div>
                <div>${s.subLabel}</div>
              </div>
            </div>
          `,
        )}
      </div>
      <div class="mt-7 text-xs text-ink-muted flex items-center justify-between">
        <span>
          Current:
          <span id="clock-readout" class="font-mono text-ink ml-1">${formatClockShort(clockIso)}</span>
        </span>
        <span class="text-[11px] italic">
          To go back, use Restart demo.
        </span>
      </div>
    </section>
  `
}

const countByLane = (jobs: JobQueueRow[]): Partial<Record<StateLane, number>> => {
  const out: Partial<Record<StateLane, number>> = {}
  for (const j of jobs) {
    const lane = STATE_META[j.state].lane
    out[lane] = (out[lane] ?? 0) + 1
  }
  return out
}

const laneList = (jobs: JobQueueRow[], flashedSet: Set<string>, demoClockIso: string) => {
  const grouped = STATE_LANE_ORDER.map((lane) => ({
    lane,
    jobs: jobs.filter((j) => STATE_META[j.state].lane === lane),
  })).filter((g) => g.jobs.length > 0)
  return html`
    <div class="space-y-8">
      ${grouped.map(
        (g) => html`
          <section ${g.lane === 'queue-awaiting' ? html`data-tour-highlight="lane-awaiting"` : ''}>
            <div class="flex items-baseline gap-3 mb-3">
              <h2 class="font-bold text-ink text-lg tracking-tight">
                ${STATE_LANE_LABELS[g.lane]}
              </h2>
              <span class="text-ink-muted text-sm">${g.jobs.length} job${g.jobs.length === 1 ? '' : 's'}</span>
            </div>
            <div class="grid lg:grid-cols-2 gap-3">${g.jobs.map((j) => jobCard(j, flashedSet.has(j.rse_id), demoClockIso))}</div>
          </section>
        `,
      )}
    </div>
  `
}

const jobCard = (j: JobQueueRow, justFlashed: boolean, demoClockIso: string) => {
  const meta = STATE_META[j.state]
  return html`
    <a
      href="/inbox/${j.rse_id}"
      class="block rounded-lg border ${justFlashed ? 'border-emerald-300 ring-2 ring-emerald-200' : 'border-canvas-deep'} bg-white p-4 hover:border-brand-navy/30 hover:shadow-card transition-all group ${justFlashed ? 'tick-flash' : ''}"
    >
      <div class="flex items-start justify-between gap-3 mb-2">
        <div class="min-w-0 flex-1">
          <h3 class="font-bold text-ink text-base leading-tight group-hover:text-brand-navy transition-colors truncate">
            ${j.customer_name}
          </h3>
          <p class="text-xs text-ink-muted mt-0.5 truncate">
            ${j.recurring_service_name} ·
            ${j.equipment_count} asset${j.equipment_count === 1 ? '' : 's'} ·
            ${j.location_city}, ${j.location_state}
          </p>
        </div>
        ${stateBadge(j.state, { size: 'sm' })}
      </div>

      ${j.latest_reply_text
        ? html`
            <div class="mt-2.5 mb-2 px-3 py-2 rounded bg-canvas border border-canvas-deep text-sm text-ink leading-snug">
              <span class="text-ink-muted text-[11px] uppercase tracking-wider font-bold mr-2">
                ${j.latest_reply_classification ?? 'reply'}${j.latest_reply_parsed_date
                  ? html` · <span class="font-mono">${j.latest_reply_parsed_date}</span>`
                  : ''}
              </span>
              <span class="line-clamp-2">${truncate(j.latest_reply_text, 140)}</span>
            </div>
          `
        : ''}

      <div class="flex items-center justify-between text-[11px] text-ink-muted mt-2">
        <span class="font-mono">${j.rse_id}</span>
        <span>${formatDueDate(j.due_date, demoClockIso)}</span>
      </div>

      ${meta.cta
        ? html`
            <div class="mt-3 pt-3 border-t border-canvas-deep flex items-center justify-between gap-2">
              <span class="text-[11px] text-ink-muted">
                ${j.outreach_count} outreach · ${j.reply_count} repl${j.reply_count === 1 ? 'y' : 'ies'}
              </span>
              <span
                class="${meta.cta.class === 'btn-block'
                  ? 'btn-block-sm'
                  : meta.cta.class === 'btn-primary'
                    ? 'btn-primary text-xs'
                    : 'btn-ghost text-xs'} pointer-events-none"
              >
                ${meta.cta.label}
              </span>
            </div>
          `
        : html`
            <div class="mt-2 pt-2 border-t border-canvas-deep text-[11px] text-ink-muted flex items-center justify-between">
              <span>${j.outreach_count} outreach · ${j.reply_count} repl${j.reply_count === 1 ? 'y' : 'ies'}</span>
              ${j.last_activity_iso
                ? html`<span>updated ${formatRelative(j.last_activity_iso, demoClockIso)}</span>`
                : ''}
            </div>
          `}
    </a>
  `
}

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)

const formatClockShort = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  })
}
