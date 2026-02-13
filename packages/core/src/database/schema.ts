/**
 * Database Schema Definitions
 *
 * This file exports SQL DDL statements for all tables in the coding-usage database.
 * Tables are designed to support the canonical quota model with proper indexing and constraints.
 *
 * Reference: docs/contracts/canonical-quota-model.md#database-schema-mapping
 */

/**
 * Providers table - stores registered AI coding provider configurations
 */
export const providersTable = `
CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'custom',      -- 'official', 'aggregator', 'third_party', 'custom'
  enabled BOOLEAN DEFAULT 1,
  config TEXT NOT NULL DEFAULT '{}',   -- JSON: API keys, endpoints, etc.
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

/**
 * Provider endpoints table - stores API endpoint configurations
 */
export const providerEndpointsTable = `
CREATE TABLE IF NOT EXISTS provider_endpoints (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES providers(id),
  endpoint_type TEXT NOT NULL,          -- 'usage', 'balance', 'health'
  url TEXT NOT NULL,
  method TEXT DEFAULT 'GET',
  required_headers TEXT DEFAULT '[]',    -- JSON array of header names
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

/**
 * Quota rules table - user-defined quota evaluation rules
 */
export const quotaRulesTable = `
CREATE TABLE IF NOT EXISTS quota_rules (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES providers(id),
  name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT 1,

  type TEXT NOT NULL,                   -- 'sliding_window', 'fixed_window', 'budget', 'balance'
  "limit" REAL NOT NULL,
  unit TEXT NOT NULL,                   -- 'requests', 'tokens', 'usd', 'credits', 'prompts'

  window_size INTEGER,
  window_unit TEXT,                      -- 'minutes', 'hours', 'days', 'weeks', 'months'
  reset_anchor TEXT,                      -- Fixed window reset (e.g., "1st 00:00", "monday 00:00")

  alert_thresholds TEXT NOT NULL DEFAULT '[0.7, 0.85, 0.95]',  -- JSON array

  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`;

/**
 * Usage records table - atomic usage events from any source
 */
export const usageRecordsTable = `
CREATE TABLE IF NOT EXISTS usage_records (
  id TEXT PRIMARY KEY,                   -- UUID v4
  provider_id TEXT NOT NULL REFERENCES providers(id),
  timestamp INTEGER NOT NULL,
  source TEXT NOT NULL,                   -- "api", "proxy", "log"

  request_count INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  cache_read_tokens INTEGER,
  cache_creation_tokens INTEGER,

  cost_used REAL,

  model TEXT,
  session_id TEXT,

  scope TEXT NOT NULL,                    -- "personal", "org", "project", "workspace"

  raw_data TEXT                         -- JSON of original payload
);
`;

/**
 * Index for usage records provider+timestamp queries
 */
export const usageRecordsIndex = `
CREATE INDEX IF NOT EXISTS idx_usage_provider_ts ON usage_records(provider_id, timestamp);
`;

/**
 * Quota snapshots table - evaluated quota state at points in time
 */
export const quotaSnapshotsTable = `
CREATE TABLE IF NOT EXISTS quota_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id TEXT NOT NULL,
  quota_rule_id TEXT NOT NULL REFERENCES quota_rules(id),
  timestamp INTEGER NOT NULL,

  used REAL NOT NULL,
  "limit" REAL NOT NULL,
  percentage REAL NOT NULL,

  resets_at INTEGER,
  predicted_exhaust_at INTEGER,

  freshness TEXT NOT NULL,                 -- "known", "unknown", "stale"
  data_timestamp INTEGER                   -- When underlying data was fetched
);
`;

/**
 * Index for quota snapshots rule+timestamp queries
 */
export const quotaSnapshotsIndex = `
CREATE INDEX IF NOT EXISTS idx_snapshot_rule_ts ON quota_snapshots(quota_rule_id, timestamp);
`;

/**
 * Alert events table - quota alert notifications
 */
export const alertEventsTable = `
CREATE TABLE IF NOT EXISTS alert_events (
  id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES providers(id),
  quota_rule_id TEXT NOT NULL REFERENCES quota_rules(id),
  level TEXT NOT NULL,                    -- "info", "warning", "critical"
  percentage REAL NOT NULL,
  message TEXT NOT NULL,
  predicted_exhaust_at INTEGER,
  timestamp INTEGER NOT NULL,
  acknowledged BOOLEAN DEFAULT 0,
  notified_channels TEXT DEFAULT '[]'       -- JSON: channels that have been notified
);
`;

/**
 * Index for alert events timestamp queries
 */
export const alertEventsIndex = `
CREATE INDEX IF NOT EXISTS idx_alert_ts ON alert_events(timestamp);
`;

/**
 * Adapter sync state table - tracks adapter polling state
 */
export const adapterSyncStateTable = `
CREATE TABLE IF NOT EXISTS adapter_sync_state (
  provider_id TEXT PRIMARY KEY REFERENCES providers(id),
  last_sync_timestamp INTEGER,
  last_successful_sync INTEGER,
  consecutive_failures INTEGER DEFAULT 0,
  total_syncs INTEGER DEFAULT 0,
  total_failures INTEGER DEFAULT 0,
  updated_at INTEGER NOT NULL
);
`;

/**
 * Provider health table - tracks adapter reliability metrics
 */
export const providerHealthTable = `
CREATE TABLE IF NOT EXISTS provider_health (
  provider_id TEXT PRIMARY KEY REFERENCES providers(id),
  status TEXT NOT NULL DEFAULT 'unknown',    -- "healthy", "degraded", "down"
  reliability_score REAL DEFAULT 0.5,         -- 0.0 to 1.0
  average_latency INTEGER,                      -- milliseconds
  confidence TEXT NOT NULL DEFAULT 'unknown',   -- "high", "medium", "low"
  last_successful_sync INTEGER,
  updated_at INTEGER NOT NULL
);
`;

/**
 * Model pricing table - stores per-model pricing information
 */
export const modelPricingTable = `
CREATE TABLE IF NOT EXISTS model_pricing (
  model_id TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES providers(id),
  display_name TEXT NOT NULL,
  input_cost_per_million REAL NOT NULL DEFAULT 0,
  output_cost_per_million REAL NOT NULL DEFAULT 0,
  cache_read_cost_per_million REAL DEFAULT 0,
  cache_creation_cost_per_million REAL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
`;

/**
 * Daily summaries table - aggregated daily statistics (immutable)
 */
export const dailySummariesTable = `
CREATE TABLE IF NOT EXISTS daily_summaries (
  date TEXT NOT NULL,                      -- YYYY-MM-DD
  provider_id TEXT NOT NULL REFERENCES providers(id),
  total_requests INTEGER DEFAULT 0,
  total_input_tokens INTEGER DEFAULT 0,
  total_output_tokens INTEGER DEFAULT 0,
  total_cost_usd REAL DEFAULT 0,
  models_used TEXT DEFAULT '[]',             -- JSON: list of model IDs used
  PRIMARY KEY (date, provider_id)
);
`;

/**
 * Reconciliation runs table - tracks data reconciliation operations
 */
export const reconciliationRunsTable = `
CREATE TABLE IF NOT EXISTS reconciliation_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id TEXT NOT NULL REFERENCES providers(id),
  run_timestamp INTEGER NOT NULL,
  records_compared INTEGER DEFAULT 0,
  discrepancies_found INTEGER DEFAULT 0,
  drift_threshold REAL,
  status TEXT NOT NULL,                  -- "success", "failure", "partial"
  details TEXT,                            -- JSON: additional run details
  created_at INTEGER NOT NULL
);
`;

/**
 * Schema version tracking table
 */
export const schemaVersionTable = `
CREATE TABLE IF NOT EXISTS schema_version (
  version TEXT NOT NULL PRIMARY KEY,        -- Semver format (e.g., "1.0.0")
  applied_at INTEGER NOT NULL,
  description TEXT
);
`;

/**
 * All tables in creation order (respecting dependencies)
 */
export const allTables = [
  schemaVersionTable,
  providersTable,
  providerEndpointsTable,
  quotaRulesTable,
  usageRecordsTable,
  quotaSnapshotsTable,
  alertEventsTable,
  adapterSyncStateTable,
  providerHealthTable,
  modelPricingTable,
  dailySummariesTable,
  reconciliationRunsTable,
] as const;

/**
 * All indexes in creation order
 */
export const allIndexes = [
  usageRecordsIndex,
  quotaSnapshotsIndex,
  alertEventsIndex,
] as const;

/**
 * Complete schema (tables + indexes)
 */
export const fullSchema = [...allTables, ...allIndexes].join("\n");
