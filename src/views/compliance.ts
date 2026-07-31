import { html } from 'hono/html'
import {
  COMPLIANCE_LANE_LABELS,
  COMPLIANCE_LANE_ORDER,
  COMPLIANCE_META,
  DOC_TYPE_LABELS,
  daysUntil,
} from '../agent/compliance_state.js'
import { complianceStats, type ComplianceRow } from '../db/compliance.js'
import { layout } from './layout.js'
import { formatRelative } from './_components.js'

interface Props {
  docs: ComplianceRow[]
  demoClockIso: string
}

const money = (n: number) => `$${n.toLocaleString('en-US')}`

export const compliancePage = (p: Props) => {
  const stats = complianceStats(p.docs, p.demoClockIso)
  return layout({
    title: 'Vendor compliance · Kestrel Maintenance Scheduling Agent',
    currentPath: '/compliance',
    body: html`
      <div class="max-w-7xl mx-auto px-6 py-8">
        <div class="mb-6">
          <h1 class="font-black text-ink text-3xl tracking-tight">Vendor compliance</h1>
          <p class="text-ink-fade mt-1 max-w-3xl">
            Insurance certificates expire quietly. The agent watches every expiry date,
            chases the renewal at 30, 14 and 7 days, and takes a vendor off the dispatch
            list the moment cover lapses.
          </p>
        </div>

        ${stats.lapsedWithOpenWork > 0 ? exposureBanner(stats) : ''}
        ${statsBar(stats)}
        ${laneList(p.docs, p.demoClockIso)}
      </div>
    `,
  })
}

const exposureBanner = (s: ReturnType<typeof complianceStats>) => html`
  <div class="rounded-lg border border-red-300 bg-red-50 p-4 mb-6">
    <div class="flex items-start gap-3">
      <svg class="w-5 h-5 text-red-700 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      <div class="text-sm text-red-900 leading-relaxed">
        <strong class="block mb-1">
          ${s.lapsedWithOpenWork === 1
            ? 'One vendor with lapsed cover is on live work.'
            : `${s.lapsedWithOpenWork} vendors with lapsed cover are on live work.`}
        </strong>
        ${money(s.exposedDollars)} of open jobs are quoted to vendors who cannot currently
        be dispatched. Sending one of them is the mistake this page exists to prevent.
      </div>
    </div>
  </div>
`

const statsBar = (s: ReturnType<typeof complianceStats>) => html`
  <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
    ${statCard(
      String(s.lapsedCount),
      s.lapsedCount === 1 ? 'certificate lapsed' : 'certificates lapsed',
      s.lapsedWithOpenWork > 0
        ? `${s.lapsedWithOpenWork} on live work`
        : 'None on live work',
      s.lapsedCount > 0 ? 'red' : 'green',
    )}
    ${statCard(
      String(s.needsYouCount),
      s.needsYouCount === 1 ? 'needs checking' : 'need checking',
      'A document came back',
      'sky',
    )}
    ${statCard(String(s.chasingCount), 'being chased', 'Inside the renewal window', 'gold')}
    ${statCard(
      s.nextExpiryDays === null ? '—' : `${s.nextExpiryDays} days`,
      'to the next expiry',
      `${s.currentCount} in date`,
      'plain',
    )}
  </div>
`

const statCard = (
  value: string,
  label: string,
  sub: string,
  tone: 'red' | 'gold' | 'sky' | 'green' | 'plain',
) => {
  const toneCls = {
    red: 'border-red-300 bg-red-50/70',
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

const laneList = (rows: ComplianceRow[], nowIso: string) => {
  const grouped = COMPLIANCE_LANE_ORDER.map((lane) => ({
    lane,
    rows: rows.filter((r) => COMPLIANCE_META[r.state].lane === lane),
  })).filter((g) => g.rows.length > 0)
  return html`
    <div class="space-y-8">
      ${grouped.map(
        (g) => html`
          <section>
            <div class="flex items-baseline gap-3 mb-3">
              <h2 class="font-bold text-ink text-lg tracking-tight">
                ${COMPLIANCE_LANE_LABELS[g.lane]}
              </h2>
              <span class="text-ink-muted text-sm">${g.rows.length}</span>
            </div>
            <div class="grid lg:grid-cols-2 gap-3">
              ${g.rows.map((r) => docCard(r, nowIso))}
            </div>
          </section>
        `,
      )}
    </div>
  `
}

const docCard = (r: ComplianceRow, nowIso: string) => {
  const meta = COMPLIANCE_META[r.state]
  const days = daysUntil(r.expires_on, nowIso)
  const blocked = meta.blocksDispatch
  const atRisk = blocked && r.open_job_count > 0
  return html`
    <a
      href="/compliance/${r.id}"
      class="block rounded-lg border ${atRisk
        ? 'border-red-300 ring-1 ring-red-200'
        : blocked
          ? 'border-red-200'
          : 'border-canvas-deep'} bg-white p-4 hover:border-brand-navy/30 hover:shadow-card transition-all group"
    >
      <div class="flex items-start justify-between gap-3 mb-2">
        <div class="min-w-0 flex-1">
          <h3 class="font-bold text-ink text-base leading-tight group-hover:text-brand-navy transition-colors">
            ${r.vendor_name}
          </h3>
          <p class="text-xs text-ink-muted mt-0.5">
            ${r.trade} · ${DOC_TYPE_LABELS[r.doc_type] ?? r.doc_type}
          </p>
        </div>
        ${blocked
          ? html`<span class="inline-flex items-center rounded-full border border-red-300 bg-red-100 text-red-800 font-bold uppercase tracking-wider text-[10px] px-2 py-0.5">
              Do not dispatch
            </span>`
          : html`<span class="text-[11px] text-ink-muted">${meta.shortLabel}</span>`}
      </div>

      <div class="flex items-baseline gap-2 flex-wrap mb-2">
        <span class="text-sm text-ink">
          ${days < 0
            ? html`<span class="font-bold text-red-700"
                >Expired ${Math.abs(days)} ${Math.abs(days) === 1 ? 'day' : 'days'} ago</span
              >`
            : days <= 14
              ? html`<span class="font-bold text-amber-800">Expires in ${days} days</span>`
              : html`Expires in ${days} days`}
        </span>
        <span class="text-xs text-ink-muted font-mono">${r.expires_on}</span>
      </div>

      ${atRisk
        ? html`
            <div class="mb-2 px-3 py-2 rounded bg-red-50 border border-red-200 text-sm text-red-900 leading-snug">
              <strong>On ${r.open_job_count} live ${r.open_job_count === 1 ? 'job' : 'jobs'}
              worth ${money(r.open_job_value_usd)}.</strong>
              Nobody can send them until this is renewed.
            </div>
          `
        : ''}

      <div class="flex items-center justify-between text-[11px] text-ink-muted mt-2">
        <span class="font-mono">${r.policy_number ?? r.id}</span>
        <span>
          ${r.coverage_usd ? html`${money(r.coverage_usd)} cover` : (r.carrier ?? '')}
        </span>
      </div>

      <div class="mt-3 pt-3 border-t border-canvas-deep flex items-center justify-between gap-2">
        <span class="text-[11px] text-ink-muted">
          ${r.outreach_count} sent · ${r.reply_count} ${r.reply_count === 1 ? 'reply' : 'replies'}
          ${r.last_activity_iso ? html` · ${formatRelative(r.last_activity_iso, nowIso)}` : ''}
        </span>
        ${meta.cta
          ? html`<span
              class="${meta.cta.class === 'btn-block' ? 'btn-block-sm' : 'btn-primary text-xs'} pointer-events-none"
              >${meta.cta.label}</span
            >`
          : ''}
      </div>
    </a>
  `
}
