import { Hono } from 'hono'
import { getSettings } from '../db/client.js'
import { getComplianceDetail, listCompliance } from '../db/compliance.js'
import { compliance, logLine, recordTransition } from '../db/threads.js'
import { compliancePage } from '../views/compliance.js'
import { complianceDetailPage } from '../views/compliance_detail.js'

const route = new Hono()

route.get('/', (c) => {
  const settings = getSettings()
  return c.html(
    compliancePage({ docs: listCompliance(), demoClockIso: settings.demo_clock_iso }),
  )
})

route.get('/:id', (c) => {
  const detail = getComplianceDetail(c.req.param('id'))
  if (!detail) return c.notFound()
  const settings = getSettings()
  return c.html(
    complianceDetailPage({ detail, demoClockIso: settings.demo_clock_iso }),
  )
})

/**
 * A person has read the certificate and confirmed the dates. Only at this point
 * does the vendor come back onto the dispatch list — the agent deliberately
 * will not file a document it has not had checked.
 */
route.post('/:id/_accept', (c) => {
  const id = c.req.param('id')
  if (!getComplianceDetail(id)) return c.notFound()
  const now = getSettings().demo_clock_iso
  recordTransition(compliance(id), 'Closed_Renewed', 'Checked and filed by the coordinator', now)
  logLine(
    compliance(id),
    'success',
    'Certificate checked and filed. Vendor is back on the dispatch list.',
    now,
  )
  return c.redirect(`/compliance/${id}`)
})

export default route
