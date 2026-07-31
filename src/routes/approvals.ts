import { Hono } from 'hono'
import { getSettings } from '../db/client.js'
import {
  getApprovalDetail,
  listApprovals,
  recordDecision,
} from '../db/approvals.js'
import { approval, logLine, recordTransition } from '../db/threads.js'
import { approvalsPage } from '../views/approvals.js'
import { approvalDetailPage } from '../views/approval_detail.js'

const route = new Hono()

route.get('/', (c) => {
  const settings = getSettings()
  return c.html(
    approvalsPage({
      approvals: listApprovals(),
      demoClockIso: settings.demo_clock_iso,
    }),
  )
})

route.get('/:id', (c) => {
  const detail = getApprovalDetail(c.req.param('id'))
  if (!detail) return c.notFound()
  const settings = getSettings()
  return c.html(
    approvalDetailPage({ detail, demoClockIso: settings.demo_clock_iso }),
  )
})

/** Coordinator sends the vendor. The end of the happy path. */
route.post('/:id/_dispatch', (c) => {
  const id = c.req.param('id')
  const detail = getApprovalDetail(id)
  if (!detail) return c.notFound()
  const now = getSettings().demo_clock_iso
  recordTransition(approval(id), 'Closed_Dispatched', 'Vendor dispatched', now)
  logLine(approval(id), 'success', 'Vendor dispatched by the coordinator.', now)
  return c.redirect(`/approvals/${id}`)
})

/** Owner said no and the resident has been told. */
route.post('/:id/_close-declined', (c) => {
  const id = c.req.param('id')
  const detail = getApprovalDetail(id)
  if (!detail) return c.notFound()
  const now = getSettings().demo_clock_iso
  recordTransition(approval(id), 'Closed_Declined', 'Closed after the owner declined', now)
  logLine(approval(id), 'info', 'Closed. The resident has been told.', now)
  return c.redirect(`/approvals/${id}`)
})

/** Pulled before a decision — usually because the problem resolved itself. */
route.post('/:id/_withdraw', (c) => {
  const id = c.req.param('id')
  const detail = getApprovalDetail(id)
  if (!detail) return c.notFound()
  const now = getSettings().demo_clock_iso
  recordTransition(approval(id), 'Closed_Withdrawn', 'Withdrawn before a decision', now)
  recordDecision(id, now, null)
  logLine(approval(id), 'info', 'Withdrawn. No decision was needed in the end.', now)
  return c.redirect(`/approvals/${id}`)
})

export default route
