/**
 * Owner-reply classifier — local and deterministic, no API key required.
 *
 * Owners answer approval requests in a fairly narrow set of ways: yes, no, a
 * question, or "not at that price". The interesting case is the fourth one,
 * because it looks like a decline and is not one. An owner who says "can we
 * get a second quote" has not refused the repair, and treating that as a no is
 * how a job silently dies.
 *
 * A second job this does is pull out the figure the owner actually agreed to,
 * which is not always the figure they were quoted. "Fine up to $1,200" against
 * a $1,450 quote is a conditional approval, and dispatching on it would land
 * the manager with the difference.
 */

import {
  OWNER_REPLY_CLASSIFICATIONS,
  type OwnerReplyClassification,
} from './approval_state.js'

export interface OwnerClassifyOutput {
  classification: OwnerReplyClassification
  confidence: number
  rationale: string
  /** Dollar figure the owner named, when they named one. */
  amountUsd: number | null
  /** True when they approved but attached a ceiling below the quote. */
  conditional: boolean
}

// Clear refusals. Deliberately narrow — "not at that price" is handled below
// as a counter-offer, not a decline.
const DECLINE =
  /\b(don'?t (do|proceed|approve)|do not (do|proceed|approve)|declin|reject|denied|deny|not approv|won'?t approve|no,? |hold off|leave it|skip it|not (doing|going ahead)|pass on)\b/

// The owner is not saying no, they are saying not like this.
const COUNTER =
  /\b(second (quote|opinion|bid)|another (quote|bid|vendor)|cheaper|too (much|expensive|high)|shop (it|this) around|other options?|alternative|can we get.*(quote|price)|any way to (bring|get) (it|that|the (price|cost)) down|competitive (quote|bid)|not at that price)\b/

// Explicit approvals.
const APPROVE =
  /\b(approv|go ahead|proceed|yes,? |sounds good|do it|get it (done|fixed|sorted)|fine by me|that'?s fine|ok(ay)? to proceed|green ?light|authoris|authoriz|please (do|fix|proceed)|no objection)\b/

// Conditional ceilings: "up to $1,200", "as long as it stays under 1500".
const CEILING =
  /\b(up to|no more than|not (?:more|higher) than|under|below|cap(?:ped)? at|max(?:imum)? of|so long as it'?s? under|as long as it stays under)\s*\$?\s*([\d,]+(?:\.\d{2})?)/i

// Any dollar figure at all.
const AMOUNT = /\$\s*([\d,]+(?:\.\d{2})?)/

function parseMoney(raw: string): number | null {
  const n = Number.parseFloat(raw.replace(/,/g, ''))
  return Number.isFinite(n) ? Math.round(n) : null
}

export async function classifyOwnerReply(
  rawText: string,
  quotedUsd?: number,
): Promise<OwnerClassifyOutput> {
  const text = rawText.trim()
  const t = text.toLowerCase()

  // A named ceiling is the strongest signal in the whole message, because it
  // changes what dispatching would actually cost.
  const ceilingMatch = CEILING.exec(t)
  const ceiling = ceilingMatch ? parseMoney(ceilingMatch[2]) : null
  const anyAmount = ceiling ?? (AMOUNT.exec(text) ? parseMoney(AMOUNT.exec(text)![1]) : null)

  let classification: OwnerReplyClassification
  let confidence: number
  let rationale: string
  let conditional = false

  if (COUNTER.test(t)) {
    classification = 'counter-offer'
    confidence = 0.86
    rationale = 'The owner wants a different price or another quote, which is not a refusal.'
  } else if (DECLINE.test(t)) {
    classification = 'declined'
    confidence = 0.9
    rationale = 'The owner declined the work.'
  } else if (APPROVE.test(t)) {
    classification = 'approved'
    confidence = 0.92
    rationale = 'The owner approved the work.'
    if (ceiling !== null && quotedUsd !== undefined && ceiling < quotedUsd) {
      conditional = true
      confidence = 0.7
      rationale = `The owner approved but capped it at $${ceiling.toLocaleString()}, which is below the $${quotedUsd.toLocaleString()} quote.`
    }
  } else if (text.includes('?')) {
    classification = 'question'
    confidence = 0.88
    rationale = 'The owner asked something before deciding.'
  } else if (ceiling !== null) {
    // A bare ceiling with no verb still reads as a conditional yes.
    classification = 'approved'
    confidence = 0.62
    conditional = quotedUsd !== undefined && ceiling < quotedUsd
    rationale = `The owner named a limit of $${ceiling.toLocaleString()} without saying yes outright.`
  } else {
    classification = 'irrelevant'
    confidence = 0.45
    rationale = 'No clear decision in this reply.'
  }

  if (!(OWNER_REPLY_CLASSIFICATIONS as readonly string[]).includes(classification)) {
    classification = 'irrelevant'
  }

  return {
    classification,
    confidence,
    rationale,
    amountUsd: anyAmount,
    conditional,
  }
}
