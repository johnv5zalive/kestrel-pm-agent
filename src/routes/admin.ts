import { Hono } from 'hono'
import { db, getSettings } from '../db/client.js'
import { listJobs, transition } from '../db/queries_inbox.js'
import { adminPage } from '../views/admin.js'
import { wizardPage } from '../views/wizard.js'
import { AGENT_STATES, type AgentState } from '../agent/state_machine.js'

const route = new Hono()

route.get('/', (c) => {
  const settings = getSettings()
  const tourStep = Number.parseInt(c.req.query('tour') ?? '0', 10) || undefined
  return c.html(
    adminPage({
      jobs: listJobs(),
      ingestAdapter: settings.ingest_adapter,
      smsOutboundEnabled: settings.sms_outbound_enabled === 1,
      demoClockIso: settings.demo_clock_iso,
      tourStep,
    }),
  )
})

route.get('/wizard/:system', (c) => {
  const page = wizardPage(c.req.param('system'))
  if (!page) return c.notFound()
  return c.html(page)
})

route.post('/_override-state', async (c) => {
  const body = await c.req.parseBody()
  const rseId = String(body.rseId ?? '')
  const state = String(body.state ?? '')
  if (!(AGENT_STATES as readonly string[]).includes(state)) {
    return c.json({ error: 'invalid state' }, 400)
  }
  if (!db.prepare(`SELECT 1 FROM recurring_service_events WHERE id = ?`).get(rseId)) {
    return c.notFound()
  }
  const settings = getSettings()
  transition(rseId, state as AgentState, 'Admin override', settings.demo_clock_iso)
  return c.redirect(c.req.header('Referer') ?? '/admin', 303)
})

export default route
