/**
 * Pool of synthetic inbound replies, written so each runs cleanly through
 * the real LLM classifier + extractor. Variety in phrasing tests the
 * extraction pipeline (precise dates vs relative phrases vs vague).
 *
 * Distribution: ~60% proposed-date (most common reply), ~15% question,
 * ~15% ambiguous (still proposed-date but low confidence), ~10% opt-out.
 */

interface ReplyTemplate {
  intent: 'proposed-date-precise' | 'proposed-date-loose' | 'proposed-date-vague' | 'question' | 'opt-out'
  channel: 'email' | 'sms'
  text: (vars: { customerName: string; cadence: string; dueDate: string }) => string
}

const POOL: ReplyTemplate[] = [
  // ---- Precise proposed dates ----
  {
    intent: 'proposed-date-precise',
    channel: 'email',
    text: ({ dueDate }) => `${nextWeekday(dueDate, 'Tuesday')} works. Anytime after 1pm.`,
  },
  {
    intent: 'proposed-date-precise',
    channel: 'email',
    text: ({ dueDate }) =>
      `How about ${nextWeekday(dueDate, 'Wednesday')}? Morning preferred — before the day gets busy.`,
  },
  {
    intent: 'proposed-date-precise',
    channel: 'sms',
    text: ({ dueDate }) =>
      `Yes — ${nextWeekday(dueDate, 'Thursday')} 9-11am window. Call me when you're 30 min out.`,
  },
  {
    intent: 'proposed-date-precise',
    channel: 'email',
    text: ({ dueDate }) =>
      `${formatDay(addDays(dueDate, 2))} would work. Will be on-site all day.`,
  },
  // ---- Loose proposed dates (LLM should still resolve) ----
  {
    intent: 'proposed-date-loose',
    channel: 'email',
    text: ({ dueDate }) =>
      `Either Monday or Tuesday next week works. Let me know what fits your tech's schedule. Reference: ${formatDay(dueDate)} is when you said it was due.`,
  },
  {
    intent: 'proposed-date-loose',
    channel: 'sms',
    text: () => 'first or second week of next month is best. Tuesdays preferred.',
  },
  // ---- Vague / ambiguous (low LLM confidence) ----
  {
    intent: 'proposed-date-vague',
    channel: 'email',
    text: () => "Whenever y'all have availability is fine. Just let me know when.",
  },
  {
    intent: 'proposed-date-vague',
    channel: 'email',
    text: () =>
      "Sounds good. We're flexible — pick whatever date works on your end and we'll make it work.",
  },
  // ---- Questions ----
  {
    intent: 'question',
    channel: 'email',
    text: () =>
      'Quick question before I schedule — is this PM covered under our management agreement or billed separately? Want to confirm with the board.',
  },
  {
    intent: 'question',
    channel: 'email',
    text: () =>
      'Are your techs bringing replacement filters, or do we need to have maintenance meet them on-site?',
  },
  // ---- Opt-out ----
  {
    intent: 'opt-out',
    channel: 'email',
    text: () =>
      "Please remove us from the recurring schedule — we brought maintenance in-house and won't need the recurring visits anymore.",
  },
  {
    intent: 'opt-out',
    channel: 'sms',
    text: () => 'pls take us off the list, we handle this in-house now',
  },
]

export interface PickedReply {
  channel: 'email' | 'sms'
  text: string
  intent: string
}

/**
 * Choose a reply at random. Weighted slightly toward proposed-date since
 * that's the most common real-world outcome. Caller may pass `excludeIntents`
 * to avoid showing the same intent twice in a row when re-clicking.
 */
export function pickReply(
  ctx: { customerName: string; cadence: string; dueDate: string },
  excludeIntents: string[] = [],
): PickedReply {
  const pool = POOL.filter((p) => !excludeIntents.includes(p.intent))
  const candidates = pool.length > 0 ? pool : POOL
  const t = candidates[Math.floor(Math.random() * candidates.length)]!
  return {
    channel: t.channel,
    text: t.text(ctx),
    intent: t.intent,
  }
}

// ---- date helpers ----

function addDays(iso: string, n: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

function nextWeekday(anchorIso: string, dayName: string): string {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const target = days.indexOf(dayName)
  if (target < 0) return formatDay(anchorIso)
  const d = new Date(anchorIso)
  // Advance to next occurrence of the target weekday on/after the anchor.
  while (d.getUTCDay() !== target) d.setUTCDate(d.getUTCDate() + 1)
  return formatDay(d.toISOString().slice(0, 10))
}

function formatDay(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}
