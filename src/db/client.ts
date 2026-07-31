import Database from 'better-sqlite3'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { env } from '../env.js'

mkdirSync(dirname(env.DATABASE_PATH), { recursive: true })
export const db = new Database(env.DATABASE_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

/**
 * Bump this whenever schema.sql changes shape.
 *
 * The database lives on a Railway volume so it survives redeploys, which means
 * CREATE TABLE IF NOT EXISTS would happily leave an old table in place and the
 * app would fail on a column that does not exist. On a version mismatch we drop
 * everything and rebuild. That is safe here precisely because the seed is
 * deterministic — there is no user data to lose.
 */
const SCHEMA_VERSION = '2'

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

  if (schemaVersionOnDisk() !== SCHEMA_VERSION) {
    dropEverything()
  }
  db.exec(schema)
  db.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)`).run(
    SCHEMA_VERSION,
  )
}

function schemaVersionOnDisk(): string | null {
  try {
    const row = db
      .prepare(`SELECT value FROM meta WHERE key = 'schema_version'`)
      .get() as { value: string } | undefined
    return row?.value ?? null
  } catch {
    // No meta table means either a fresh file or a pre-versioning database.
    // Both want a rebuild.
    return null
  }
}

function dropEverything() {
  const tables = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`)
    .all() as Array<{ name: string }>
  if (tables.length === 0) return
  console.log(
    `[schema] rebuilding for version ${SCHEMA_VERSION} (dropping ${tables.length} tables)`,
  )
  db.pragma('foreign_keys = OFF')
  const tx = db.transaction(() => {
    for (const t of tables) db.exec(`DROP TABLE IF EXISTS "${t.name}"`)
  })
  tx()
  db.pragma('foreign_keys = ON')
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
