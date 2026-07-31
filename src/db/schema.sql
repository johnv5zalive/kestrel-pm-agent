-- Kestrel Property Management — schema. Idempotent (CREATE TABLE IF NOT EXISTS). Safe on every boot.
-- State enum mirrored from src/agent/state_machine.ts AGENT_STATES.

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  ingest_adapter TEXT NOT NULL DEFAULT 'adapter2a'
    CHECK (ingest_adapter IN ('adapter1', 'adapter2a', 'adapter2b_full', 'adapter2b_degraded')),
  sms_outbound_enabled INTEGER NOT NULL DEFAULT 0,
  demo_clock_iso TEXT NOT NULL DEFAULT '2026-04-30T09:00:00.000Z',
  updated_at_iso TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  primary_phone TEXT,
  primary_email TEXT,
  address_street TEXT,
  address_city TEXT,
  address_state TEXT,
  address_zip TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  primary_phone TEXT,
  primary_email TEXT,
  address_street TEXT,
  address_city TEXT,
  address_state TEXT,
  address_zip TEXT,
  service_zone TEXT,
  business_unit TEXT
);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  role_rank INTEGER NOT NULL DEFAULT 50,
  phone TEXT,
  email TEXT,
  line_type TEXT CHECK (line_type IN ('mobile', 'landline', 'voip') OR line_type IS NULL),
  do_not_text INTEGER NOT NULL DEFAULT 0,
  do_not_email INTEGER NOT NULL DEFAULT 0,
  do_not_call INTEGER NOT NULL DEFAULT 0,
  is_primary INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS equipment (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  item_description TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS recurring_services (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cadence TEXT NOT NULL CHECK (cadence IN ('annual', 'biannual', 'quarterly', 'monthly')),
  job_summary TEXT,
  membership_status TEXT NOT NULL DEFAULT 'Active'
);

CREATE TABLE IF NOT EXISTS recurring_service_events (
  id TEXT PRIMARY KEY,
  recurring_service_id TEXT NOT NULL REFERENCES recurring_services(id) ON DELETE CASCADE,
  due_date TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN (
    'Upcoming',
    'InProgress_EmailT10_Sent',
    'InProgress_EmailT5_Sent',
    'InProgress_SmsT5_Sent',
    'InProgress_VoiceT0_Attempted',
    'AwaitingHuman_DateProposed',
    'AwaitingHuman_AmbiguousReply',
    'AwaitingHuman_Question',
    'Escalated',
    'Closed_Booked',
    'Closed_OptedOut',
    'Closed_BookedOutsideAgent',
    'Skipped_PreSendCheckCancelled'
  )),
  ingested_at_iso TEXT NOT NULL,
  ingested_via_adapter TEXT NOT NULL,
  raw_xlsx_row TEXT,
  appfolio_status TEXT NOT NULL DEFAULT 'Not Attempted',
  booking_availability TEXT NOT NULL DEFAULT 'Not yet scheduled',
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_rse_state ON recurring_service_events(state);
CREATE INDEX IF NOT EXISTS idx_rse_due_date ON recurring_service_events(due_date);

CREATE TABLE IF NOT EXISTS outreach_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rse_id TEXT NOT NULL REFERENCES recurring_service_events(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'voice')),
  contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  recipient TEXT NOT NULL,
  subject TEXT,
  body_text TEXT NOT NULL,
  sent_at_demo_clock TEXT NOT NULL,
  intercepted INTEGER NOT NULL DEFAULT 1,
  twilio_sid_simulated TEXT,
  metadata TEXT
);
CREATE INDEX IF NOT EXISTS idx_outreach_rse ON outreach_attempts(rse_id);

CREATE TABLE IF NOT EXISTS inbound_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rse_id TEXT NOT NULL REFERENCES recurring_service_events(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'voice-keypress')),
  contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
  from_address TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  classification TEXT CHECK (classification IN ('proposed-date', 'question', 'opt-out', 'irrelevant') OR classification IS NULL),
  parsed_date TEXT,
  llm_confidence REAL,
  received_at_demo_clock TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_replies_rse ON inbound_replies(rse_id);

CREATE TABLE IF NOT EXISTS agent_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rse_id TEXT NOT NULL REFERENCES recurring_service_events(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  started_at_demo_clock TEXT NOT NULL,
  finished_at_demo_clock TEXT,
  summary TEXT
);

CREATE TABLE IF NOT EXISTS agent_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER REFERENCES agent_runs(id) ON DELETE SET NULL,
  rse_id TEXT NOT NULL REFERENCES recurring_service_events(id) ON DELETE CASCADE,
  ts_demo_clock TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warn', 'error', 'success')),
  line TEXT NOT NULL,
  meta TEXT
);
CREATE INDEX IF NOT EXISTS idx_logs_rse ON agent_logs(rse_id);
CREATE INDEX IF NOT EXISTS idx_logs_id_rse ON agent_logs(rse_id, id);

CREATE TABLE IF NOT EXISTS state_transitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rse_id TEXT NOT NULL REFERENCES recurring_service_events(id) ON DELETE CASCADE,
  from_state TEXT,
  to_state TEXT NOT NULL,
  reason TEXT,
  at_demo_clock TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_transitions_rse ON state_transitions(rse_id);

-- Ensure the singleton settings row exists.
INSERT OR IGNORE INTO settings (id) VALUES (1);
