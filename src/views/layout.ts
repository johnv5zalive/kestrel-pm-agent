import { html } from 'hono/html'
import type { HtmlEscapedString } from 'hono/utils/html'
import { v2DialogsHtml } from './v2_specs.js'

export interface LayoutOptions {
  title: string
  body: HtmlEscapedString | Promise<HtmlEscapedString>
  /** Show the page-level "Demo Mode · sample data" tag in the header. False on landing. */
  showDemoTag?: boolean
  /** Hide the global header entirely (landing-only — has its own self-contained chrome). */
  hideHeader?: boolean
  /** No-op kept for caller compatibility — tour state is now driven client-side from ?tour=N. */
  tourStep?: number
  /** No-op kept for caller compatibility. */
  currentPath?: string
}

export const layout = ({
  title,
  body,
  showDemoTag = true,
  hideHeader = false,
}: LayoutOptions) => html`
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="theme-color" content="#14584A" />
      <title>${title}</title>
      <link rel="icon" type="image/svg+xml" href="/static/favicon.svg" />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
      <link
        href="https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700;900&family=JetBrains+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />
      <link rel="stylesheet" href="/static/styles.css" />
      <script src="/static/htmx.min.js" defer></script>
      <script src="/static/v2-affordance.js" defer></script>
      <script src="/static/tour.js" defer></script>
    </head>
    <body class="bg-canvas text-ink antialiased font-sans min-h-screen flex flex-col">
      ${hideHeader ? '' : appHeader(showDemoTag)}
      <main class="flex-1">${body}</main>
      ${appFooter()}
      ${v2DialogsHtml()}
    </body>
  </html>
`

const appHeader = (showDemoTag: boolean) => html`
  <header class="border-b border-canvas-deep bg-white">
    <div class="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-6">
      <a href="/" class="flex items-center gap-3 group">
        <img
          src="/static/kestrel-logo.svg"
          alt="Kestrel Property Management"
          class="h-8 w-auto"
          width="160"
          height="32"
        />
        <span class="hidden sm:inline text-ink-fade text-sm">Maintenance Scheduling Agent</span>
      </a>
      <nav class="flex items-center gap-3">
        ${showDemoTag
          ? html`<span class="demo-tag-page" title="This is a demo running on synthetic data.">
              <svg
                class="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
                />
              </svg>
              Demo Mode · sample data
            </span>`
          : ''}
        <a href="/inbox" class="text-sm text-ink-fade hover:text-ink transition-colors">
          Coordinator inbox
        </a>
        <a href="/admin" class="text-sm text-ink-fade hover:text-ink transition-colors">Admin</a>
        <a
          href="/inbox?tour=1"
          class="text-sm text-brand-navy hover:text-brand-navy-deep transition-colors font-medium inline-flex items-center gap-1"
          title="Replay the 8-step walkthrough"
        >
          <svg
            class="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="2"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
            />
          </svg>
          Replay tour
        </a>
      </nav>
    </div>
  </header>
`

const appFooter = () => html`
  <footer class="border-t border-canvas-deep bg-white mt-16">
    <div
      class="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4 text-sm text-ink-fade"
    >
      <div class="flex items-center gap-3">
        <img
          src="/static/kestrel-logo.svg"
          alt=""
          class="h-6 w-auto opacity-80"
          width="120"
          height="24"
        />
        <span>Kestrel Property Management · Managing communities since 2009</span>
      </div>
      <div class="flex items-center gap-5">
        <span>4130 Six Forks Rd, Raleigh, NC 27609</span>
        <a
          href="https://kestrelpm.com"
          target="_blank"
          rel="noopener noreferrer"
          class="hover:text-ink transition-colors"
        >
          kestrelpm.com
        </a>
      </div>
    </div>
  </footer>
`
