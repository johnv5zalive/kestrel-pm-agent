import { Hono } from 'hono'
import { getSettings } from '../db/client.js'
import { buildWorklist } from '../db/worklist.js'
import { todayPage } from '../views/today.js'

const route = new Hono()

route.get('/', (c) => {
  const settings = getSettings()
  return c.html(
    todayPage({
      items: buildWorklist(settings.demo_clock_iso),
      demoClockIso: settings.demo_clock_iso,
    }),
  )
})

export default route
