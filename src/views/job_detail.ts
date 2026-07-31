import { html } from 'hono/html'
import { STATE_META, type AgentState } from '../agent/state_machine.js'
import type { JobDetail } from '../db/queries_inbox.js'
import { layout } from './layout.js'
import {
  formatDate,
  formatDueDate,
  formatRelative,
  interceptBanner,
  interceptTag,
  samplePill,
  stateBadge,
  v2Chip,
} from './_components.js'

interface DetailProps {
  detail: JobDetail
  demoClockIso: string
  smsOutboundEnabled: boolean
  ingestAdapter: string
  tourStep?: number
}

const ADAPTER_LABEL: Record<string, string> = {
  adapter1: 'Direct connection',
  adapter2a: 'Automatic weekly report',
  adapter2b_full: 'Manual weekly export',
  adapter2b_degraded: 'Manual weekly export — no contact columns',
}

export const jobDetailPage = (p: DetailProps) =>
  layout({
    title: `${p.detail.customer.name} · Kestrel Maintenance Scheduling Agent`,
    tourStep: p.tourStep,
    currentPath: `/inbox/${p.detail.rse.id}`,
    body: html`
      <div class="max-w-7xl mx-auto px-6 py-6">
        ${detailHeader(p)}
        <div class="mt-6 grid lg:grid-cols-12 gap-6">
          <div class="lg:col-span-7">${conversationThread(p)}</div>
          <div class="lg:col-span-5 space-y-5">
            ${appfolioCard(p.detail)}
            ${activityTimeline(p.detail, p.ingestAdapter)}
          </div>
        </div>
      </div>
    `,
  })

const detailHeader = (p: DetailProps) => {
  const meta = STATE_META[p.detail.rse.state]
  const j = p.detail
  return html`
    <div>
      <a
        href="/inbox"
        class="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink mb-3 transition-colors"
      >
        <svg
          class="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="2"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to inbox
      </a>
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-3 flex-wrap mb-2">
            ${stateBadge(j.rse.state)}
            <span class="text-xs font-mono text-ink-muted">${j.rse.id}</span>
            <span class="text-xs text-ink-muted">·</span>
            <span class="text-xs text-ink-muted">${formatDueDate(j.rse.due_date, p.demoClockIso)}</span>
          </div>
          <h1 class="font-black text-ink text-3xl tracking-tight leading-tight">
            ${j.customer.name}
          </h1>
          <p class="text-ink-fade mt-1">
            ${j.recurring_service.name} · ${j.equipment.length} asset${j.equipment.length === 1 ? '' : 's'} ·
            ${j.location.address_city}, ${j.location.address_state}
          </p>
          <p class="text-xs text-ink-muted mt-2">${meta.description}</p>
        </div>
        ${cta(j.rse.state, j.rse.id)}
      </div>
    </div>
  `
}

const cta = (state: AgentState, rseId: string) => {
  switch (state) {
    case 'AwaitingHuman_DateProposed':
      return html`
        <div class="flex flex-col items-end gap-1.5">
          <div class="flex items-center gap-2 flex-wrap" data-tour-highlight="cta-book">
            <form method="POST" action="/inbox/${rseId}/_book">
              <button type="submit" class="btn-block">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2.25" stroke="currentColor" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                Confirm to mark booked
              </button>
            </form>
            <form method="POST" action="/inbox/${rseId}/_optout">
              <button type="submit" class="btn-ghost text-sm">Mark opted-out</button>
            </form>
          </div>
          ${v2Chip('auto-book', 'Auto-book in AppFolio')}
        </div>
      `
    case 'AwaitingHuman_AmbiguousReply':
      return html`
        <div class="flex items-center gap-2 flex-wrap">
          <form method="POST" action="/inbox/${rseId}/_book">
            <button type="submit" class="btn-block">Mark booked</button>
          </form>
          <form method="POST" action="/inbox/${rseId}/_optout">
            <button type="submit" class="btn-ghost text-sm">Opt out</button>
          </form>
        </div>
      `
    case 'AwaitingHuman_Question':
      return html`
        <div class="flex flex-col items-end gap-1.5">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="btn-block">Reply manually</span>
            <form method="POST" action="/inbox/${rseId}/_book">
              <button type="submit" class="btn-ghost text-sm">Mark booked</button>
            </form>
          </div>
          ${v2Chip('faq-thread', 'FAQ in-thread answering')}
        </div>
      `
    case 'Escalated':
      return html`
        <div class="flex items-center gap-2 flex-wrap">
          <span class="btn-primary">Call manually</span>
          <form method="POST" action="/inbox/${rseId}/_optout">
            <button type="submit" class="btn-ghost text-sm">Mark opted-out</button>
          </form>
        </div>
      `
    case 'InProgress_EmailT10_Sent':
    case 'InProgress_EmailT5_Sent':
    case 'InProgress_SmsT5_Sent':
    case 'InProgress_VoiceT0_Attempted':
      return html`
        <button
          type="button"
          class="btn-ghost text-sm"
          hx-post="/inbox/${rseId}/_simulate-reply"
          hx-target="#thread"
          hx-swap="outerHTML"
          hx-indicator="#sim-indicator"
          title="Drops in a sample reply so you can watch the agent read it, sort it, and pull the date out."
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.667 0l3.181-3.183m-4.991-2.691v4.992m0 0h4.992m-4.992 0l-3.181-3.183M2.985 9.348a8.25 8.25 0 0114.064-3.183l3.181 3.183" />
          </svg>
          Simulate inbound reply
        </button>
      `
    default:
      return html``
  }
}

const conversationThread = (p: DetailProps) =>
  conversationFragment(p.detail, p.smsOutboundEnabled, p.demoClockIso)

/** Stand-alone thread fragment, returnable from htmx swap endpoints. */
export const conversationFragment = (
  detail: JobDetail,
  smsOutboundEnabled: boolean,
  demoClockIso: string,
) => {
  const events = mergeEvents(detail)
  const showSmsPreview = shouldShowSmsPreview(detail, smsOutboundEnabled)
  return html`
    <div id="thread" class="space-y-3" data-tour-highlight="conversation-thread">
      <div class="flex items-center justify-between mb-1">
        <h2 class="font-bold text-ink tracking-tight">Conversation</h2>
        <span class="text-xs text-ink-muted">
          ${detail.outreach.length} outreach · ${detail.replies.length} repl${detail.replies.length === 1 ? 'y' : 'ies'}
        </span>
      </div>
      ${events.length === 0
        ? emptyConversation(detail)
        : html`
            ${interceptBanner(
              html`Nothing below was actually sent. This is sample data, and the agent runs the same way in production.`,
            )}
            ${events.map((e) =>
              e.kind === 'outreach'
                ? outreachCard(e, smsOutboundEnabled, demoClockIso)
                : replyCard(e, demoClockIso),
            )}
          `}
      ${showSmsPreview ? smsPreviewCard(detail) : ''}
      <div id="sim-indicator" class="htmx-indicator text-sm text-ink-muted py-2">
        <span class="inline-flex items-center gap-2">
          <span
            class="w-3 h-3 rounded-full bg-brand-sky animate-pulse"
            style="animation-duration: 0.8s"
          ></span>
          Running classification…
        </span>
      </div>
    </div>
  `
}

/**
 * SMS preview is shown on every In-Progress and Awaiting-Human job when
 * outbound SMS is dark. It renders the body the agent WOULD send at T-5
 * (or has already drafted) so stakeholders see what's gated by 10DLC, not
 * just a "channel dark" badge with no copy attached.
 */
function shouldShowSmsPreview(detail: JobDetail, smsOutboundEnabled: boolean): boolean {
  if (smsOutboundEnabled) return false
  const state = detail.rse.state
  if (
    !state.startsWith('InProgress_') &&
    !state.startsWith('AwaitingHuman_')
  ) {
    return false
  }
  // Find a contact with a mobile/voip number; if none, no SMS would ever fire.
  const smsContact = detail.contacts.find(
    (c) => c.phone && (c.line_type === 'mobile' || c.line_type === 'voip') && !c.do_not_text,
  )
  return Boolean(smsContact)
}

const smsPreviewCard = (detail: JobDetail) => {
  const smsContact =
    detail.contacts.find(
      (c) => c.phone && (c.line_type === 'mobile' || c.line_type === 'voip') && !c.do_not_text,
    ) ?? detail.contacts[0]
  const recipient = smsContact?.phone ?? '(919) 555-0100'
  const dueDay = new Date(detail.rse.due_date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
  const body = `Kestrel Property Management: ${detail.recurring_service.name.toLowerCase()} at ${detail.location.name ?? detail.customer.name} is due ${dueDay}. Reply with a day that works and we'll confirm a time. Reply STOP to opt out.`
  return html`
    <article class="rounded-lg border border-dashed border-canvas-deep bg-canvas opacity-90">
      <header class="px-4 py-2.5 border-b border-canvas-deep flex items-center justify-between gap-3 flex-wrap">
        <div class="flex items-center gap-2 min-w-0">
          <span class="inline-flex items-center justify-center w-6 h-6 rounded bg-brand-sky-soft text-brand-navy">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.068.157 2.148.279 3.238.364.466.037.893.281 1.153.671L12 21l2.652-3.978c.26-.39.687-.634 1.153-.67 1.09-.086 2.17-.208 3.238-.365 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
          </span>
          <span class="text-xs font-bold uppercase tracking-wider text-ink">SMS · scheduled</span>
          <span class="text-xs text-ink-muted">would send to <span class="font-mono">${recipient}</span></span>
        </div>
        <span class="demo-tag-action">Not sending yet</span>
      </header>
      <div class="px-4 py-3">
        <pre class="text-sm text-ink leading-relaxed whitespace-pre-wrap font-sans">${body}</pre>
        <p class="mt-2.5 text-[11px] text-ink-muted leading-relaxed">
          Outbound texting switches on once carrier registration for business
          messaging clears. No rebuild needed.
        </p>
      </div>
    </article>
  `
}

type ThreadEvent =
  | (JobDetail['outreach'][number] & { kind: 'outreach' })
  | (JobDetail['replies'][number] & { kind: 'reply' })

const mergeEvents = (d: JobDetail): ThreadEvent[] => {
  const events: ThreadEvent[] = [
    ...d.outreach.map((o) => ({ ...o, kind: 'outreach' as const })),
    ...d.replies.map((r) => ({ ...r, kind: 'reply' as const })),
  ]
  events.sort((a, b) => {
    const at = a.kind === 'outreach' ? a.sent_at_demo_clock : a.received_at_demo_clock
    const bt = b.kind === 'outreach' ? b.sent_at_demo_clock : b.received_at_demo_clock
    return at.localeCompare(bt)
  })
  return events
}

const emptyConversation = (d: JobDetail) => html`
  <div class="rounded-lg border border-dashed border-canvas-deep bg-canvas p-8 text-center">
    <p class="text-ink-fade text-sm">
      No outreach yet. Sequence starts at T-10 days
      (${formatDate(daysBefore(d.rse.due_date, 10))}).
    </p>
  </div>
`

const daysBefore = (dueDateIso: string, days: number) => {
  const d = new Date(dueDateIso)
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

const outreachCard = (
  o: JobDetail['outreach'][number] & { kind: 'outreach' },
  smsOutboundEnabled: boolean,
  demoClockIso: string,
) => {
  if (o.channel === 'email') return outreachEmailCard(o, demoClockIso)
  if (o.channel === 'sms') return outreachSmsCard(o, smsOutboundEnabled, demoClockIso)
  return outreachVoiceCard(o, demoClockIso)
}

const outreachEmailCard = (o: JobDetail['outreach'][number], demoClockIso: string) => html`
  <article class="rounded-lg border border-canvas-deep bg-white">
    <header class="px-4 py-2.5 border-b border-canvas-deep flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-2 min-w-0">
        <span class="inline-flex items-center justify-center w-6 h-6 rounded bg-brand-sky-soft text-brand-navy">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
          </svg>
        </span>
        <span class="text-xs font-bold uppercase tracking-wider text-ink">Email</span>
        <span class="text-xs text-ink-muted">to <span class="font-mono">${o.recipient}</span></span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs text-ink-muted">${formatRelative(o.sent_at_demo_clock, demoClockIso)}</span>
      </div>
    </header>
    <div class="px-4 py-3">
      ${o.subject ? html`<div class="text-sm font-bold text-ink mb-1">${o.subject}</div>` : ''}
      <pre class="text-sm text-ink leading-relaxed whitespace-pre-wrap font-sans">${o.body_text}</pre>
    </div>
  </article>
`

const outreachSmsCard = (
  o: JobDetail['outreach'][number],
  smsOutboundEnabled: boolean,
  demoClockIso: string,
) => html`
  <article class="rounded-lg border border-canvas-deep ${smsOutboundEnabled ? 'bg-white' : 'bg-canvas opacity-90'}">
    <header class="px-4 py-2.5 border-b border-canvas-deep flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-2">
        <span class="inline-flex items-center justify-center w-6 h-6 rounded bg-brand-sky-soft text-brand-navy">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 12.76c0 1.6 1.123 2.994 2.707 3.227 1.068.157 2.148.279 3.238.364.466.037.893.281 1.153.671L12 21l2.652-3.978c.26-.39.687-.634 1.153-.67 1.09-.086 2.17-.208 3.238-.365 1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
          </svg>
        </span>
        <span class="text-xs font-bold uppercase tracking-wider text-ink">SMS</span>
        <span class="text-xs text-ink-muted">to <span class="font-mono">${o.recipient}</span></span>
      </div>
      <div class="flex items-center gap-2">
        ${smsOutboundEnabled
          ? ''
          : html`<span class="demo-tag-action">Not sent — texting not switched on yet</span>`}
        <span class="text-xs text-ink-muted">${formatRelative(o.sent_at_demo_clock, demoClockIso)}</span>
      </div>
    </header>
    <div class="px-4 py-3">
      <pre class="text-sm text-ink leading-relaxed whitespace-pre-wrap font-sans">${o.body_text}</pre>
      <div class="mt-3 pt-2 border-t border-canvas-deep/60 flex justify-end">
        ${v2Chip('imessage', 'iMessage outbound')}
      </div>
    </div>
  </article>
`

const outreachVoiceCard = (o: JobDetail['outreach'][number], demoClockIso: string) => html`
  <article class="rounded-lg border border-canvas-deep bg-white">
    <header class="px-4 py-2.5 border-b border-canvas-deep flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-2">
        <span class="inline-flex items-center justify-center w-6 h-6 rounded bg-brand-sky-soft text-brand-navy">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
          </svg>
        </span>
        <span class="text-xs font-bold uppercase tracking-wider text-ink">Voice IVR</span>
        <span class="text-xs text-ink-muted">to <span class="font-mono">${o.recipient}</span></span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs text-ink-muted">${formatRelative(o.sent_at_demo_clock, demoClockIso)}</span>
      </div>
    </header>
    <div class="px-4 py-3">
      <pre class="text-sm text-ink leading-relaxed whitespace-pre-wrap font-sans">${o.body_text}</pre>
      <div class="mt-3 pt-2 border-t border-canvas-deep/60 flex justify-end">
        ${v2Chip('conv-voice', 'Conversational AI voice')}
      </div>
    </div>
  </article>
`

const replyCard = (r: JobDetail['replies'][number] & { kind: 'reply' }, demoClockIso: string) => {
  const classBg: Record<string, string> = {
    'proposed-date': 'bg-emerald-50 border-emerald-200',
    question: 'bg-amber-50 border-amber-200',
    'opt-out': 'bg-red-50 border-red-200',
    irrelevant: 'bg-slate-50 border-slate-200',
  }
  const bg = classBg[r.classification ?? 'irrelevant'] ?? 'bg-canvas'
  return html`
    <article class="rounded-lg border ${bg} ml-8">
      <header class="px-4 py-2.5 border-b border-canvas-deep/60 flex items-center justify-between gap-3 flex-wrap">
        <div class="flex items-center gap-2 min-w-0">
          <span class="inline-flex items-center justify-center w-6 h-6 rounded bg-brand-navy text-white">
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" />
            </svg>
          </span>
          <span class="text-xs font-bold uppercase tracking-wider text-ink">
            ${r.channel === 'voice-keypress' ? 'Voice keypress' : `${r.channel.toUpperCase()} reply`}
          </span>
          <span class="text-xs text-ink-muted truncate">from <span class="font-mono">${r.from_address}</span></span>
        </div>
        <span class="text-xs text-ink-muted">${formatRelative(r.received_at_demo_clock, demoClockIso)}</span>
      </header>
      <div class="px-4 py-3">
        <pre class="text-sm text-ink leading-relaxed whitespace-pre-wrap font-sans">${r.raw_text}</pre>
        ${r.classification
          ? html`
              <div data-tour-highlight="reply-extraction" class="mt-3 pt-3 border-t border-canvas-deep/60 text-[11px] text-ink-fade flex items-center gap-3 flex-wrap">
                <span>
                  Agent:
                  <span class="font-bold text-ink uppercase tracking-wider">${r.classification}</span>
                </span>
                ${r.parsed_date
                  ? html`<span>Extracted: <span class="font-mono text-ink">${r.parsed_date}</span></span>`
                  : ''}
              </div>
            `
          : ''}
      </div>
    </article>
  `
}

const appfolioCard = (d: JobDetail) => html`
  <section class="rounded-lg border border-canvas-deep bg-white">
    <header class="px-4 py-3 border-b border-canvas-deep flex items-center justify-between gap-3 flex-wrap">
      <div class="flex items-center gap-2">
        <span class="font-bold text-ink text-sm">AppFolio record</span>
        ${samplePill('AppFolio')}
      </div>
      <a
        href="/admin?wizard=appfolio"
        class="text-xs text-brand-navy hover:underline font-medium"
      >
        Connect real AppFolio →
      </a>
    </header>
    <div class="p-4 space-y-4 text-sm">
      <div>
        <div class="text-[11px] uppercase tracking-wider text-ink-muted mb-1.5 font-bold">
          Tags
        </div>
        <div class="flex flex-wrap gap-1.5">
          <span class="inline-flex items-center rounded bg-brand-navy text-white px-2 py-0.5 text-[11px] font-bold">
            ${d.recurring_service.cadence === 'annual' ? 'AnnualService' : ''}
            ${d.recurring_service.cadence === 'biannual' ? 'SemiAnnualService' : ''}
            ${d.recurring_service.cadence === 'quarterly' ? 'QuarterlyService' : ''}
            ${d.recurring_service.cadence === 'monthly' ? 'MonthlyService' : ''}
          </span>
          ${d.location.business_unit
            ? html`<span class="inline-flex items-center rounded bg-canvas-deep text-ink-fade px-2 py-0.5 text-[11px]">
                ${d.location.business_unit}
              </span>`
            : ''}
          ${d.location.service_zone
            ? html`<span class="inline-flex items-center rounded bg-canvas-deep text-ink-fade px-2 py-0.5 text-[11px]">
                Zone ${d.location.service_zone}
              </span>`
            : ''}
        </div>
      </div>

      <div>
        <div class="text-[11px] uppercase tracking-wider text-ink-muted mb-1.5 font-bold">
          Equipment (${d.equipment.length})
        </div>
        <ul class="space-y-1.5">
          ${d.equipment.map(
            (e) => html`
              <li class="flex items-baseline gap-2">
                <span class="font-mono text-xs text-ink">${e.item_name}</span>
                ${e.item_description
                  ? html`<span class="text-ink-fade text-xs">— ${e.item_description}</span>`
                  : ''}
              </li>
            `,
          )}
        </ul>
      </div>

      <div>
        <div class="text-[11px] uppercase tracking-wider text-ink-muted mb-1.5 font-bold flex items-center justify-between">
          <span>Contacts (${d.contacts.length})</span>
          ${d.contacts.length > 1
            ? html`<span class="text-ink-muted normal-case font-normal tracking-normal">
                in priority order
              </span>`
            : ''}
        </div>
        <ul class="space-y-2">
          ${d.contacts.map((c, i) => contactRow(c, i))}
        </ul>
      </div>

      <div>
        <div class="text-[11px] uppercase tracking-wider text-ink-muted mb-1.5 font-bold">
          Service Notes
        </div>
        <p class="text-sm text-ink leading-relaxed">
          ${d.recurring_service.job_summary ?? html`<span class="text-ink-muted italic">(none)</span>`}
        </p>
      </div>

      <div class="pt-3 border-t border-canvas-deep grid grid-cols-2 gap-3 text-[11px] text-ink-fade">
        <div>
          <div class="uppercase tracking-wider text-ink-muted font-bold mb-0.5">Status</div>
          <div class="text-ink">${d.rse.appfolio_status}</div>
        </div>
        <div>
          <div class="uppercase tracking-wider text-ink-muted font-bold mb-0.5">Scheduling</div>
          <div class="text-ink">${d.rse.booking_availability}</div>
        </div>
        <div>
          <div class="uppercase tracking-wider text-ink-muted font-bold mb-0.5">Ingested via</div>
          <div class="text-ink">${ADAPTER_LABEL[d.rse.ingested_via_adapter] ?? d.rse.ingested_via_adapter}</div>
        </div>
        <div>
          <div class="uppercase tracking-wider text-ink-muted font-bold mb-0.5">Agreement</div>
          <div class="text-ink">${d.recurring_service.membership_status}</div>
        </div>
      </div>
    </div>
  </section>
`

const contactRow = (c: JobDetail['contacts'][number], _i: number) => {
  const isDeprioritized = c.role_rank >= 60
  return html`
    <li class="${isDeprioritized ? 'opacity-60' : ''}">
      <div class="flex items-baseline gap-2 flex-wrap">
        <span class="font-bold text-ink text-sm">${c.name}</span>
        ${c.role ? html`<span class="text-xs text-ink-fade">${c.role}</span>` : ''}
        ${c.is_primary
          ? html`<span class="inline-flex rounded bg-brand-sky-soft text-brand-navy px-1.5 py-0 text-[10px] font-bold uppercase tracking-wider">
              primary
            </span>`
          : ''}
        ${isDeprioritized
          ? html`<span class="inline-flex rounded bg-canvas-deep text-ink-muted px-1.5 py-0 text-[10px] uppercase tracking-wider">
              deprioritized
            </span>`
          : ''}
      </div>
      <div class="text-xs text-ink-muted flex items-center gap-2 flex-wrap mt-0.5">
        ${c.phone
          ? html`<span class="font-mono">${c.phone}</span>
              ${c.line_type
                ? html`<span class="inline-flex rounded bg-canvas-deep text-ink-fade px-1 py-0 text-[10px] uppercase tracking-wider">
                    ${c.line_type}
                  </span>`
                : ''}`
          : ''}
        ${c.email ? html`<span class="font-mono truncate">${c.email}</span>` : ''}
      </div>
    </li>
  `
}

const activityTimeline = (d: JobDetail, ingestAdapter: string) => {
  const items = mergeAuditEvents(d, ingestAdapter)
  const writebackActive = ingestAdapter === 'adapter1'
  return html`
    <section
      class="rounded-lg border border-canvas-deep bg-white"
      data-rse-id="${d.rse.id}"
    >
      <header class="px-4 py-3 border-b border-canvas-deep flex items-center justify-between flex-wrap gap-2">
        <div class="flex items-center gap-2">
          <span class="font-bold text-ink text-sm">Activity Timeline</span>
        </div>
        <div class="flex items-center gap-2 text-xs text-ink-muted">
          ${writebackActive
            ? html`<span class="inline-flex items-center gap-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                Writing back to AppFolio
              </span>`
            : ''}
          <span>${items.length} event${items.length === 1 ? '' : 's'}</span>
        </div>
      </header>
      <div
        id="timeline-stream"
        class="max-h-[480px] overflow-y-auto"
        hx-get="/inbox/${d.rse.id}/timeline/since?sinceId=${items[items.length - 1]?.id ?? 0}"
        hx-trigger="every 4s"
        hx-swap="beforeend"
      >
        <ul class="divide-y divide-canvas-deep/60">
          ${items.map((it) => timelineRow(it))}
        </ul>
      </div>
      <footer class="px-4 py-2 border-t border-canvas-deep text-[11px] text-ink-muted">
        ${writebackActive
          ? html`Every send, reply and status change is logged here. With the direct
              connection on, these entries are also written back to the property record
              in AppFolio.`
          : html`Every send, reply and status change is logged here. Turn on the direct
              connection in admin to also write these back into AppFolio.`}
      </footer>
    </section>
  `
}

interface TimelineItem {
  kind: 'log' | 'transition' | 'writeback'
  id: number
  ts: string
  level: 'info' | 'warn' | 'error' | 'success'
  line: string
}

const mergeAuditEvents = (d: JobDetail, ingestAdapter: string): TimelineItem[] => {
  const out: TimelineItem[] = []
  for (const l of d.logs)
    out.push({ kind: 'log', id: l.id, ts: l.ts_demo_clock, level: l.level, line: l.line })
  for (const t of d.transitions) {
    out.push({
      kind: 'transition',
      id: 1_000_000 + t.id,
      ts: t.at_demo_clock,
      level: 'success',
      line: `→ ${STATE_META[t.to_state].longLabel}${t.reason ? ` · ${t.reason}` : ''}`,
    })
    // Adapter 1 writes a paired note to AppFolio via the API. Render as
    // synthetic timeline lines on each transition so stakeholders see what
    // would land in AppFolio when API access is granted.
    if (ingestAdapter === 'adapter1') {
      const noteBody = formatWritebackNote(t.to_state, t.reason ?? '')
      if (noteBody) {
        out.push({
          kind: 'writeback',
          id: 2_000_000 + t.id,
          ts: t.at_demo_clock,
          level: 'info',
          line: `Note added to the AppFolio property record: "${noteBody}"`,
        })
      }
    }
  }
  out.sort((a, b) => a.ts.localeCompare(b.ts))
  return out
}

function formatWritebackNote(toState: AgentState, reason: string): string {
  if (toState === 'InProgress_EmailT10_Sent') return 'Sequence started. Email T-10 sent.'
  if (toState === 'InProgress_EmailT5_Sent') return 'T-5 follow-up email sent.'
  if (toState === 'InProgress_SmsT5_Sent') return 'T-5 follow-up SMS sent.'
  if (toState === 'InProgress_VoiceT0_Attempted') return 'T-0 voice IVR attempted.'
  if (toState.startsWith('AwaitingHuman_'))
    return `Contact replied. ${reason || 'Routed to Coordinator.'}`
  if (toState === 'Escalated')
    return 'Escalated to Coordinator. All channels exhausted, no reply.'
  if (toState === 'Closed_Booked') return 'Closed: booked.'
  if (toState === 'Closed_OptedOut') return 'Closed: opted out.'
  if (toState === 'Closed_BookedOutsideAgent')
    return 'Closed: booked outside agent (pre-send check).'
  if (toState === 'Skipped_PreSendCheckCancelled')
    return 'Skipped outreach — pre-send check found job already completed.'
  return ''
}

export const timelineRow = (it: TimelineItem) => {
  const dotColor =
    it.kind === 'writeback'
      ? 'bg-emerald-400'
      : it.level === 'error'
        ? 'bg-red-500'
        : it.level === 'warn'
          ? 'bg-amber-500'
          : it.level === 'success'
            ? 'bg-emerald-500'
            : 'bg-brand-sky'
  const isWriteback = it.kind === 'writeback'
  return html`
    <li class="px-4 py-2.5 flex items-start gap-3 text-sm ${isWriteback ? 'bg-emerald-50/40' : ''}">
      <span class="flex-shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full ${dotColor}"></span>
      <div class="min-w-0 flex-1">
        <p class="text-ink leading-snug ${isWriteback ? 'font-mono text-[12px]' : ''}">${it.line}</p>
        <p class="text-[11px] text-ink-muted mt-0.5 font-mono">${formatTs(it.ts)}</p>
      </div>
    </li>
  `
}

const formatTs = (iso: string) =>
  new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  })
