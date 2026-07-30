/**
 * Twilio webhook signature verification.
 * https://www.twilio.com/docs/usage/webhooks/webhooks-security
 *
 * Signature = base64(HMAC-SHA1(authToken, fullUrl + sortedFormParams))
 *
 * If TWILIO_AUTH_TOKEN is unset (demo mode), verification is skipped — the
 * route accepts the call as-is and logs it. At production cutover, set
 * TWILIO_AUTH_TOKEN in Railway and signature verification activates with no
 * code change.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'
import { env } from '../env.js'

export interface VerifyResult {
  ok: boolean
  reason: 'verified' | 'no_token_demo_mode' | 'missing_signature' | 'mismatch'
}

export function verifyTwilioSignature(
  fullUrl: string,
  formParams: Record<string, string>,
  signatureHeader: string | undefined,
): VerifyResult {
  if (!env.TWILIO_AUTH_TOKEN) {
    // Demo mode — accept everything and log. At production cutover, the
    // env var goes live and this branch stops firing.
    return { ok: true, reason: 'no_token_demo_mode' }
  }
  if (!signatureHeader) {
    return { ok: false, reason: 'missing_signature' }
  }

  const sortedKeys = Object.keys(formParams).sort()
  let signedString = fullUrl
  for (const k of sortedKeys) signedString += k + (formParams[k] ?? '')

  const expected = createHmac('sha1', env.TWILIO_AUTH_TOKEN)
    .update(signedString)
    .digest('base64')

  const a = Buffer.from(expected)
  const b = Buffer.from(signatureHeader)
  if (a.length !== b.length) return { ok: false, reason: 'mismatch' }
  return timingSafeEqual(a, b)
    ? { ok: true, reason: 'verified' }
    : { ok: false, reason: 'mismatch' }
}

/**
 * Reconstruct the full URL Twilio used to compute its signature. Twilio
 * signs the absolute URL it called — so we use APP_BASE_URL when set, else
 * derive from the request's host header.
 */
export function fullWebhookUrl(host: string | undefined, path: string): string {
  if (env.APP_BASE_URL) return env.APP_BASE_URL.replace(/\/$/, '') + path
  if (host) return `https://${host}${path}`
  return path
}
