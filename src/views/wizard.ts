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
      'Direct API access. Unlocks Adapter 1: multi-contact fan-out, completion check, and AppFolio note writeback. Requires Kestrel Property Management on a plan with the API add-on enabled.',
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
        hint: 'Shown once at provisioning. Store in Railway Variables, never in code.',
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
          'API access requires the AppFolio API add-on on your plan. Without it this wizard is unavailable — Adapter 2B (Coordinator XLSX export) is the path.',
      },
      {
        title: 'Request access for the Sagan Integrator',
        body:
          'Ask your AppFolio account rep to enable API access for the Sagan Integrator on the Kestrel database. Sagan provides the integration name and callback URL.',
      },
      {
        title: 'Capture credentials',
        body:
          'Save Client ID, Client Secret, and the database name at the moment of provisioning — Client Secret is shown once.',
      },
      {
        title: 'Paste into Railway',
        body:
          'Railway → kestrel-pm-agent service → Variables: APPFOLIO_CLIENT_ID, APPFOLIO_CLIENT_SECRET, APPFOLIO_DATABASE, APPFOLIO_BASE_URL.',
      },
      {
        title: 'Switch adapter',
        body:
          'Admin → AppFolio ingest adapter → Adapter 1 (REST API). Pre-send checks and multi-contact fan-out activate immediately.',
      },
    ],
    docsUrl: 'https://www.appfolio.com/',
  },
  gmail: {
    id: 'gmail',
    name: 'Google Workspace (Gmail)',
    description:
      'Service account with domain-wide delegation handles outbound email and inbound reply polling for the agent. Two mailboxes: pm-agent@kestrelpm.com (outbound + replies) and pm-agent-ingest@kestrelpm.com (XLSX drop on Adapter 2).',
    fields: [
      {
        label: 'Service Account JSON',
        hint: 'The full credentials.json from Google Cloud Console, one line. Pasted directly as GOOGLE_WORKSPACE_SERVICE_ACCOUNT_JSON in Railway.',
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
        hint: 'Adapter 2 only — where the weekly XLSX from AppFolio lands.',
        placeholder: 'pm-agent-ingest@kestrelpm.com',
      },
    ],
    steps: [
      {
        title: 'Provision mailboxes',
        body:
          'Kestrel PM IT creates pm-agent@kestrelpm.com (outbound + replies) and pm-agent-ingest@kestrelpm.com (XLSX drop).',
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
        title: 'Paste into Railway',
        body:
          'Variables: GOOGLE_WORKSPACE_SERVICE_ACCOUNT_JSON (full JSON), GOOGLE_WORKSPACE_IMPERSONATE_USER, APPFOLIO_INGEST_INBOX.',
      },
    ],
    docsUrl: 'https://developers.google.com/workspace/guides/create-credentials',
  },
  twilio: {
    id: 'twilio',
    name: 'Twilio',
    description:
      'Programmable Messaging + Voice + Lookup for SMS, voice IVR, and line-type detection. Twilio account is created under Kestrel Property Management\'s business entity, not Sagan\'s.',
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
        hint: 'The pool the registered 10DLC campaign attaches to.',
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
          'Dana Reyes creates a Twilio account under Kestrel Property Management\'s business entity. Existing Nextiva 10DLC registration is NOT portable.',
      },
      {
        title: 'Provision number',
        body:
          'Twilio Phone Numbers → Buy. US local number with both Voice and Messaging capabilities.',
      },
      {
        title: 'Submit A2P 10DLC brand + campaign',
        body:
          'Realistic 2–3 week clearance window. Inbound SMS works from day 1 regardless. Outbound SMS gated by Twilio TCR approval.',
      },
      {
        title: 'Wire webhooks',
        body:
          'POST /webhooks/twilio/sms (inbound SMS) and POST /webhooks/twilio/voice (IVR keypress) on the deployed Railway URL. Validates with TWILIO_AUTH_TOKEN.',
      },
      {
        title: 'Phase 1.5 cutover',
        body:
          'When 10DLC clears in TCR: flip SMS_OUTBOUND_ENABLED=true in Railway. No code change. Outbound SMS resumes at the next T-5 tick.',
      },
    ],
    docsUrl: 'https://www.twilio.com/docs/usage/a2p-10dlc',
  },
}

export const wizardPage = (id: string) => {
  const w = WIZARDS[id]
  if (!w) return null
  return layout({
    title: `Connect ${w.name} · Kestrel PM Booking Agent`,
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
          <strong>Demo mode.</strong> All inputs below are disabled. This wizard
          is a preview of production setup — the actual paste happens in
          Railway Variables, not here.
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
