import { html } from 'hono/html'
import { layout } from './layout.js'

interface WizardField {
  label: string
  hint: string
  type?: 'text' | 'password' | 'textarea'
  placeholder?: string
}

interface WizardConfig {
  id: string
  name: string
  description: string
  fields: WizardField[]
  steps: Array<{ title: string; body: string }>
  docsUrl?: string
}

const WIZARDS: Record<string, WizardConfig> = {
  appfolio: {
    id: 'appfolio',
    name: 'AppFolio',
    description:
      'The direct connection. Lets the agent reach every contact on a property, check whether a visit was already booked, and write its notes back into AppFolio. Needs the API add-on on your AppFolio plan.',
    fields: [
      {
        label: 'Database name',
        hint: 'Your AppFolio subdomain — the first part of your portal URL (e.g. "kestrelpm" from kestrelpm.appfolio.com).',
        placeholder: 'kestrelpm',
      },
      {
        label: 'Client ID',
        hint: 'Issued by AppFolio when API access is provisioned for the Sagan Integrator.',
        placeholder: 'cid.…',
      },
      {
        label: 'Client Secret',
        hint: 'Shown once when access is granted. Store it with your other credentials, never in code.',
        type: 'password',
        placeholder: '••••••••••••',
      },
      {
        label: 'Base URL',
        hint: 'Production: https://kestrelpm.appfolio.com/api/v2',
        placeholder: 'https://kestrelpm.appfolio.com/api/v2',
      },
    ],
    steps: [
      {
        title: 'Confirm API add-on',
        body:
          'The direct connection needs the API add-on on your AppFolio plan. Without it, use the weekly report or the manual export instead. Both work.',
      },
      {
        title: 'Request access for the Sagan Integrator',
        body:
          'Ask your AppFolio account rep to enable API access for the Sagan Integrator on the Kestrel database. Sagan provides the integration name and callback URL.',
      },
      {
        title: 'Capture credentials',
        body:
          'Save the client ID, client secret and database name at the moment access is granted. The secret is only shown once.',
      },
      {
        title: 'Store the credentials',
        body:
          'Sagan stores these on the agent so they never sit in the code or in this screen.',
      },
      {
        title: 'Switch adapter',
        body:
          'In admin, switch to the direct connection. Reaching every contact and checking for existing bookings both start straight away.',
      },
    ],
    docsUrl: 'https://www.appfolio.com/',
  },
  gmail: {
    id: 'gmail',
    name: 'Google Workspace (Gmail)',
    description:
      'Gives the agent its own mailbox to send from and read replies at, plus a second one where the weekly maintenance report lands.',
    fields: [
      {
        label: 'Service Account JSON',
        hint: 'The full credentials file from Google Cloud Console, on one line.',
        type: 'textarea',
        placeholder: '{"type":"service_account","project_id":"…",…}',
      },
      {
        label: 'Impersonation user',
        hint: 'The mailbox the service account acts on behalf of (DWD requirement).',
        placeholder: 'pm-agent@kestrelpm.com',
      },
      {
        label: 'Ingest inbox',
        hint: 'Only needed for the weekly report. This is where it lands.',
        placeholder: 'pm-agent-ingest@kestrelpm.com',
      },
    ],
    steps: [
      {
        title: 'Provision mailboxes',
        body:
          'Kestrel IT creates two mailboxes: one the agent sends from and reads replies at, and one where the weekly report lands.',
      },
      {
        title: 'Create service account',
        body:
          'Google Cloud Console → IAM → Service Accounts → New. Download credentials JSON.',
      },
      {
        title: 'Grant domain-wide delegation',
        body:
          'Workspace Admin Console → Security → API Controls → Domain-wide Delegation. Add the SA Client ID with scope https://www.googleapis.com/auth/gmail.modify.',
      },
      {
        title: 'Store the credentials',
        body:
          'Sagan stores the service account details and both mailbox addresses on the agent.',
      },
    ],
    docsUrl: 'https://developers.google.com/workspace/guides/create-credentials',
  },
  twilio: {
    id: 'twilio',
    name: 'Twilio',
    description:
      'Handles text messages, the short automated call, and checking whether a number is a mobile or a landline. The account is created under Kestrel Property Management, not Sagan.',
    fields: [
      {
        label: 'Account SID',
        hint: 'Twilio Console → Account Info.',
        placeholder: 'AC…',
      },
      {
        label: 'Auth Token',
        hint: 'Used to verify webhook signatures from Twilio.',
        type: 'password',
        placeholder: '••••••••••••',
      },
      {
        label: 'Messaging Service SID',
        hint: 'The number pool your business messaging registration attaches to.',
        placeholder: 'MG…',
      },
      {
        label: 'From number (E.164)',
        hint: 'The provisioned US number for outbound SMS + voice IVR.',
        placeholder: '+19195550100',
      },
    ],
    steps: [
      {
        title: 'Create account',
        body:
          'The Twilio account is created under Kestrel Property Management, not Sagan. Any registration you already hold with another provider does not carry over.',
      },
      {
        title: 'Provision number',
        body:
          'Twilio Phone Numbers → Buy. US local number with both Voice and Messaging capabilities.',
      },
      {
        title: 'Register for business messaging',
        body:
          'Expect two to three weeks for carriers to approve it. Replies by text work from day one either way. Only sending is held up.',
      },
      {
        title: 'Wire webhooks',
        body:
          'Point Twilio at the agent for inbound texts and for keypresses on the automated call. Both are verified against your Twilio credentials.',
      },
      {
        title: 'Switch texting on',
        body:
          'Once carriers approve the registration, texting is switched on with a single setting. No rebuild. The agent starts including a text in its follow-ups straight away.',
      },
    ],
    docsUrl: 'https://www.twilio.com/docs/usage/a2p-10dlc',
  },
}

export const wizardPage = (id: string) => {
  const w = WIZARDS[id]
  if (!w) return null
  return layout({
    title: `Connect ${w.name} · Kestrel Maintenance Scheduling Agent`,
    body: html`
      <div class="max-w-4xl mx-auto px-6 py-8 space-y-6">
        <a
          href="/admin"
          class="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition-colors"
        >
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
          Back to admin
        </a>

        <div>
          <h1 class="font-black text-ink text-3xl tracking-tight">Connect ${w.name}</h1>
          <p class="text-ink-fade mt-2 leading-relaxed">${w.description}</p>
        </div>

        <div
          class="rounded-md border border-demo-gold-line/40 bg-demo-gold-soft/60 px-4 py-3 text-sm text-demo-gold-deep"
        >
          <strong>Sample data.</strong> The fields below are switched off. This is
          a preview of what setup involves. Credentials are entered during setup,
          not here.
        </div>

        <section class="rounded-lg border border-canvas-deep bg-white">
          <header class="px-5 py-3 border-b border-canvas-deep">
            <h2 class="font-bold text-ink tracking-tight">Required values</h2>
          </header>
          <div class="p-5 space-y-4">
            ${w.fields.map(
              (f) => html`
                <div>
                  <label class="block">
                    <span class="block font-bold text-ink text-sm mb-1">${f.label}</span>
                    ${f.type === 'textarea'
                      ? html`<textarea
                          disabled
                          rows="3"
                          placeholder="${f.placeholder ?? ''}"
                          class="w-full rounded border border-canvas-deep bg-canvas px-3 py-2 text-sm font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                        ></textarea>`
                      : html`<input
                          type="${f.type ?? 'text'}"
                          disabled
                          placeholder="${f.placeholder ?? ''}"
                          class="w-full rounded border border-canvas-deep bg-canvas px-3 py-2 text-sm font-mono disabled:opacity-60 disabled:cursor-not-allowed"
                        />`}
                  </label>
                  <p class="text-xs text-ink-fade mt-1">${f.hint}</p>
                </div>
              `,
            )}
          </div>
        </section>

        <section class="rounded-lg border border-canvas-deep bg-white">
          <header class="px-5 py-3 border-b border-canvas-deep">
            <h2 class="font-bold text-ink tracking-tight">Setup steps</h2>
          </header>
          <ol class="p-5 space-y-4">
            ${w.steps.map(
              (s, i) => html`
                <li class="flex gap-4">
                  <span
                    class="flex-shrink-0 w-7 h-7 rounded-full bg-brand-navy text-white text-xs font-bold flex items-center justify-center"
                    >${i + 1}</span
                  >
                  <div class="flex-1 min-w-0 pt-0.5">
                    <h3 class="font-bold text-ink text-sm mb-0.5">${s.title}</h3>
                    <p class="text-sm text-ink-fade leading-relaxed">${s.body}</p>
                  </div>
                </li>
              `,
            )}
          </ol>
          ${w.docsUrl
            ? html`<footer class="px-5 py-3 border-t border-canvas-deep text-sm">
                <a
                  href="${w.docsUrl}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-brand-navy hover:underline font-medium"
                >
                  ${w.name} docs ↗
                </a>
              </footer>`
            : ''}
        </section>
      </div>
    `,
  })
}
