# Canonical Quota Model

> **Version:** 1.0.0
> **Status:** Stable
> **Last Updated:** 2026-02-13

## Overview

The canonical quota model normalizes all provider-specific quota/limit mechanisms into a unified representation. This enables consistent evaluation, alerting, and display across diverse AI coding providers.

## Core Types

### `UsageRecord`

Atomic usage event from any source (API, proxy, log parser).

```typescript
interface UsageRecord {
  // Identity
  id: string;                       // UUID v4
  provider: string;                 // Adapter ID (e.g., "openai")

  // Timing
  timestamp: number;                // Unix timestamp (milliseconds)

  // Source
  source: "api" | "proxy" | "log";

  // Usage metrics (nullable based on provider capability)
  requestCount: number | null;     // Request count
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  cacheReadTokens: number | null;
  cacheCreationTokens: number | null;

  // Cost
  costUsed: number | null;          // USD or local currency

  // Context
  model: string | null;             // Model identifier (e.g., "gpt-4")
  sessionId: string | null;         // For grouping related requests

  // Scope
  scope: ScopeType;

  // Raw data for debugging
  raw: unknown;
}
```

### `QuotaSnapshot`

Evaluated quota state at a point in time (written periodically).

```typescript
interface QuotaSnapshot {
  // Identity
  id: number;                      // Auto-increment primary key
  provider: string;
  quotaRuleId: string;

  // Timing
  timestamp: number;

  // Current usage
  used: number;                     // Current window usage
  limit: number;                     // Quota ceiling
  percentage: number;               // 0.0 to 1.0 (used / limit)

  // Reset behavior
  resetsAt: number | null;          // Next reset timestamp (ms)

  // Prediction
  predictedExhaustAt: number | null;  // When quota will run out

  // Freshness
  freshness: "known" | "unknown" | "stale";
  dataTimestamp: number | null;    // When underlying data was fetched
}
```

### `QuotaRule`

User-defined quota evaluation rule.

```typescript
interface QuotaRule {
  // Identity
  id: string;                       // User-defined unique ID
  provider: string;
  name: string;

  // State
  enabled: boolean;

  // Type
  type:
    | "sliding_window"     // Rolling time window (e.g., 5h requests)
    | "fixed_window"      // Fixed period (e.g., calendar month)
    | "budget"            // Monthly cost budget
    | "balance";          // Credit/balance tracking

  // Limit
  limit: number;                    // Ceiling value
  unit:
    | "requests"          // Request count
    | "tokens"            // Token count
    | "usd"               // USD
    | "credits"           // Provider credits
    | "prompts";         // Prompt/interaction count

  // Time window (for sliding_window and fixed_window)
  window?: {
    size: number;                  // Window size
    sizeUnit: "minutes" | "hours" | "days" | "weeks" | "months";
    resetAnchor?: string;           // Fixed window reset (e.g., "1st 00:00", "monday 00:00")
  };

  // Alert thresholds
  alertThresholds: number[];        // Percentage thresholds (0-1), e.g., [0.7, 0.85, 0.95]
}
```

## Window Semantics

### Sliding Window

Usage counted over the last N minutes/hours/days from NOW.

**Examples:**
- GitHub Copilot: 80 requests per 5 hours (sliding)
- Minimax coding plan: 200 prompts per 5 hours (sliding)

**Calculation:**
```typescript
const windowStart = Date.now() - windowSizeMs;
const used = sumUsageRecords(provider, windowStart, Date.now());
```

### Fixed Window

Usage counted from a fixed anchor point until the next reset.

**Examples:**
- OpenAI monthly budget: resets on 1st of each month
- Kimi monthly budget: resets on 1st of each month

**Calculation:**
```typescript
const windowStart = getLastResetTime(resetAnchor);
const used = sumUsageRecords(provider, windowStart, Date.now());
```

**Reset Anchors:**
- `"1st 00:00"` - First day of month at midnight
- `"monday 00:00"` - Monday at midnight (weekly)
- `"1 00:00"` - 1st day of month at midnight

### Budget

Special case of fixed window with currency unit.

**Examples:**
- OpenAI: $50 USD per calendar month
- Kimi: $30 USD per calendar month

### Balance

Credit-based system with no automatic reset.

**Examples:**
- OpenRouter: Credits balance
- DeepSeek: USD balance
- SiliconFlow: USD balance

**Calculation:**
```typescript
const snapshot = getLatestUsageSnapshot(provider);
const used = snapshot.metrics.creditsUsed ?? 0;
const limit = snapshot.metrics.creditsLimit ?? rule.limit;
const percentage = used / limit;
```

## Scope Types

```typescript
type ScopeType =
  | "personal"      // Individual user account
  | "org"           // Organization/team account
  | "project"        // Cloud project (GCP, etc.)
  | "workspace";     // Workspace-specific (Copilot workspace)

interface ScopeIdentity {
  type: ScopeType;
  id?: string;       // Scope identifier
  name?: string;     // Human-readable name
}
```

**Provider Scope Support:**

| Provider | Personal | Org | Project | Workspace |
|----------|---------|-----|---------|-----------|
| OpenAI | ✅ | ✅ | ❌ | ❌ |
| OpenRouter | ✅ | ✅ | ❌ | ❌ |
| DeepSeek | ✅ | ❌ | ❌ | ❌ |
| GitHub Copilot | ✅ | ✅ | ❌ | ✅ |
| Google Gemini | ✅ | ❌ | ✅ | ❌ |
| Anthropic | ✅ | ❌ | ❌ | ❌ |

## Freshness Semantics

### `FreshnessState`

| State | Meaning | Display Behavior |
|-------|---------|----------------|
| `known` | Data retrieved within TTL | Show normal |
| `unknown` | No data ever retrieved | Show "No data" |
| `stale` | Data older than TTL | Show "Last sync: X ago" warning |

### QuotaSnapshot Freshness

```typescript
interface QuotaSnapshot {
  freshness: "known" | "unknown" | "stale";
  dataTimestamp: number | null;    // When underlying data was fetched
}

// Freshness determination
const isKnown = dataTimestamp && (Date.now() - dataTimestamp) < freshnessTTL;
const freshness = isKnown ? "known" : dataTimestamp ? "stale" : "unknown";
```

**Important:** `stale` data MUST still be displayed (with warning), NOT treated as zero. This prevents false "all clear" signals.

## Prediction Model

### Linear Extrapolation

Simple prediction based on recent usage rate.

```typescript
interface PredictionContext {
  currentUsed: number;
  limit: number;
  recentUsageRecords: UsageRecord[];
  windowMs: number;          // Observation window (default: 2 hours)
}

function predictExhaustion(ctx: PredictionContext): number | null {
  // Calculate usage rate in observation window
  const now = Date.now();
  const since = now - ctx.windowMs;
  const recentRecords = ctx.recentUsageRecords.filter(r => r.timestamp >= since);

  if (recentRecords.length === 0) {
    return null;  // Insufficient data
  }

  // Sum usage in observation window
  const totalUsed = recentRecords.reduce((sum, r) => {
    return sum + (r.totalTokens || r.requestCount || 0);
  }, 0);

  // Calculate rate per hour
  const hoursInWindow = ctx.windowMs / (1000 * 60 * 60);
  const ratePerHour = totalUsed / hoursInWindow;

  if (ratePerHour <= 0) {
    return null;  // Not consuming
  }

  // Predict when remaining will be exhausted
  const remaining = ctx.limit - ctx.currentUsed;
  const hoursUntilExhaust = remaining / ratePerHour;
  const msUntilExhaust = hoursUntilExhaust * 60 * 60 * 1000;

  return now + msUntilExhaust;
}
```

**Caveats:**
- Assumes constant usage rate (may not reflect actual patterns)
- Requires minimum 2 hours of data for reasonable prediction
- Returns `null` if insufficient data or not consuming

**Confidence Level:**
| Observation Window | Confidence | Notes |
|------------------|------------|-------|
| < 1 hour | Low | Insufficient data |
| 1-2 hours | Medium | Basic trend established |
| 2+ hours | High | Stable rate visible |

## Invariants

### Required Fields

All `UsageRecord` instances MUST have:
- `id` (UUID)
- `provider`
- `timestamp`
- `source`
- `scope`
- At least one usage metric (requestCount, tokens, or cost)

All `QuotaSnapshot` instances MUST have:
- `provider`
- `quotaRuleId`
- `timestamp`
- `used` (can be 0)
- `limit` (must be > 0)
- `percentage` (0.0 to 1.0)
- `freshness`

### Idempotency Keys

To prevent duplicate ingestion, `UsageRecord` SHOULD include idempotency key:

```typescript
interface IdempotencyKey {
  provider: string;
  source: "api" | "proxy" | "log";
  requestId?: string;           // From request headers (x-request-id)
  hash?: string;                // Hash of request params + timestamp
  timestamp: number;
}
```

**Format:** `{provider}:{source}:{requestId|hash}:{timestamp}`

**Examples:**
- `openai:api:req_abc123:1707820800000`
- `openrouter:proxy:a1b2c3d4:1707820800000`

## Database Schema Mapping

### Usage Records Table

```sql
CREATE TABLE usage_records (
  id TEXT PRIMARY KEY,           -- UUID v4
  provider TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  source TEXT NOT NULL,          -- "api", "proxy", "log"

  request_count INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  total_tokens INTEGER,
  cache_read_tokens INTEGER,
  cache_creation_tokens INTEGER,

  cost_used REAL,
  model TEXT,
  session_id TEXT,

  scope TEXT NOT NULL,           -- "personal", "org", "project", "workspace"

  raw_data TEXT                  -- JSON of original payload
);

CREATE INDEX idx_usage_provider_ts ON usage_records(provider, timestamp);
```

### Quota Snapshots Table

```sql
CREATE TABLE quota_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  quota_rule_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,

  used REAL NOT NULL,
  limit REAL NOT NULL,
  percentage REAL NOT NULL,

  resets_at INTEGER,
  predicted_exhaust_at INTEGER,

  freshness TEXT NOT NULL,        -- "known", "unknown", "stale"
  data_timestamp INTEGER          -- When underlying data was fetched
);

CREATE INDEX idx_snapshot_rule_ts ON quota_snapshots(quota_rule_id, timestamp);
```

## References

- Window semantics: [Claude Quota Tracker](https://github.com/anthropics/claude-quota-tracker) (5h/7d windows)
- Oracle risk modeling: Stale data must not be treated as zero
- cc-switch: Usage record normalization pattern
- LiteLLM: Budget and quota management concepts
