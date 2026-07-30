import { html } from 'hono/html'
import type { HtmlEscapedString } from 'hono/utils/html'
import { STATE_META, type AgentState } from '../agent/state_machine.js'

const BADGE_CLASSES: Record<string, string> = {
  upcoming: 'bg-state-upcoming/15 text-slate-700 border-slate-300',
  progress: 'bg-brand-sky-soft text-brand-navy border-brand-sky/40',
  awaiting: 'bg-demo-gold-soft text-demo-gold-deep border-demo-gold-line/50',
  escalated: 'bg-red-100 text-red-800 border-red-300',
  closed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
}

export const stateBadge = (state: AgentState, opts: { size?: 'sm' | 'md' } = {}) => {
  const meta = STATE_META[state]
  const cls = BADGE_CLASSES[meta.badgeColor] ?? BADGE_CLASSES.upcoming
  const sz =
    opts.size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-0.5'
  return html`<span
    class="inline-flex items-center gap-1.5 rounded-full border font-bold uppercase tracking-wider ${cls} ${sz}"
  >
    <span class="w-1.5 h-1.5 rounded-full bg-current opacity-70"></span>
    ${meta.shortLabel}
  </span>`
}

/** Demo-intercept tag for any "sent" surface — applies on email/SMS/voice cards. */
export const interceptTag = (description: string) => html`
  <span class="demo-tag-action" title="No real outreach left the agent in this demo.">
    <svg
      class="w-3 h-3"
      fill="none"
      viewBox="0 0 24 24"
      stroke-width="2"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
      />
    </svg>
    Demo intercept · ${description}
  </span>
`

/** Banner-level demo intercept for surfaces with multiple sent rows. */
export const interceptBanner = (
  description: string | HtmlEscapedString | Promise<HtmlEscapedString>,
) => html`
  <div
    class="rounded-md border border-demo-gold-line/40 bg-demo-gold-soft/60 px-4 py-2.5 text-sm text-demo-gold-deep flex items-start gap-2"
  >
    <svg
      class="w-4 h-4 flex-shrink-0 mt-0.5"
      fill="none"
      viewBox="0 0 24 24"
      stroke-width="2"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
      />
    </svg>
    <span><strong>Demo intercept active.</strong> ${description}</span>
  </div>
`

/** Section-level pill for sample-system surfaces (e.g. AppFolio detail card). */
export const samplePill = (system: string) => html`
  <span class="demo-pill-section">
    <svg
      class="w-3 h-3"
      fill="none"
      viewBox="0 0 24 24"
      stroke-width="2"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
      />
    </svg>
    Sample ${system}
  </span>
`

/** v2 chip — clicking opens <dialog id="v2-${id}"> with a real spec, not a tooltip. */
export const v2Chip = (id: string, label: string) => html`
  <button
    type="button"
    data-v2-open="${id}"
    class="inline-flex items-center gap-1 rounded border border-demo-gold-line/40 bg-demo-gold-soft/60 px-2 py-0.5 text-[11px] font-medium text-demo-gold-deep hover:bg-demo-gold-soft transition-colors"
  >
    <svg
      class="w-3 h-3"
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
    ${label}
  </button>
`

export const formatDate = (iso: string): string => {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export const formatRelative = (iso: string, nowIso?: string): string => {
  const t = new Date(iso).getTime()
  const now = nowIso ? new Date(nowIso).getTime() : Date.now()
  const diffMs = now - t
  const day = 1000 * 60 * 60 * 24
  const hour = 1000 * 60 * 60
  const min = 1000 * 60
  if (diffMs < min) return 'just now'
  if (diffMs < hour) return `${Math.floor(diffMs / min)}m ago`
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`
  if (diffMs < day * 7) return `${Math.floor(diffMs / day)}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export const formatDueDate = (isoDate: string, nowIso?: string): string => {
  const due = new Date(isoDate).getTime()
  const now = nowIso ? new Date(nowIso).getTime() : Date.now()
  const day = 1000 * 60 * 60 * 24
  const diffDays = Math.round((due - now) / day)
  const formatted = new Date(isoDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
  if (diffDays === 0) return `due today (${formatted})`
  if (diffDays === 1) return `due tomorrow (${formatted})`
  if (diffDays > 1 && diffDays < 14) return `due in ${diffDays}d (${formatted})`
  if (diffDays === -1) return `${formatted} (1 day ago)`
  if (diffDays < -1) return `${formatted} (${Math.abs(diffDays)}d ago)`
  return formatted
}
