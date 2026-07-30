import { INBOUND_CLASSIFICATIONS, type InboundClassification } from './state_machine.js'

interface ClassifyOutput {
  classification: InboundClassification
  confidence: number
  rationale: string
}

// An explicit calendar reference: a weekday, a "Month Day", or "next week/month".
// This is a strong proposed-date signal that outranks a trailing question mark
// (e.g. "How about Wednesday, May 7?").
const EXPLICIT_DATE =
  /\b(sun|mon|tues|wednes|thurs|fri|satur)day\b|\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}\b|\bnext (week|month)\b/

// A softer scheduling signal — present in vague proposals ("whenever you're
// available", "we're flexible"). Only consulted after ruling out a question.
const SOFT_DATE =
  /\b(whenever|flexible|availabilit(y|ies)|available|works for|that works|schedule|morning|afternoon|\d{1,2}\s?(am|pm))\b/

const OPT_OUT =
  /\b(remove (us|me)|take (us|me) off|off the (list|schedule)|unsubscribe|no longer|not interested|cancel|in-?house|won'?t need|different (management|company|vendor)|changed management|sold the|new (owner|manager|management))\b/

/**
 * Local, deterministic reply classifier — no external LLM/API key required.
 * Keyword + shape heuristics tuned for the property-maintenance reply pool.
 * Order: opt-out → explicit-date → question → soft-date → irrelevant.
 *
 * The production build swaps this for a hosted model; the demo runs fully
 * offline so it can be shown without any credentials.
 */
export async function classifyReply(rawText: string): Promise<ClassifyOutput> {
  const text = rawText.trim()
  const t = text.toLowerCase()

  let classification: InboundClassification
  let confidence: number
  let rationale: string

  if (OPT_OUT.test(t)) {
    classification = 'opt-out'
    confidence = 0.95
    rationale = 'Opt-out / cancellation request detected.'
  } else if (EXPLICIT_DATE.test(t)) {
    classification = 'proposed-date'
    confidence = 0.88
    rationale = 'Contact proposed a specific date.'
  } else if (text.includes('?')) {
    classification = 'question'
    confidence = 0.9
    rationale = 'Contact asked a question rather than proposing a date.'
  } else if (SOFT_DATE.test(t)) {
    classification = 'proposed-date'
    confidence = 0.6
    rationale = 'Contact signalled availability without a firm date.'
  } else {
    classification = 'irrelevant'
    confidence = 0.5
    rationale = 'No clear scheduling intent detected.'
  }

  // Defensive: ensure we only ever emit a known label.
  if (!(INBOUND_CLASSIFICATIONS as readonly string[]).includes(classification)) {
    classification = 'irrelevant'
  }
  return { classification, confidence, rationale }
}
