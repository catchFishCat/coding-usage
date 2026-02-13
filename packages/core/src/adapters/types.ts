/**
 * Provider Adapter Type Definitions
 *
 * Core interfaces for implementing AI coding provider adapters.
 * Reference: docs/contracts/provider-adapter-interface.md
 */

import type { ScopeType, UsageRecord, UsageSnapshot } from '../quota/index.js';

/**
 * Adapter categories
 */
export type AdapterCategory =
  | 'official'         // Official API provider
  | 'aggregator'      // Multi-provider aggregator
  | 'third_party'     // Third-party integration
  | 'custom';         // Custom implementation

/**
 * Confidence tiers for data reliability
 */
export type ConfidenceTier =
  | 'high'            // Official API with real-time data
  | 'medium'          // Aggregator with possible caching
  | 'low';            // Third-party or custom implementation

/**
 * Adapter health status
 */
export type AdapterHealthStatus =
  | 'healthy'         // All systems operational
  | 'degraded'        // Partial functionality
  | 'down';           // Service unavailable

/**
 * Adapter error codes
 */
export type AdapterErrorCode =
  | 'AUTH_FAILED'          // Invalid credentials
  | 'RATE_LIMITED'         // Rate limit exceeded
  | 'ENDPOINT_UNAVAILABLE' // API down or deprecated
  | 'PARSE_ERROR'         // Response format changed
  | 'NETWORK_ERROR'        // Connection/timeout error
  | 'CONFIG_INVALID'        // Missing/invalid config
  | 'SCOPE_UNSUPPORTED';    // Requested scope not available

/**
 * Provider configuration
 */
export interface ProviderConfig {
  // Authentication
  apiKey?: string;
  adminKey?: string;              // For admin-level endpoints
  pat?: string;                    // Personal Access Token (GitHub)
  orgId?: string;                 // Organization ID
  projectId?: string;              // Cloud project ID

  // Endpoints (for custom providers)
  baseUrl?: string;
  usageEndpoint?: string;

  // Behavior overrides
  pollInterval?: number;            // Override default polling interval
  enabled?: boolean;

  // Scope (if provider supports multiple)
  scope?: ScopeType;

  // Provider-specific config
  [key: string]: unknown;
}

/**
 * Adapter metadata
 */
export interface AdapterMetadata {
  // Identity
  id: string;                     // Unique identifier: "openai", "openrouter"
  name: string;                   // Display name: "OpenAI", "OpenRouter"
  category: AdapterCategory;

  // Data reliability
  confidence: ConfidenceTier;

  // Configuration
  requiredConfig: string[];        // Required config keys
  optionalConfig: string[];

  // Polling behavior (API Poller strategy)
  defaultPollInterval: number;       // Milliseconds
  minPollInterval: number;          // Rate limit guard

  // Scope support
  supportedScopes: ScopeType[];

  // Freshness
  freshnessTTL: number;             // How long data is fresh (ms)
  supportsRealtime: boolean;        // Near-instant updates
}

/**
 * Adapter error
 */
export interface AdapterError extends Error {
  code: AdapterErrorCode;
  provider: string;
  retryable: boolean;              // Can retry with backoff
  providerContext?: {               // Provider-specific context
    statusCode?: number;
    headers?: Record<string, string>;
  };
}

/**
 * Adapter health metrics
 */
export interface AdapterHealth {
  provider: string;
  status: AdapterHealthStatus;

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
  confidence: ConfidenceTier;
}

/**
 * Usage API Adapter
 *
 * For providers with official usage/billing APIs (API Poller strategy)
 */
export interface UsageApiAdapter {
  // Adapter metadata
  id: string;
  name: string;
  category: AdapterCategory;
  confidence: ConfidenceTier;

  // Configuration
  requiredConfig: string[];
  optionalConfig: string[];

  // Polling behavior
  defaultPollInterval: number;
  minPollInterval: number;

  // Data fetching
  fetchUsage(config: ProviderConfig): Promise<UsageSnapshot>;

  // Scope support
  supportedScopes: ScopeType[];

  // Freshness
  freshnessTTL: number;
  supportsRealtime: boolean;
}

/**
 * Proxy Usage Extractor
 *
 * For providers where we intercept HTTP requests (Local Proxy strategy)
 */
export interface ProxyUsageExtractor {
  id: string;
  name: string;
  category: AdapterCategory;

  // Pattern matching
  hostPattern: RegExp;              // Match request host
  apiFormat: 'openai' | 'anthropic' | 'gemini' | 'custom';

  // Extraction
  extractUsage(request: HttpRequest, response: HttpResponse): TokenUsage | null;

  // Streaming support
  supportsStreaming: boolean;
  extractFromStreamChunk(chunk: string): TokenUsage | null;
}

/**
 * Log Parser Adapter
 *
 * For providers where we parse local log files (Log Parser strategy)
 */
export interface LogParserAdapter {
  id: string;
  name: string;

  // File discovery
  logPaths: string[];               // Platform-specific paths
  watchMode: boolean;                // Use fs.watch

  // Parsing
  parseLog(content: string): UsageRecord[];

  // Incremental parsing
  supportsCursor: boolean;            // Can resume from last position
  getCursor(content: string): string;   // Resume position marker
}

/**
 * Token usage from HTTP response
 */
export interface TokenUsage {
  requestCount?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  costUsd?: number;
}
