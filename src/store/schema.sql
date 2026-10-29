CREATE TABLE IF NOT EXISTS source (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  kind TEXT NOT NULL,                                              -- html|pdf|rss
  trust_tier INTEGER NOT NULL CHECK (trust_tier IN (1, 2, 3)),     -- 1 official, 2 reputable aggregator, 3 other
  poll_minutes INTEGER NOT NULL,
  last_etag TEXT,
  last_checked_at TEXT
);

CREATE TABLE IF NOT EXISTS snapshot (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES source(id),
  fetched_at TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  normalized_text TEXT NOT NULL,
  raw_path TEXT,
  http_status INTEGER,
  fixture INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_snapshot_source_time ON snapshot(source_id, fetched_at DESC);

CREATE TABLE IF NOT EXISTS change (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  from_snapshot TEXT,
  to_snapshot TEXT NOT NULL,
  diff_json TEXT NOT NULL,
  material INTEGER NOT NULL,
  material_reasons TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS extraction (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL REFERENCES snapshot(id),
  scheme_id TEXT,
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  pass TEXT NOT NULL,                                             -- deadlines|criteria|documents
  output_json TEXT NOT NULL,
  verified_json TEXT NOT NULL,
  dropped_fields TEXT,
  latency_ms INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scheme_state (
  scheme_id TEXT PRIMARY KEY,
  stage TEXT NOT NULL,                                            -- discovered|eligible|docs_ready|applied|institute_verified|state_verified|disbursed|closed_missed|not_eligible
  eligibility TEXT NOT NULL,                                      -- ELIGIBLE|NOT_ELIGIBLE|UNKNOWN
  eligibility_reasons TEXT,
  deadlines_json TEXT,
  conflicts_json TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alert (
  id TEXT PRIMARY KEY,
  scheme_id TEXT,
  type TEXT NOT NULL,                                             -- reminder|deadline_changed|status_changed|criteria_changed|conflict|doc_issue|discovery
  severity TEXT NOT NULL,
  dedupe_key TEXT NOT NULL UNIQUE,
  source_url TEXT NOT NULL,
  quote TEXT NOT NULL,
  trust_tier INTEGER NOT NULL,
  text_en TEXT NOT NULL,
  text_hi TEXT,
  channel TEXT NOT NULL,
  sent_at TEXT,
  acked_at TEXT
);

CREATE TABLE IF NOT EXISTS document (
  id TEXT PRIMARY KEY,
  doc_type TEXT NOT NULL,
  status TEXT NOT NULL,                                           -- missing|have|expiring|expired|mismatch
  issued_on TEXT,
  valid_until TEXT,
  local_path TEXT,
  check_json TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS run_metric (
  id TEXT PRIMARY KEY,
  workflow_id TEXT,
  kind TEXT NOT NULL,                                             -- watch|extract|notify
  started_at TEXT,
  duration_ms INTEGER,
  llm_calls INTEGER,
  skipped_by_diff INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  cost_inr REAL DEFAULT 0
);

