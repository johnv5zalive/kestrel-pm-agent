/**
 * Demo control endpoints — slider, reset, SMS toggle, adapter switch.
 * Mounted at /demo. All POST endpoints redirect back to the Referer.
 */

import { Hono } from 'hono'
import { db } from '../db/client.js'
import { runSeed } from '../db/seed.js'
import { tickTo } from '../agent/scheduler.js'

const route = new Hono()

const ANCHOR_DAY_0_ISO = '2026-04-15T09:00:00.000Z' // dayOffset 0 = Apr 15 (early)

route.post('/_set-clock', async (c) => {
  const body = await c.req.parseBody()
  const dayOffset = Number.parseInt(String(body.dayOffset ?? '15'), 10)
  if (!Number.isFinite(dayOffset)) return c.json({ error: 'bad dayOffset' }, 400)
  const clamped = Math.max(0, Math.min(61, dayOffset))
  const newClock = isoFromOffset(clamped)

  const cur = db.prepare(`SELECT demo_clock_iso FROM settings WHERE id = 1`).get() as {
    demo_clock_iso: string
  }
  const priorOffset = offsetFromIso(cur.demo_clock_iso)
  const movingForward = new Date(newClock).getTime() > new Date(cur.demo_clock_iso).getTime()
  const daysDelta = clamped - priorOffset

  db.prepare(`UPDATE settings SET demo_clock_iso = ? WHERE id = 1`).run(newClock)

  // Forward time-travel triggers scheduler. Backward time-travel needs a Reset.
  if (movingForward) tickTo(newClock)

  // Encode the tick result in the redirect query so /inbox can render a toast
  // and gold-flash any cards whose state just changed.
  const ref = c.req.header('Referer') ?? '/inbox'
  const refUrl = new URL(ref, 'http://_local')
  if (daysDelta === 0) {
    refUrl.searchParams.delete('tick')
    refUrl.searchParams.delete('days')
  } else if (daysDelta < 0) {
    refUrl.searchParams.set('tick', 'back')
    refUrl.searchParams.set('days', String(Math.abs(daysDelta)))
  } else {
    refUrl.searchParams.set('tick', 'forward')
    refUrl.searchParams.set('days', String(daysDelta))
  }
  return c.redirect(refUrl.pathname + refUrl.search, 303)
})

route.post('/_reset-seed', (c) => {
  runSeed()
  return c.redirect(c.req.header('Referer') ?? '/inbox', 303)
})

route.post('/_toggle-sms', (c) => {
  const cur = db.prepare(`SELECT sms_outbound_enabled FROM settings WHERE id = 1`).get() as {
    sms_outbound_enabled: number
  }
  db.prepare(`UPDATE settings SET sms_outbound_enabled = ? WHERE id = 1`).run(
    cur.sms_outbound_enabled === 1 ? 0 : 1,
  )
  return c.redirect(c.req.header('Referer') ?? '/inbox', 303)
})

route.post('/_set-adapter', async (c) => {
  const body = await c.req.parseBody()
  const adapter = String(body.adapter ?? 'adapter2a')
  if (
    !['adapter1', 'adapter2a', 'adapter2b_full', 'adapter2b_degraded'].includes(adapter)
  ) {
    return c.json({ error: 'bad adapter' }, 400)
  }
  db.prepare(`UPDATE settings SET ingest_adapter = ? WHERE id = 1`).run(adapter)
  return c.redirect(c.req.header('Referer') ?? '/inbox', 303)
})

function isoFromOffset(dayOffset: number): string {
  const d = new Date(ANCHOR_DAY_0_ISO)
  d.setUTCDate(d.getUTCDate() + dayOffset)
  return d.toISOString()
}

export function offsetFromIso(iso: string): number {
  const anchor = new Date(ANCHOR_DAY_0_ISO).getTime()
  const t = new Date(iso).getTime()
  return Math.round((t - anchor) / (1000 * 60 * 60 * 24))
}

export const DEMO_CLOCK_RANGE = { min: 0, max: 61 }

/**
 * Snap-points labeled along the slider track. "Today" is redundant with the
 * live readout below the slider, and "T+1" sits too close to "T-0" to label
 * cleanly — escalation past T-0 is visible from the current-clock readout
 * without a dedicated tick.
 */
export const DEMO_SNAP_POINTS = [
  { offset: 6, label: 'T-10', subLabel: 'Apr 21' }, // Apr 15 + 6 = Apr 21
  { offset: 11, label: 'T-5', subLabel: 'Apr 26' },
  { offset: 16, label: 'T-0', subLabel: 'May 1' },
  { offset: 41, label: 'June PMs', subLabel: 'May 26' },
]

export default route
