-- Kestrel Property Management — schema. Idempotent (CREATE TABLE IF NOT EXISTS).
--
-- The agent runs three tracks, and they share one conversation substrate:
--
--   visit      — a scheduled maintenance visit that needs a date agreed
--   approval   — a repair over the owner's spend limit that needs a yes
--   compliance — a vendor certificate that is about to expire
--
-- outreach_attempts / inbound_replies / agent_logs / state_transitions are
-- therefore polymorphic: (subject_type, subject_id) rather than a foreign key
-- to one table. SQLite cannot express a polymorphic FK, so referential
-- integrity for those four is enforced in application code, not the schema.
--
-- Schema changes are handled by bumping SCHEMA_VERSION in client.ts, which
-- drops and rebuilds. The seed is deterministic, so nothing of value is lost.

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  ingest_adapter TEXT NOT NULL DEFAULT 'adapter2a'
    CHECK (ingest_adapter IN ('adapter1', 'adapter2a', 'adapter2b_full', 'adapter2b_degraded')),
  sms_outbound_enabled INTEGER NOT NULL DEFAULT 0,
  demo_clock_iso TEXT NOT NULL DEFAULT '2026-04-30T09:00:00.000Z',
  updated_at_iso TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

-- ===== Property owners =====
-- The people who actually say yes to spending money. Every one of them has a
-- different spend limit and a different preferred channel, which is exactly
-- why chasing them by hand does not scale.

CREATE TABLE IF NOT EXISTS owners (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT,
  email TEXT,
  phone TEXT,
  line_type TEXT CHECK (line_type IN ('mobile', 'landline', 'voip') OR line_type IS NULL),
  -- Repairs at or under this figure are pre-authorised and never chased.
  approval_limit_usd INTEGER NOT NULL DEFAULT 300,
  preferred_channel TEXT NOT NULL DEFAULT 'email'
    CHECK (preferred_channel IN ('email', 'sms', 'voice')),
  -- Working days this owner has historically taken to answer. Drives the
  -- "this one will be slow" hint in the queue.
  typical_response_days REAL,
  notes TEXT
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
  owner_id TEXT REFERENCES owners(id) ON DELETE SET NULL,
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

-- ===== Track 1: scheduled maintenance visits =====

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
  state TEXT NOT NULL,
  ingested_at_iso TEXT NOT NULL,
  ingested_via_adapter TEXT NOT NULL,
  raw_xlsx_row TEXT,
  appfolio_status TEXT NOT NULL DEFAULT 'Not contacted yet',
  booking_availability TEXT NOT NULL DEFAULT 'Not yet scheduled',
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_rse_state ON recurring_service_events(state);
CREATE INDEX IF NOT EXISTS idx_rse_due_date ON recurring_service_events(due_date);

-- ===== Track 2: owner approvals =====
-- A repair has been quoted and it is over the owner's limit. Nothing happens
-- until they say yes, the tenant is usually already waiting, and the tenant
-- blames the property manager rather than the owner.

CREATE TABLE IF NOT EXISTS approval_requests (
  id TEXT PRIMARY KEY,
  location_id TEXT NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  owner_id TEXT NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  vendor_id TEXT,
  -- One line a person would actually say: "Water heater failed, unit 4B".
  summary TEXT NOT NULL,
  detail TEXT,
  trade TEXT,
  quote_usd INTEGER NOT NULL,
  -- What the resident is living with while this waits.
  tenant_impact TEXT,
  urgency TEXT NOT NULL DEFAULT 'routine'
    CHECK (urgency IN ('routine', 'urgent', 'emergency')),
  -- Statutory clock, where one applies. Null when nothing is ticking.
  respond_by_iso TEXT,
  statute_note TEXT,
  raised_at_iso TEXT NOT NULL,
  state TEXT NOT NULL,
  decided_at_iso TEXT,
  approved_amount_usd INTEGER,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_approval_state ON approval_requests(state);
CREATE INDEX IF NOT EXISTS idx_approval_owner ON approval_requests(owner_id);

-- ===== Track 3: vendor compliance =====
-- Certificates of insurance expire quietly. Sending an uninsured vendor to a
-- property is the kind of mistake that ends a management agreement.

CREATE TABLE IF NOT EXISTS vendors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  trade TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  line_type TEXT CHECK (line_type IN ('mobile', 'landline', 'voip') OR line_type IS NULL),
  active INTEGER NOT NULL DEFAULT 1,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS vendor_documents (
  id TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  doc_type TEXT NOT NULL
    CHECK (doc_type IN ('general_liability', 'workers_comp', 'auto', 'license')),
  carrier TEXT,
  policy_number TEXT,
  coverage_usd INTEGER,
  expires_on TEXT NOT NULL,
  state TEXT NOT NULL,
  received_at_iso TEXT,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_vendordoc_state ON vendor_documents(state);
CREATE INDEX IF NOT EXISTS idx_vendordoc_expiry ON vendor_documents(expires_on);

-- ===== Shared conversation substrate =====
-- subject_type is one of 'visit' | 'approval' | 'compliance'.
-- subject_id points at recurring_service_events.id, approval_requests.id or
-- vendor_documents.id respectively.

CREATE TABLE IF NOT EXISTS outreach_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('visit', 'approval', 'compliance')),
  subject_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'voice')),
  contact_id TEXT,
  recipient TEXT NOT NULL,
  subject TEXT,
  body_text TEXT NOT NULL,
  sent_at_demo_clock TEXT NOT NULL,
  intercepted INTEGER NOT NULL DEFAULT 1,
  twilio_sid_simulated TEXT,
  metadata TEXT
);
CREATE INDEX IF NOT EXISTS idx_outreach_subject ON outreach_attempts(subject_type, subject_id);

CREATE TABLE IF NOT EXISTS inbound_replies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('visit', 'approval', 'compliance')),
  subject_id TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'voice-keypress')),
  contact_id TEXT,
  from_address TEXT NOT NULL,
  raw_text TEXT NOT NULL,
  -- Union of every track's classifications. Which values are legal depends on
  -- subject_type, and that is enforced in the classifier, not here.
  classification TEXT,
  parsed_date TEXT,
  -- Approvals only: the figure the owner actually agreed to, which is not
  -- always the figure they were quoted.
  parsed_amount_usd INTEGER,
  llm_confidence REAL,
  received_at_demo_clock TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_replies_subject ON inbound_replies(subject_type, subject_id);

CREATE TABLE IF NOT EXISTS agent_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('visit', 'approval', 'compliance')),
  subject_id TEXT NOT NULL,
  ts_demo_clock TEXT NOT NULL,
  level TEXT NOT NULL DEFAULT 'info' CHECK (level IN ('info', 'warn', 'error', 'success')),
  line TEXT NOT NULL,
  meta TEXT
);
CREATE INDEX IF NOT EXISTS idx_logs_subject ON agent_logs(subject_type, subject_id);
CREATE INDEX IF NOT EXISTS idx_logs_subject_id ON agent_logs(subject_type, subject_id, id);

CREATE TABLE IF NOT EXISTS state_transitions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('visit', 'approval', 'compliance')),
  subject_id TEXT NOT NULL,
  from_state TEXT,
  to_state TEXT NOT NULL,
  reason TEXT,
  at_demo_clock TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_transitions_subject ON state_transitions(subject_type, subject_id);

-- Ensure the singleton settings row exists.
INSERT OR IGNORE INTO settings (id) VALUES (1);
