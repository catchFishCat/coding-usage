# Provider Adapter Interface Contract

> **Version:** 1.0.0
> **Status:** Stable
> **Last Updated:** 2026-02-13

## Overview

This contract defines the interface that all provider adapters must implement to integrate with the coding-usage monitoring system. It ensures consistent behavior across different AI coding providers.

## Core Interface Types

### `UsageApiAdapter`

For providers with official usage/billing APIs (API Poller strategy).

```typescript
interface UsageApiAdapter {
  // Adapter metadata
  id: string;                      // Unique identifier: "openai", "openrouter", etc.
  name: string;                    // Display name: "OpenAI", "OpenRouter"
  category: "official" | "aggregator" | "third_party" | "custom";
  confidence: "high" | "medium" | "low";  // Data reliability tier

  // Configuration
  requiredConfig: string[];        // Required config keys (e.g., ["apiKey", "orgId"])
  optionalConfig: string[];         // Optional config keys

  // Polling behavior
  defaultPollInterval: number;       // Milliseconds, default 300000 (5 min)
  minPollInterval: number;          // Minimum allowed interval (rate limit guard)

  // Data fetching
  fetchUsage(config: ProviderConfig): Promise<UsageSnapshot>;

  // Scope support
  supportedScopes: ScopeType[];     // "personal", "org", "project", "workspace"

  // Freshness
  freshnessTTL: number;             // How long data is considered fresh (ms)
  supportsRealtime: boolean;        // Can provide near-instant updates
}
```

### `ProxyUsageExtractor`

For providers where we intercept HTTP requests (Local Proxy strategy).

```typescript
interface ProxyUsageExtractor {
  id: string;
  name: string;
  category: "official" | "aggregator" | "third_party" | "custom";

  // Pattern matching
  hostPattern: RegExp;              // Match request host (e.g., /api\.openai\.com/)
  apiFormat: "openai" | "anthropic" | "gemini" | "custom";

  // Extraction
  extractUsage(request: HttpRequest, response: HttpResponse): TokenUsage | null;

  // Streaming support
  supportsStreaming: boolean;
  extractFromStreamChunk(chunk: string): TokenUsage | null;
}
```

### `LogParserAdapter`

For providers where we parse local log files (Log Parser strategy).

```typescript
interface LogParserAdapter {
  id: string;
  name: string;

  // File discovery
  logPaths: string[];               // Platform-specific paths (supports glob)
  watchMode: boolean;                // Use fs.watch for real-time

  // Parsing
  parseLog(content: string): UsageRecord[];

  // Incremental parsing
  supportsCursor: boolean;            // Can resume from last position
  getCursor(content: string): string;  // Get resume position marker
}
```

## Input/Output Contracts

### `ProviderConfig`

```typescript
interface ProviderConfig {
  // Authentication
  apiKey?: string;
  adminKey?: string;               // For admin-level endpoints
  pat?: string;                      // Personal Access Token (GitHub)
  orgId?: string;                   // Organization ID
  projectId?: string;                // Cloud project ID

  // Endpoints (for custom providers)
  baseUrl?: string;
  usageEndpoint?: string;

  // Behavior overrides
  pollInterval?: number;             // Override default polling interval
  enabled?: boolean;

  // Scope (if provider supports multiple)
  scope?: ScopeType;

  // Provider-specific config
  [key: string]: unknown;
}
```

### `UsageSnapshot` (Output)

```typescript
interface UsageSnapshot {
  timestamp: number;                // Unix timestamp (ms)
  provider: string;                  // Adapter ID
  source: "api" | "proxy" | "log"; // Data source

  // Usage metrics (nullable based on provider capability)
  metrics: {
    requestCount?: number;          // Request count in current window
    tokenCount?: number;             // Total tokens
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    cacheCreationTokens?: number;

    balance?: number;                // Remaining balance (currency/credits)
    creditsUsed?: number;
    creditsRemaining?: number;

    costUsed?: number;               // Cost in USD/local currency

    quotaUsed?: number;              // Generic quota usage
    quotaLimit?: number;             // Generic quota ceiling

    resetAt?: number;                // Next reset timestamp (ms)
  };

  // Metadata
  scope: ScopeType;
  model?: string;                    // Model identifier (if applicable)

  // Raw data for debugging
  raw: unknown;                     // Original API response

  // Freshness
  freshness: "known" | "unknown" | "stale";
}
```

## Error Handling

### `AdapterError`

```typescript
interface AdapterError extends Error {
  code:
    | "AUTH_FAILED"           // Invalid credentials
    | "RATE_LIMITED"          // Rate limit hit
    | "ENDPOINT_UNAVAILABLE"   // API down or deprecated
    | "PARSE_ERROR"           // Response format changed
    | "NETWORK_ERROR"          // Connection/timeout error
    | "CONFIG_INVALID"        // Missing or invalid config
    | "SCOPE_UNSUPPORTED";     // Requested scope not available

  provider: string;
  retryable: boolean;            // Can retry with backoff
  providerContext?: {            // Provider-specific context
    statusCode?: number;
    headers?: Record<string, string>;
  };
}
```

### Error Recovery Strategy

| Error Code | Retry Behavior | User Action |
|-----------|----------------|-------------|
| `AUTH_FAILED` | No retry | Check credentials |
| `RATE_LIMITED` | Exponential backoff (max 5 min) | Wait or increase interval |
| `ENDPOINT_UNAVAILABLE` | No retry | Update adapter or check status |
| `PARSE_ERROR` | No retry | Report bug, update parser |
| `NETWORK_ERROR` | Linear backoff (3 attempts) | Check network |
| `CONFIG_INVALID` | No retry | Fix configuration |
| `SCOPE_UNSUPPORTED` | No retry | Change scope or upgrade account |

## Health and Reliability

### `AdapterHealth`

```typescript
interface AdapterHealth {
  provider: string;
  status: "healthy" | "degraded" | "down";

  // Success tracking
  lastSuccessfulSync: number | null;  // Timestamp
  consecutiveFailures: number;         // Current failure streak
  totalFailures: number;             // Lifetime failures

  // Performance
  averageLatency: number;            // Milliseconds
  lastLatency: number;

  // Reliability score (0-1)
  reliabilityScore: number;

  // Confidence
  confidence: "high" | "medium" | "low";
}
```

## Freshness Semantics

### `FreshnessState`

| State | Meaning | Display Behavior |
|-------|---------|----------------|
| `known` | Data retrieved within TTL | Show normal |
| `unknown` | No data ever retrieved | Show "No data" |
| `stale` | Data older than TTL | Show "Last sync: X ago" warning |

### Freshness TTL Defaults

| Adapter Category | Default TTL | Rationale |
|-----------------|--------------|-----------|
| Official with API | 10 minutes | Balance freshness vs rate limits |
| Aggregator | 15 minutes | May have caching layers |
| Proxy | 5 minutes | Real-time interception |
| Log Parser | 1 hour | File-based updates |

## Scope Types

```typescript
type ScopeType =
  | "personal"      // Individual user account
  | "org"           // Organization/team account
  | "project"        // Cloud project (GCP, etc.)
  | "workspace";     // Workspace-specific (Copilot workspace)

interface ScopeIdentity {
  type: ScopeType;
  id?: string;       // Scope identifier (e.g., org ID, project ID)
  name?: string;     // Human-readable name
}
```

## Implementation Requirements

### Required Methods

All adapters MUST implement:

1. **`fetchUsage(config)`** - Retrieve current usage snapshot
2. **`validateConfig(config)`** - Validate configuration before use
3. **`getHealth()`** - Return current health status

### Required Metadata

All adapters MUST provide:

1. Unique `id` (lowercase, alphanumeric, hyphens)
2. Display `name`
3. `category` classification
4. `confidence` tier with rationale
5. `supportedScopes` array
6. `freshnessTTL` value

### Testing Requirements

All adapters MUST include:

1. **Fixture tests** with real API response samples
2. **Error scenarios** (auth failure, rate limit, malformed response)
3. **Edge cases** (zero usage, ceiling hit, empty response)
4. **Scope-specific tests** if multiple scopes supported

## Versioning

Adapter interfaces follow semantic versioning:

- **MAJOR:** Breaking change to interface contract
- **MINOR:** New optional field or method
- **PATCH:** Documentation or clarification update

Current contract version: `1.0.0`

## References

- Inspired by: [LiteLLM provider abstraction](https://docs.litellm.ai/)
- Influenced by: [cc-switch UniversalProvider](https://github.com/jwasham/cc-switch)
- Window semantics: [Claude Quota Tracker](https://github.com/anthropics/claude-quota-tracker)
