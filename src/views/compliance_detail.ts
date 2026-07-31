import { html } from 'hono/html'
import { COMPLIANCE_META, DOC_TYPE_LABELS, daysUntil } from '../agent/compliance_state.js'
import type { ComplianceDetail } from '../db/compliance.js'
import { layout } from './layout.js'
import { formatRelative, interceptBanner } from './_components.js'

interface Props {
  detail: ComplianceDetail
  demoClockIso: string
}

const money = (n: number) => `$${n.toLocaleString('en-US')}`

export const complianceDetailPage = (p: Props) => {
  const d = p.detail.doc
  const meta = COMPLIANCE_META[d.state]
  const days = daysUntil(d.expires_on, p.demoClockIso)
  return layout({
    title: `${d.vendor_name} · Kestrel Maintenance Scheduling Agent`,
    currentPath: `/compliance/${d.id}`,
    body: html`
      <div class="max-w-7xl mx-auto px-6 py-6">
        <a
          href="/compliance"
          class="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink mb-3 transition-colors"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to compliance
        </a>

        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap mb-2">
              ${meta.blocksDispatch
                ? html`<span class="inline-flex items-center rounded-full border border-red-300 bg-red-100 text-red-800 font-bold uppercase tracking-wider text-[11px] px-2 py-0.5">
                    Do not dispatch
                  </span>`
                : html`<span class="text-[11px] text-ink-muted uppercase tracking-wider font-bold">
                    ${meta.longLabel}
                  </span>`}
              <span class="text-xs font-mono text-ink-muted">${d.id}</span>
            </div>
            <h1 class="font-black text-ink text-3xl tracking-tight leading-tight">${d.vendor_name}</h1>
            <p class="text-ink-fade mt-1">
              ${d.trade} · ${DOC_TYPE_LABELS[d.doc_type] ?? d.doc_type}
              ${d.contact_name ? html` · ${d.contact_name}` : ''}
            </p>
            <p class="text-xs text-ink-muted mt-2">${meta.description}</p>
          </div>
          <div class="text-right">
            <div class="font-black ${days < 0 ? 'text-red-700' : 'text-ink'} text-3xl tracking-tight leading-none">
              ${days < 0 ? `${Math.abs(days)}d` : `${days}d`}
            </div>
            <div class="text-[11px] text-ink-muted mt-1">
              ${days < 0 ? 'since it expired' : 'until it expires'}
            </div>
          </div>
        </div>

        <div class="mt-6 grid lg:grid-cols-12 gap-6">
          <div class="lg:col-span-7 space-y-4">
            ${openJobs(p)}
            ${conversation(p)}
          </div>
          <div class="lg:col-span-5 space-y-5">
            ${policyCard(p)}
            ${timeline(p)}
          </div>
        </div>
      </div>
    `,
  })
}

const openJobs = (p: Props) => {
  const { doc, openJobs: jobs } = p.detail
  if (jobs.length === 0) return ''
  const blocked = COMPLIANCE_META[doc.state].blocksDispatch
  return html`
    <section
      class="rounded-lg border ${blocked ? 'border-red-300 bg-red-50' : 'border-canvas-deep bg-white'}"
    >
      <header class="px-4 py-3 border-b ${blocked ? 'border-red-200' : 'border-canvas-deep'}">
        <span class="font-bold ${blocked ? 'text-red-900' : 'text-ink'} text-sm">
          ${blocked
            ? `Blocked: ${jobs.length} live ${jobs.length === 1 ? 'job' : 'jobs'} quoted to this vendor`
            : `Live work with this vendor (${jobs.length})`}
        </span>
      </header>
      <ul class="divide-y ${blocked ? 'divide-red-200' : 'divide-canvas-deep'}">
        ${jobs.map(
          (j) => html`
            <li class="px-4 py-2.5 flex items-center justify-between gap-3">
              <a href="/approvals/${j.id}" class="min-w-0 flex-1 group">
                <div class="text-sm font-medium ${blocked ? 'text-red-900' : 'text-ink'} group-hover:underline truncate">
                  ${j.summary}
                </div>
                <div class="text-[11px] ${blocked ? 'text-red-800/80' : 'text-ink-muted'} font-mono">${j.id}</div>
              </a>
              <span class="text-sm font-bold ${blocked ? 'text-red-900' : 'text-ink'}">
                ${money(j.quote_usd)}
              </span>
            </li>
          `,
        )}
      </ul>
      ${blocked
        ? html`<footer class="px-4 py-2 border-t border-red-200 text-[11px] text-red-800">
            These stay blocked until a valid certificate is on file. The agent will not
            take a promise as proof.
          </footer>`
        : ''}
    </section>
  `
}

const policyCard = (p: Props) => {
  const d = p.detail.doc
  return html`
    <section class="rounded-lg border border-canvas-deep bg-white">
      <header class="px-4 py-3 border-b border-canvas-deep">
        <span class="font-bold text-ink text-sm">The certificate</span>
      </header>
      <div class="p-4 grid grid-cols-2 gap-3 text-[11px] text-ink-fade">
        <div class="col-span-2">
          <div class="uppercase tracking-wider text-ink-muted font-bold mb-0.5">Type</div>
          <div class="text-ink text-sm">${DOC_TYPE_LABELS[d.doc_type] ?? d.doc_type}</div>
        </div>
        <div>
          <div class="uppercase tracking-wider text-ink-muted font-bold mb-0.5">Carrier</div>
          <div class="text-ink">${d.carrier ?? '—'}</div>
        </div>
        <div>
          <div class="uppercase tracking-wider text-ink-muted font-bold mb-0.5">Policy</div>
          <div class="text-ink font-mono">${d.policy_number ?? '—'}</div>
        </div>
        <div>
          <div class="uppercase tracking-wider text-ink-muted font-bold mb-0.5">Cover</div>
          <div class="text-ink">${d.coverage_usd ? money(d.coverage_usd) : '—'}</div>
        </div>
        <div>
          <div class="uppercase tracking-wider text-ink-muted font-bold mb-0.5">Expires</div>
          <div class="text-ink font-mono">${d.expires_on}</div>
        </div>
        <div class="col-span-2">
          <div class="uppercase tracking-wider text-ink-muted font-bold mb-0.5">Contact</div>
          <div class="text-ink">
            ${d.vendor_email ? html`<span class="font-mono">${d.vendor_email}</span>` : ''}
            ${d.vendor_phone ? html` · <span class="font-mono">${d.vendor_phone}</span>` : ''}
          </div>
        </div>
        ${d.notes
          ? html`<div class="col-span-2 pt-2 border-t border-canvas-deep">
              <p class="text-ink-fade italic leading-relaxed">${d.notes}</p>
            </div>`
          : ''}
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
  if (events.length === 0) {
    return html`
      <div class="rounded-lg border border-dashed border-canvas-deep bg-canvas p-8 text-center">
        <p class="text-ink-fade text-sm">
          Nothing sent. This certificate is in date, so the agent is leaving it alone.
        </p>
      </div>
    `
  }
  return html`
    <div class="space-y-3">
      <div class="flex items-center justify-between mb-1">
        <h2 class="font-bold text-ink tracking-tight">Conversation</h2>
        <span class="text-xs text-ink-muted">
          ${t.outreach.length} sent · ${t.replies.length}
          ${t.replies.length === 1 ? 'reply' : 'replies'}
        </span>
      </div>
      ${interceptBanner(
        html`Nothing below was actually sent. This is sample data, and the agent runs the same way in production.`,
      )}
      ${events.map((e) =>
        e.kind === 'out'
          ? html`
              <article class="rounded-lg border border-canvas-deep bg-white">
                <header class="px-4 py-2.5 border-b border-canvas-deep flex items-center justify-between gap-3 flex-wrap">
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="text-xs font-bold uppercase tracking-wider text-ink">
                      ${e.o.channel === 'sms' ? 'Text' : e.o.channel === 'voice' ? 'Call' : 'Email'}
                    </span>
                    <span class="text-xs text-ink-muted">
                      to <span class="font-mono">${e.o.recipient}</span>
                    </span>
                  </div>
                  <span class="text-xs text-ink-muted">
                    ${formatRelative(e.o.sent_at_demo_clock, p.demoClockIso)}
                  </span>
                </header>
                <div class="px-4 py-3">
                  ${e.o.subject
                    ? html`<div class="text-sm font-bold text-ink mb-1">${e.o.subject}</div>`
                    : ''}
                  <pre class="text-sm text-ink leading-relaxed whitespace-pre-wrap font-sans">${e.o.body_text}</pre>
                </div>
              </article>
            `
          : html`
              <article class="rounded-lg border bg-emerald-50 border-emerald-200 ml-8">
                <header class="px-4 py-2.5 border-b border-canvas-deep/60 flex items-center justify-between gap-3 flex-wrap">
                  <div class="flex items-center gap-2 min-w-0">
                    <span class="text-xs font-bold uppercase tracking-wider text-ink">Reply</span>
                    <span class="text-xs text-ink-muted truncate">
                      from <span class="font-mono">${e.r.from_address}</span>
                    </span>
                  </div>
                  <span class="text-xs text-ink-muted">
                    ${formatRelative(e.r.received_at_demo_clock, p.demoClockIso)}
                  </span>
                </header>
                <div class="px-4 py-3">
                  <pre class="text-sm text-ink leading-relaxed whitespace-pre-wrap font-sans">${e.r.raw_text}</pre>
                  ${e.r.classification
                    ? html`<div class="mt-3 pt-3 border-t border-canvas-deep/60 text-[11px] text-ink-fade">
                        Agent read this as
                        <span class="font-bold text-ink uppercase tracking-wider">${e.r.classification}</span>
                      </div>`
                    : ''}
                </div>
              </article>
            `,
      )}
    </div>
  `
}

const timeline = (p: Props) => {
  const t = p.detail.thread
  const items = [
    ...t.logs.map((l) => ({ id: l.id, ts: l.ts_demo_clock, level: l.level, line: l.line })),
    ...t.transitions.map((tr) => ({
      id: 1_000_000 + tr.id,
      ts: tr.at_demo_clock,
      level: 'success' as const,
      line: `→ ${COMPLIANCE_META[tr.to_state as keyof typeof COMPLIANCE_META]?.longLabel ?? tr.to_state}${
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
                  <p class="text-[11px] text-ink-muted mt-0.5 font-mono">
                    ${new Date(it.ts).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                      timeZone: 'UTC',
                    })}
                  </p>
                </div>
              </li>
            `,
          )}
        </ul>
      </div>
    </section>
  `
}
