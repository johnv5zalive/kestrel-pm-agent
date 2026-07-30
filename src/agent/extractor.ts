interface DateExtractionInput {
  replyText: string
  /** Reference "today" so relative phrases ("next Tuesday") resolve correctly. */
  referenceDateIso: string
  /** RSE due-date — used as anchor for "around the first" / "after the holiday" etc. */
  dueDateIso: string
}

export interface DateExtraction {
  parsedDate: string | null // YYYY-MM-DD; null if too ambiguous
  parsedTimeWindow: string | null // free text describing time-of-day if mentioned
  confidence: number
  rationale: string
}

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
]
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

/**
 * Local, deterministic date extractor — no external LLM/API key required.
 * Handles the shapes that appear in the demo reply pool: explicit "Month Day",
 * a lone weekday ("next Tuesday"), and vague/multi-option phrasing that should
 * stay low-confidence so it routes to Awaiting-Human · ambiguous reply.
 *
 * The production build swaps this for a hosted model; the demo runs fully
 * offline so it can be shown without any credentials.
 */
export async function extractProposedDate(
  input: DateExtractionInput,
): Promise<DateExtraction> {
  const text = input.replyText.trim()
  const t = text.toLowerCase()
  const ref = new Date(`${input.referenceDateIso.slice(0, 10)}T00:00:00Z`)
  const timeWindow = extractTimeWindow(t)

  // Vague / non-committal → deliberately low confidence, no date.
  const vague = /\b(whenever|flexible|whatever (date|day|time)|your end|no preference|up to you|any ?time works|let me check|soon)\b/
  if (vague.test(t)) {
    return {
      parsedDate: null,
      parsedTimeWindow: timeWindow,
      confidence: 0.4,
      rationale: 'Reply is non-committal — no concrete date proposed.',
    }
  }

  // Multiple options / hedged ("either Monday or Tuesday", "first or second week").
  const weekdayHits = WEEKDAYS.filter((d) => new RegExp(`\\b${d}\\b`).test(t)).length
  if (/\beither\b[\s\S]*\bor\b/.test(t) || /\bfirst or second\b/.test(t) || weekdayHits >= 2) {
    return {
      parsedDate: null,
      parsedTimeWindow: timeWindow,
      confidence: 0.45,
      rationale: 'Multiple options offered — needs confirmation.',
    }
  }

  // Explicit "Month Day" (e.g. "May 5").
  const md = t.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})\b/,
  )
  if (md) {
    const month = MONTHS.indexOf(md[1])
    const day = Number.parseInt(md[2], 10)
    let year = ref.getUTCFullYear()
    let d = new Date(Date.UTC(year, month, day))
    if (d.getTime() < ref.getTime() - 1000 * 60 * 60 * 24 * 30) {
      year += 1
      d = new Date(Date.UTC(year, month, day))
    }
    return {
      parsedDate: d.toISOString().slice(0, 10),
      parsedTimeWindow: timeWindow,
      confidence: 0.92,
      rationale: `Parsed explicit date ${MONTHS[month]} ${day}.`,
    }
  }

  // Lone weekday ("Tuesday", "next Tuesday") → next occurrence on/after ref.
  const wd = t.match(/\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/)
  if (wd) {
    const target = WEEKDAYS.indexOf(wd[1])
    const d = new Date(ref)
    // Advance to the next occurrence of the target weekday after "today".
    do {
      d.setUTCDate(d.getUTCDate() + 1)
    } while (d.getUTCDay() !== target)
    if (/\bnext week\b/.test(t)) d.setUTCDate(d.getUTCDate() + 7)
    return {
      parsedDate: d.toISOString().slice(0, 10),
      parsedTimeWindow: timeWindow,
      confidence: 0.78,
      rationale: `Resolved "${wd[1]}" to ${d.toISOString().slice(0, 10)}.`,
    }
  }

  return {
    parsedDate: null,
    parsedTimeWindow: timeWindow,
    confidence: 0.4,
    rationale: 'No concrete date found in reply.',
  }
}

function extractTimeWindow(t: string): string | null {
  const range = t.match(/\b(\d{1,2})\s?-\s?(\d{1,2})\s?(am|pm)\b/)
  if (range) return `${range[1]}-${range[2]}${range[3]}`
  const after = t.match(/\bafter\s+(\d{1,2})\s?(am|pm)\b/)
  if (after) return `after ${after[1]}${after[2]}`
  const at = t.match(/\bat\s+(\d{1,2})\s?(am|pm)\b/)
  if (at) return `${at[1]}${at[2]}`
  if (/\bmorning\b/.test(t)) return 'morning'
  if (/\bafternoon\b/.test(t)) return 'afternoon'
  if (/\bevening\b/.test(t)) return 'evening'
  return null
}
