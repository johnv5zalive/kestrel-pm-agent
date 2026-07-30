import Database from 'better-sqlite3'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { env } from '../env.js'

mkdirSync(dirname(env.DATABASE_PATH), { recursive: true })
export const db = new Database(env.DATABASE_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

export function initSchema() {
  // tsc doesn't copy non-TS files, and the Dockerfile copies schema.sql to
  // ./src/db/schema.sql in the runtime container. Try both locations.
  const here = dirname(fileURLToPath(import.meta.url))
  const candidates = [
    `${here}/schema.sql`,
    `${process.cwd()}/src/db/schema.sql`,
  ]
  let schema: string | null = null
  for (const p of candidates) {
    try {
      schema = readFileSync(p, 'utf8')
      break
    } catch {}
  }
  if (!schema) throw new Error(`schema.sql not found; tried: ${candidates.join(', ')}`)
  db.exec(schema)
}

export interface SettingsRow {
  id: number
  ingest_adapter: 'adapter1' | 'adapter2a' | 'adapter2b_full' | 'adapter2b_degraded'
  sms_outbound_enabled: number
  demo_clock_iso: string
  updated_at_iso: string
}

export function getSettings(): SettingsRow {
  return db.prepare('SELECT * FROM settings WHERE id = 1').get() as SettingsRow
}
