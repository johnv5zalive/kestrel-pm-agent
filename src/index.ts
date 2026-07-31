import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { env } from './env.js'
import { initSchema } from './db/client.js'
import { runSeed } from './db/seed.js'
import { landingPage } from './views/landing.js'
import { layout } from './views/layout.js'
import { html } from 'hono/html'
import inboxRoute from './routes/inbox.js'
import approvalsRoute from './routes/approvals.js'
import complianceRoute from './routes/compliance.js'
import demoRoute from './routes/demo.js'
import adminRoute from './routes/admin.js'
import twilioWebhookRoute from './routes/webhooks_twilio.js'

initSchema()
runSeed()

const app = new Hono()
app.use('*', logger())
app.use(
  '/static/*',
  serveStatic({ root: './public', rewriteRequestPath: (p) => p.replace(/^\/static/, '') }),
)
app.get('/favicon.ico', serveStatic({ path: './public/favicon.svg' }))

app.get('/', (c) => {
  const tourStep = Number.parseInt(c.req.query('tour') ?? '0', 10) || undefined
  return c.html(landingPage({ tourStep }))
})

app.route('/inbox', inboxRoute)
app.route('/approvals', approvalsRoute)
app.route('/compliance', complianceRoute)
app.route('/demo', demoRoute)
app.route('/admin', adminRoute)
app.route('/webhooks/twilio', twilioWebhookRoute)

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`kestrel-pm-agent listening on :${info.port}`)
})
