import { html } from 'hono/html'
import { APPROVAL_META, URGENCY_META } from '../agent/approval_state.js'
import { daysWaiting, isCappedBelowQuote, type ApprovalDetail } from '../db/approvals.js'
import { layout } from './layout.js'
import { formatRelative, interceptBanner } from './_components.js'

interface Props {
  detail: ApprovalDetail
  demoClockIso: string
}

const money = (n: number) => `$${n.toLocaleString('en-US')}`

export const approvalDetailPage = (p: Props) => {
  const a = p.detail.approval
  return layout({
    title: `${a.summary} · Kestrel Maintenance Scheduling Agent`,
    currentPath: `/approvals/${a.id}`,
    body: html`
      <div class="max-w-7xl mx-auto px-6 py-6">
        ${header(p)}
        <div class="mt-6 grid lg:grid-cols-12 gap-6">
          <div class="lg:col-span-7 space-y-4">
            ${cappedWarning(p)}
            ${conversation(p)}
          </div>
          <div class="lg:col-span-5 space-y-5">
            ${jobCard(p)}
            ${ownerCard(p)}
            ${timeline(p)}
          </div>
        </div>
      </div>
    `,
  })
}

const header = (p: Props) => {
  const a = p.detail.approval
  const meta = APPROVAL_META[a.state]
  const urgency = URGENCY_META[a.urgency]
  const waited = daysWaiting(a, p.demoClockIso)
  return html`
    <div>
      <a
        href="/approvals"
        class="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink mb-3 transition-colors"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to approvals
      </a>
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2 flex-wrap mb-2">
            <span
              class="inline-flex items-center gap-1.5 rounded-full border font-bold uppercase tracking-wider text-[11px] px-2 py-0.5 ${urgency.cls}"
              >${urgency.label}</span
            >
            <span class="text-xs font-mono text-ink-muted">${a.id}</span>
            <span class="text-xs text-ink-muted">·</span>
            <span class="text-xs ${waited > 4 && !a.decided_at_iso ? 'text-red-700 font-bold' : 'text-ink-muted'}">
              ${a.decided_at_iso
                ? html`decided after ${waited.toFixed(1)} days`
                : html`waiting ${waited.toFixed(1)} days`}
            </span>
          </div>
          <h1 class="font-black text-ink text-3xl tracking-tight leading-tight">${a.summary}</h1>
          <p class="text-ink-fade mt-1">
            ${a.property_name} · ${a.location_city}, ${a.location_state} ·
            ${a.trade ?? 'General'}
          </p>
          <p class="text-xs text-ink-muted mt-2">${meta.description}</p>
        </div>
        <div class="text-right">
          <div class="font-black text-ink text-3xl tracking-tight leading-none">
            ${money(a.quote_usd)}
          </div>
          <div class="text-[11px] text-ink-muted mt-1">quoted</div>
          ${meta.cta
            ? html`<span class="${meta.cta.class === 'btn-block' ? 'btn-block' : 'btn-primary'} mt-3 pointer-events-none"
                >${meta.cta.label}</span
              >`
            : ''}
        </div>
      </div>
    </div>
  `
}

const cappedWarning = (p: Props) => {
  const a = p.detail.approval
  if (!isCappedBelowQuote(a)) return ''
  const gap = a.quote_usd - (a.approved_amount_usd ?? 0)
  return html`
    <div class="rounded-lg border border-red-300 bg-red-50 p-4">
      <div class="flex items-start gap-3">
        <svg class="w-5 h-5 text-red-700 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <div class="text-sm text-red-900 leading-relaxed">
          <strong class="block mb-1">Approved below the quote.</strong>
          ${a.owner_name} approved ${money(a.approved_amount_usd ?? 0)} against a
          ${money(a.quote_usd)} quote. Booking this as it stands leaves
          <strong>${money(gap)}</strong> nobody has agreed to pay. The agent stopped
          rather than treating it as a straight yes.
        </div>
      </div>
    </div>
  `
}

const jobCard = (p: Props) => {
  const a = p.detail.approval
  return html`
    <section class="rounded-lg border border-canvas-deep bg-white">
      <header class="px-4 py-3 border-b border-canvas-deep">
        <span class="font-bold text-ink text-sm">The repair</span>
      </header>
      <div class="p-4 space-y-3 text-sm">
        ${a.detail ? html`<p class="text-ink leading-relaxed">${a.detail}</p>` : ''}
        ${a.tenant_impact
          ? html`
              <div>
                <div class="text-[11px] uppercase tracking-wider text-ink-muted font-bold mb-0.5">
                  What the resident is living with
                </div>
                <p class="text-ink">${a.tenant_impact}</p>
              </div>
            `
          : ''}
        ${a.respond_by_iso
          ? html`
              <div class="rounded-md border border-demo-gold-line/40 bg-demo-gold-soft/50 px-3 py-2">
                <div class="text-[11px] uppercase tracking-wider text-demo-gold-deep font-bold mb-0.5">
                  Response clock
                </div>
                <p class="text-sm text-demo-gold-deep font-medium">
                  ${shortDateTime(a.respond_by_iso)}
                </p>
                ${a.statute_note
                  ? html`<p class="text-[11px] text-demo-gold-deep/90 mt-1 leading-snug">
                      ${a.statute_note}
                    </p>`
                  : ''}
              </div>
            `
          : ''}
        <div class="pt-3 border-t border-canvas-deep grid grid-cols-2 gap-3 text-[11px] text-ink-fade">
          <div>
            <div class="uppercase tracking-wider text-ink-muted font-bold mb-0.5">Quoted</div>
            <div class="text-ink font-bold">${money(a.quote_usd)}</div>
          </div>
          <div>
            <div class="uppercase tracking-wider text-ink-muted font-bold mb-0.5">Approved</div>
            <div class="text-ink font-bold">
              ${a.approved_amount_usd === null ? '—' : money(a.approved_amount_usd)}
            </div>
          </div>
          <div>
            <div class="uppercase tracking-wider text-ink-muted font-bold mb-0.5">Raised</div>
            <div class="text-ink">${shortDateTime(a.raised_at_iso)}</div>
          </div>
          <div>
            <div class="uppercase tracking-wider text-ink-muted font-bold mb-0.5">Trade</div>
            <div class="text-ink">${a.trade ?? 'General'}</div>
          </div>
        </div>
      </div>
    </section>
  `
}

const ownerCard = (p: Props) => {
  const o = p.detail.owner
  const a = p.detail.approval
  const overLimit = a.quote_usd > o.approval_limit_usd
  return html`
    <section class="rounded-lg border border-canvas-deep bg-white">
      <header class="px-4 py-3 border-b border-canvas-deep">
        <span class="font-bold text-ink text-sm">The owner</span>
      </header>
      <div class="p-4 space-y-3 text-sm">
        <div>
          <div class="font-bold text-ink">${o.name}</div>
          ${o.company ? html`<div class="text-xs text-ink-fade">${o.company}</div>` : ''}
          <div class="text-xs text-ink-muted mt-1 flex flex-wrap gap-2">
            ${o.email ? html`<span class="font-mono">${o.email}</span>` : ''}
            ${o.phone ? html`<span class="font-mono">${o.phone}</span>` : ''}
          </div>
        </div>

        <div class="rounded-md bg-canvas border border-canvas-deep px-3 py-2">
          <div class="flex items-baseline justify-between">
            <span class="text-[11px] uppercase tracking-wider text-ink-muted font-bold">
              Spending limit
            </span>
            <span class="font-bold text-ink">${money(o.approval_limit_usd)}</span>
          </div>
          <p class="text-[11px] text-ink-muted mt-1 leading-snug">
            ${overLimit
              ? html`This quote is <strong>${money(a.quote_usd - o.approval_limit_usd)}</strong>
                  over the limit, so it had to be asked about.`
              : 'Under the limit. Work like this is approved automatically.'}
          </p>
        </div>

        <div class="grid grid-cols-2 gap-3 text-[11px]">
          <div>
            <div class="uppercase tracking-wider text-ink-muted font-bold mb-0.5">Prefers</div>
            <div class="text-ink capitalize">${o.preferred_channel}</div>
          </div>
          <div>
            <div class="uppercase tracking-wider text-ink-muted font-bold mb-0.5">
              Usually answers in
            </div>
            <div class="text-ink">
              ${o.typical_response_days === null
                ? '—'
                : `${o.typical_response_days} days`}
            </div>
          </div>
        </div>

        ${o.notes ? html`<p class="text-xs text-ink-fade italic leading-relaxed">${o.notes}</p>` : ''}
      </div>
    </section>
  `
}

const conversation = (p: Props) => {
  const t = p.detail.thread
  const events = [
    ...t.outreach.map((o) => ({ kind: 'out' as const, at: o.sent_at_demo_clock, o })),
    ...t.replies.map((r) => ({ kind: 'in' as const, at: r.received_at_demo_clock, r })),
  ].sort((a, b) => a.at.localeCompare(b.at))

  return html`
    <div class="space-y-3">
      <div class="flex items-center justify-between mb-1">
        <h2 class="font-bold text-ink tracking-tight">Conversation</h2>
        <span class="text-xs text-ink-muted">
          ${t.outreach.length} sent · ${t.replies.length}
          ${t.replies.length === 1 ? 'reply' : 'replies'}
        </span>
      </div>
      ${events.length === 0
        ? html`
            <div class="rounded-lg border border-dashed border-canvas-deep bg-canvas p-8 text-center">
              <p class="text-ink-fade text-sm">
                Nobody was asked. This one was under the owner's limit and approved
                automatically.
              </p>
            </div>
          `
        : html`
            ${interceptBanner(
              html`Nothing below was actually sent. This is sample data, and the agent runs the same way in production.`,
            )}
            ${events.map((e) =>
              e.kind === 'out'
                ? sentCard(e.o, p.demoClockIso)
                : replyCard(e.r, p.demoClockIso),
            )}
          `}
    </div>
  `
}

const sentCard = (o: import('../db/threads.js').OutreachRow, nowIso: string) => html`
  <article class="rounded-lg border border-canvas-deep bg-white">
    <header class="px-4 py-2.5 border-b border-canvas-deep flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-2 min-w-0">
        <span class="text-xs font-bold uppercase tracking-wider text-ink">
          ${o.channel === 'sms' ? 'Text' : o.channel === 'voice' ? 'Call' : 'Email'}
        </span>
        <span class="text-xs text-ink-muted">to <span class="font-mono">${o.recipient}</span></span>
      </div>
      <span class="text-xs text-ink-muted">${formatRelative(o.sent_at_demo_clock, nowIso)}</span>
    </header>
    <div class="px-4 py-3">
      ${o.subject ? html`<div class="text-sm font-bold text-ink mb-1">${o.subject}</div>` : ''}
      <pre class="text-sm text-ink leading-relaxed whitespace-pre-wrap font-sans">${o.body_text}</pre>
    </div>
  </article>
`

const CLASS_BG: Record<string, string> = {
  approved: 'bg-emerald-50 border-emerald-200',
  declined: 'bg-red-50 border-red-200',
  question: 'bg-amber-50 border-amber-200',
  'counter-offer': 'bg-amber-50 border-amber-200',
  irrelevant: 'bg-slate-50 border-slate-200',
}

const replyCard = (r: import('../db/threads.js').ReplyRow, nowIso: string) => html`
  <article class="rounded-lg border ${CLASS_BG[r.classification ?? 'irrelevant'] ?? 'bg-canvas'} ml-8">
    <header class="px-4 py-2.5 border-b border-canvas-deep/60 flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-2 min-w-0">
        <span class="text-xs font-bold uppercase tracking-wider text-ink">
          ${r.channel === 'sms' ? 'Text reply' : 'Reply'}
        </span>
        <span class="text-xs text-ink-muted truncate">
          from <span class="font-mono">${r.from_address}</span>
        </span>
      </div>
      <span class="text-xs text-ink-muted">${formatRelative(r.received_at_demo_clock, nowIso)}</span>
    </header>
    <div class="px-4 py-3">
      <pre class="text-sm text-ink leading-relaxed whitespace-pre-wrap font-sans">${r.raw_text}</pre>
      ${r.classification
        ? html`
            <div class="mt-3 pt-3 border-t border-canvas-deep/60 text-[11px] text-ink-fade flex items-center gap-3 flex-wrap">
              <span>
                Agent read this as
                <span class="font-bold text-ink uppercase tracking-wider">${r.classification}</span>
              </span>
              ${r.parsed_amount_usd
                ? html`<span>
                    Amount named:
                    <span class="font-mono text-ink">${money(r.parsed_amount_usd)}</span>
                  </span>`
                : ''}
            </div>
          `
        : ''}
    </div>
  </article>
`

const timeline = (p: Props) => {
  const t = p.detail.thread
  const items = [
    ...t.logs.map((l) => ({ id: l.id, ts: l.ts_demo_clock, level: l.level, line: l.line })),
    ...t.transitions.map((tr) => ({
      id: 1_000_000 + tr.id,
      ts: tr.at_demo_clock,
      level: 'success' as const,
      line: `→ ${APPROVAL_META[tr.to_state as keyof typeof APPROVAL_META]?.longLabel ?? tr.to_state}${
        tr.reason ? ` · ${tr.reason}` : ''
      }`,
    })),
  ].sort((a, b) => a.ts.localeCompare(b.ts))

  return html`
    <section class="rounded-lg border border-canvas-deep bg-white">
      <header class="px-4 py-3 border-b border-canvas-deep flex items-center justify-between">
        <span class="font-bold text-ink text-sm">Activity</span>
        <span class="text-xs text-ink-muted">${items.length} events</span>
      </header>
      <div class="max-h-[420px] overflow-y-auto">
        <ul class="divide-y divide-canvas-deep/60">
          ${items.map(
            (it) => html`
              <li class="px-4 py-2.5 flex items-start gap-3 text-sm">
                <span
                  class="flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full ${it.level === 'error'
                    ? 'bg-red-500'
                    : it.level === 'warn'
                      ? 'bg-amber-500'
                      : it.level === 'success'
                        ? 'bg-emerald-500'
                        : 'bg-brand-sky'}"
                ></span>
                <div class="min-w-0 flex-1">
                  <p class="text-ink leading-snug">${it.line}</p>
                  <p class="text-[11px] text-ink-muted mt-0.5 font-mono">${shortDateTime(it.ts)}</p>
                </div>
              </li>
            `,
          )}
        </ul>
      </div>
      <footer class="px-4 py-2 border-t border-canvas-deep text-[11px] text-ink-muted">
        Every ask, reminder and decision is logged. If an owner later says they were
        never told, this is the answer.
      </footer>
    </section>
  `
}

const shortDateTime = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  })
