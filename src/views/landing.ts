import { html } from 'hono/html'
import { layout } from './layout.js'

/**
 * Landing page. Above-the-fold target: 1280×720 — full hero (headline +
 * subhead + bullets + CTA + visual) must fit without scroll.
 * Below the fold: "what this demo covers" narrative + footer.
 *
 * No demo-tag on landing per demo-template.md §5 ("a persistent header tag,
 * visible on every page that isn't the landing").
 */
export const landingPage = (props: { tourStep?: number } = {}) =>
  layout({
    title: 'Kestrel Property Management — Maintenance Scheduling Agent demo',
    showDemoTag: false,
    hideHeader: true,
    tourStep: props.tourStep,
    currentPath: '/',
    body: html`
      <!-- Top bar — minimal, self-contained on landing -->
      <div class="border-b border-canvas-deep bg-white">
        <div class="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div class="flex items-center gap-3">
            <img
              src="/static/kestrel-logo.svg"
              alt="Kestrel Property Management"
              class="h-8 w-auto"
              width="160"
              height="32"
            />
            <span
              class="hidden sm:inline pl-3 ml-1 border-l border-canvas-deep text-ink-fade text-sm"
            >
              Maintenance Scheduling Agent · prototype
            </span>
          </div>
          <a href="https://kestrelpm.com" class="text-sm text-ink-fade hover:text-ink transition-colors" target="_blank" rel="noopener">
            kestrelpm.com
          </a>
        </div>
      </div>

      <!-- HERO — above the fold at 1280×720 -->
      <section class="bg-canvas">
        <div class="max-w-7xl mx-auto px-6 pt-10 pb-14 md:pt-12 md:pb-14">
          <div class="grid md:grid-cols-12 gap-8 md:gap-12 items-center">
            <!-- Left: Copy + CTA -->
            <div class="md:col-span-6 lg:col-span-7">
              <div
                class="inline-flex items-center gap-2 mb-5 px-3 py-1 rounded-full bg-brand-sky-soft text-brand-navy text-xs font-bold uppercase tracking-wider"
              >
                <span class="w-1.5 h-1.5 rounded-full bg-brand-navy"></span>
                Built for Kestrel Property Management
              </div>
              <h1
                class="font-black text-ink leading-[1.05] text-4xl md:text-[2.75rem] lg:text-5xl tracking-tight mb-4"
              >
                Stop chasing people
                <span class="text-brand-navy">so the work can actually</span>
                happen.
              </h1>
              <p class="text-base md:text-lg text-ink-fade leading-relaxed mb-6 max-w-xl">
                Three things hold maintenance up: nobody has agreed a date, the owner
                has not approved the spend, or the vendor's insurance has lapsed. The
                agent chases all three and only brings your coordinator the ones that
                genuinely need a person.
              </p>

              <!-- Bullets: 3 punchy, each tied to a real demo flow -->
              <ul class="space-y-2.5 mb-7">
                ${bullet(
                  'Chases a date for every scheduled visit, escalating from email to text to a short call',
                  'inbox',
                )}
                ${bullet(
                  'Chases owners for approval on anything over their limit, and spots a capped yes before you book on it',
                  'route',
                )}
                ${bullet(
                  'Watches every vendor certificate and takes anyone with lapsed cover off the dispatch list',
                  'timeline',
                )}
              </ul>

              <div class="flex flex-wrap items-center gap-3" data-tour-highlight="cta-try-demo">
                <a href="/today?tour=1" class="btn-primary">
                  <svg
                    class="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2.25"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
                    />
                  </svg>
                  Start the walkthrough
                </a>
                <a href="/today" class="btn-ghost">
                  See today's list
                  <svg
                    class="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke-width="2"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                    />
                  </svg>
                </a>
              </div>
            </div>

            <!-- Right: Preview card — the agent's payoff moment -->
            <div class="md:col-span-6 lg:col-span-5">
              ${previewCard()}
            </div>
          </div>
        </div>
      </section>

    `,
  })

const bullet = (text: string, kind: 'inbox' | 'route' | 'timeline') => html`
  <li class="flex items-start gap-3">
    <span
      class="flex-shrink-0 w-7 h-7 rounded-md bg-brand-sky-soft text-brand-navy flex items-center justify-center mt-px"
    >
      ${bulletIcon(kind)}
    </span>
    <span class="text-ink leading-relaxed">${text}</span>
  </li>
`

const bulletIcon = (kind: 'inbox' | 'route' | 'timeline') => {
  if (kind === 'inbox')
    return html`<svg
      class="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke-width="2"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M2.25 13.5h3.86a2.25 2.25 0 012.012 1.244l.256.512a2.25 2.25 0 002.013 1.244h3.218a2.25 2.25 0 002.013-1.244l.256-.512a2.25 2.25 0 012.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18v-4.162c0-.224-.034-.447-.1-.661L19.24 5.338a2.25 2.25 0 00-2.15-1.588H6.911a2.25 2.25 0 00-2.15 1.588l-2.41 7.838a2.25 2.25 0 00-.1.661z"
      />
    </svg>`
  if (kind === 'route')
    return html`<svg
      class="w-4 h-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke-width="2"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
      />
    </svg>`
  return html`<svg
    class="w-4 h-4"
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
  </svg>`
}

/**
 * The hero's right-side visual — a stylized preview of the agent's payoff
 * moment: an Awaiting-Human job card showing Beacon Ridge (the multi-contact
 * case from the seed). Modeled on the inbox card we'll build in M3, so the
 * landing's promise matches what the user sees the moment they click in.
 */
const previewCard = () => html`
  <div
    class="rounded-xl border border-canvas-deep bg-white shadow-card p-1 max-w-md md:ml-auto"
  >
    <!-- Browser-chrome-ish frame so it reads as "screenshot of inbox" -->
    <div class="px-3 py-2 border-b border-canvas-deep flex items-center gap-1.5">
      <span class="w-2.5 h-2.5 rounded-full bg-canvas-deep"></span>
      <span class="w-2.5 h-2.5 rounded-full bg-canvas-deep"></span>
      <span class="w-2.5 h-2.5 rounded-full bg-canvas-deep"></span>
      <span class="ml-3 text-[11px] text-ink-muted font-mono">kestrel-pm/inbox</span>
    </div>

    <div class="p-5">
      <div class="flex items-center justify-between mb-4">
        <span class="text-[11px] font-bold uppercase tracking-wider text-state-awaiting">
          Awaiting Human · date proposed
        </span>
        <span class="text-[11px] text-ink-muted font-mono">SMV-BEACON-2026-05</span>
      </div>

      <h4 class="font-bold text-ink text-lg leading-tight">Beacon Ridge Condominiums</h4>
      <p class="text-sm text-ink-fade mt-1">
        Quarterly Service · 4 assets · Raleigh, NC
      </p>

      <div class="mt-5 p-4 rounded-md bg-canvas border border-canvas-deep">
        <div class="flex items-center justify-between text-[11px] text-ink-muted mb-2">
          <span class="font-medium">Owen Prescott · Facilities Director</span>
          <span>2 days ago</span>
        </div>
        <p class="text-sm text-ink leading-snug">
          "Tuesday May 5 in the afternoon works for me, after 1pm. Need to
          coordinate with the on-site team for Building C access so let me know
          what time you're starting."
        </p>
      </div>

      <div class="mt-4 p-3 rounded-md bg-brand-sky-soft/50 border border-brand-sky/30">
        <div class="text-[11px] uppercase tracking-wider text-brand-navy font-bold mb-1">
          Agent extracted
        </div>
        <div class="flex items-center justify-between">
          <span class="text-ink font-medium">Tuesday, May 5 · after 1pm</span>
          <span class="text-[11px] text-ink-muted font-mono">parsed by agent</span>
        </div>
      </div>

      <div class="mt-5 flex items-center justify-between gap-3">
        <button class="btn-block-sm flex-1" type="button" disabled>
          Confirm to mark booked
        </button>
        <button class="btn-ghost text-xs" type="button" disabled>Open thread</button>
      </div>
    </div>
  </div>
`
