/**
 * Hand-rolled env config per sagan-stack §10. No dotenv, no zod.
 *
 * The demo runs fully offline — reply classification + date extraction are
 * local heuristics (see src/agent/), so no LLM/API key is required to boot.
 */

function bool(name: string, fallback: boolean): boolean {
  const v = process.env[name]
  if (v === undefined) return fallback
  return v === 'true' || v === '1'
}

export const env = {
  PORT: Number(process.env.PORT ?? 8080),
  DATABASE_PATH: process.env.DATABASE_PATH ?? '/data/app.db',

  REQUIRE_PASSWORD: bool('REQUIRE_PASSWORD', false),
  SMS_OUTBOUND_ENABLED: bool('SMS_OUTBOUND_ENABLED', false),

  // Twilio production credentials. All optional — when unset, demo mode
  // accepts webhook calls without signature verification (every request just
  // succeeds with a 200 + log line). At production cutover, set in Railway
  // and signature verification activates automatically.
  TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN ?? '',
  TWILIO_FROM_NUMBER: process.env.TWILIO_FROM_NUMBER ?? '',
  TWILIO_MESSAGING_SERVICE_SID: process.env.TWILIO_MESSAGING_SERVICE_SID ?? '',
  APP_BASE_URL: process.env.APP_BASE_URL ?? '',

  APP_NAME: process.env.APP_NAME ?? 'Kestrel Maintenance Scheduling Agent',
}
