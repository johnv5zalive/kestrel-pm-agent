import { html } from 'hono/html'
import {
  APPROVAL_LANE_LABELS,
  APPROVAL_LANE_ORDER,
  APPROVAL_META,
  URGENCY_META,
  type ApprovalLane,
} from '../agent/approval_state.js'
import {
  approvalStats,
  daysWaiting,
  isCappedBelowQuote,
  type ApprovalQueueRow,
} from '../db/approvals.js'
import { layout } from './layout.js'
import { formatRelative } from './_components.js'

interface ApprovalsProps {
  approvals: ApprovalQueueRow[]
  demoClockIso: string
}

export const approvalsPage = (p: ApprovalsProps) => {
  const stats = approvalStats(p.approvals, p.demoClockIso)
  return layout({
    title: 'Owner approvals · Kestrel Maintenance Scheduling Agent',
    currentPath: '/approvals',
    body: html`
      <div class="max-w-7xl mx-auto px-6 py-8">
        <div class="mb-6">
          <h1 class="font-black text-ink text-3xl tracking-tight">Owner approvals</h1>
          <p class="text-ink-fade mt-1 max-w-3xl">
            Repairs over the owner's spending limit cannot start until they say yes.
            The agent asks, chases, reads the answer, and only brings you the ones
            where a person has to do something.
          </p>
        </div>

        ${statsBar(stats)}
        ${laneList(p.approvals, p.demoClockIso)}
      </div>
    `,
  })
}

const money = (n: number) => `$${n.toLocaleString('en-US')}`

const statsBar = (s: ReturnType<typeof approvalStats>) => html`
  <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
    ${statCard(
      money(s.dollarsHeldUp),
      'of work waiting on a decision',
      s.openCount === 1 ? '1 open request' : `${s.openCount} open requests`,
      'gold',
    )}
    ${statCard(
      String(s.needsYouCount),
      s.needsYouCount === 1 ? 'needs you now' : 'need you now',
      'The owner has answered',
      'sky',
    )}
    ${statCard(
      s.avgDaysToDecision === null ? '—' : `${s.avgDaysToDecision.toFixed(1)} days`,
      'average time to a decision',
      s.slowestOwner
        ? `Slowest right now: ${s.slowestOwner.name}, ${s.slowestOwner.days.toFixed(0)} days`
        : 'No open requests',
      'plain',
    )}
    ${statCard(
      money(s.autoApprovedDollars),
      'approved without asking',
      `${s.autoApprovedCount} under the owner's limit`,
      'green',
    )}
  </div>
`

const statCard = (
  value: string,
  label: string,
  sub: string,
  tone: 'gold' | 'sky' | 'green' | 'plain',
) => {
  const toneCls = {
    gold: 'border-demo-gold-line/50 bg-demo-gold-soft/40',
    sky: 'border-brand-sky/40 bg-brand-sky-soft/40',
    green: 'border-emerald-200 bg-emerald-50/60',
    plain: 'border-canvas-deep bg-white',
  }[tone]
  return html`
    <div class="rounded-lg border ${toneCls} p-4">
      <div class="font-black text-ink text-2xl tracking-tight leading-none">${value}</div>
      <div class="text-sm text-ink mt-1.5 font-medium">${label}</div>
      <div class="text-[11px] text-ink-muted mt-1">${sub}</div>
    </div>
  `
}

const laneList = (rows: ApprovalQueueRow[], nowIso: string) => {
  const grouped = APPROVAL_LANE_ORDER.map((lane) => ({
    lane,
    rows: rows.filter((r) => APPROVAL_META[r.state].lane === lane),
  })).filter((g) => g.rows.length > 0)
  return html`
    <div class="space-y-8">
      ${grouped.map(
        (g) => html`
          <section ${g.lane === 'needs-you' ? html`data-tour-highlight="lane-approvals"` : ''}>
            <div class="flex items-baseline gap-3 mb-3">
              <h2 class="font-bold text-ink text-lg tracking-tight">
                ${APPROVAL_LANE_LABELS[g.lane]}
              </h2>
              <span class="text-ink-muted text-sm">
                ${g.rows.length} ${g.rows.length === 1 ? 'request' : 'requests'}
              </span>
              ${laneHint(g.lane)}
            </div>
            <div class="grid lg:grid-cols-2 gap-3">
              ${g.rows.map((r) => approvalCard(r, nowIso))}
            </div>
          </section>
        `,
      )}
    </div>
  `
}

const laneHint = (lane: ApprovalLane) => {
  const hint: Partial<Record<ApprovalLane, string>> = {
    'needs-you': 'The owner has replied. Nothing moves until you act.',
    overdue: 'Every automated attempt used. These need a phone call.',
    'waiting-owner': 'The agent is still chasing. No action needed from you.',
  }
  const text = hint[lane]
  return text ? html`<span class="text-[11px] text-ink-muted italic">${text}</span>` : ''
}

const approvalCard = (r: ApprovalQueueRow, nowIso: string) => {
  const meta = APPROVAL_META[r.state]
  const urgency = URGENCY_META[r.urgency]
  const waited = daysWaiting(r, nowIso)
  const capped = isCappedBelowQuote(r)
  const overdue = r.respond_by_iso && new Date(r.respond_by_iso).getTime() < new Date(nowIso).getTime()

  return html`
    <a
      href="/approvals/${r.id}"
      class="block rounded-lg border ${capped || overdue
        ? 'border-red-300 ring-1 ring-red-200'
        : 'border-canvas-deep'} bg-white p-4 hover:border-brand-navy/30 hover:shadow-card transition-all group"
    >
      <div class="flex items-start justify-between gap-3 mb-2">
        <div class="min-w-0 flex-1">
          <h3 class="font-bold text-ink text-base leading-tight group-hover:text-brand-navy transition-colors">
            ${r.summary}
          </h3>
          <p class="text-xs text-ink-muted mt-0.5 truncate">
            ${r.property_name} · ${r.location_city}, ${r.location_state}
          </p>
        </div>
        <span
          class="inline-flex items-center gap-1.5 rounded-full border font-bold uppercase tracking-wider text-[10px] px-1.5 py-0.5 ${urgency.cls}"
        >
          ${urgency.label}
        </span>
      </div>

      <div class="flex items-baseline gap-2 flex-wrap mb-2">
        <span class="font-black text-ink text-xl tracking-tight">${money(r.quote_usd)}</span>
        <span class="text-xs text-ink-muted">
          ${r.owner_name} · limit ${money(r.owner_limit_usd)}
        </span>
      </div>

      ${capped
        ? html`
            <div class="mb-2 px-3 py-2 rounded bg-red-50 border border-red-200 text-sm text-red-900 leading-snug">
              <strong>Approved at ${money(r.approved_amount_usd ?? 0)}, quoted at ${money(r.quote_usd)}.</strong>
              Dispatching on this leaves ${money(r.quote_usd - (r.approved_amount_usd ?? 0))}
              unaccounted for. Go back to the owner before booking.
            </div>
          `
        : ''}

      ${r.respond_by_iso && !r.decided_at_iso
        ? html`
            <div
              class="mb-2 px-3 py-1.5 rounded text-[11px] leading-snug ${overdue
                ? 'bg-red-50 border border-red-200 text-red-900'
                : 'bg-demo-gold-soft/60 border border-demo-gold-line/40 text-demo-gold-deep'}"
            >
              ${overdue ? 'Response deadline passed' : 'Response needed by'}
              <span class="font-mono font-bold">${shortDateTime(r.respond_by_iso)}</span>
              ${r.tenant_impact ? html` · ${r.tenant_impact}` : ''}
            </div>
          `
        : r.tenant_impact
          ? html`<p class="text-[11px] text-ink-muted mb-2">${r.tenant_impact}</p>`
          : ''}

      ${r.latest_reply_text
        ? html`
            <div class="mt-2 mb-2 px-3 py-2 rounded bg-canvas border border-canvas-deep text-sm text-ink leading-snug">
              <span class="text-ink-muted text-[11px] uppercase tracking-wider font-bold mr-2">
                ${r.latest_reply_classification ?? 'reply'}
              </span>
              <span class="line-clamp-2">${truncate(r.latest_reply_text, 150)}</span>
            </div>
          `
        : ''}

      <div class="flex items-center justify-between text-[11px] text-ink-muted mt-2">
        <span class="font-mono">${r.id}</span>
        <span>
          ${r.decided_at_iso
            ? html`decided after ${waited.toFixed(1)}d`
            : html`<span class="${waited > 4 ? 'text-red-700 font-bold' : ''}"
                >waiting ${waited.toFixed(1)}d</span
              >`}
        </span>
      </div>

      <div class="mt-3 pt-3 border-t border-canvas-deep flex items-center justify-between gap-2">
        <span class="text-[11px] text-ink-muted">
          ${r.outreach_count} sent · ${r.reply_count} ${r.reply_count === 1 ? 'reply' : 'replies'}
          ${r.last_activity_iso
            ? html` · ${formatRelative(r.last_activity_iso, nowIso)}`
            : ''}
        </span>
        ${meta.cta
          ? html`<span
              class="${meta.cta.class === 'btn-block'
                ? 'btn-block-sm'
                : meta.cta.class === 'btn-primary'
                  ? 'btn-primary text-xs'
                  : 'btn-ghost text-xs'} pointer-events-none"
              >${meta.cta.label}</span
            >`
          : html`<span class="text-[11px] text-ink-muted italic">${meta.shortLabel}</span>`}
      </div>
    </a>
  `
}

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)

const shortDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  })
