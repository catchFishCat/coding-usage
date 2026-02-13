/**
 * Quota Engine Type Definitions
 *
 * Core types for quota evaluation, window semantics, and time-based limits.
 * Reference: docs/contracts/canonical-quota-model.md
 */

/**
 * Time window types
 */
export type WindowType =
  | 'sliding_window'    // Rolling time window (e.g., last 5 hours)
  | 'fixed_window'      // Fixed period (e.g., calendar month)
  | 'budget'           // Monthly cost budget
  | 'balance';         // Credit/balance tracking

/**
 * Quota units
 */
export type QuotaUnit =
  | 'requests'          // Request count
  | 'tokens'            // Token count
  | 'usd'               // USD currency
  | 'credits'           // Provider credits
  | 'prompts';          // Prompt/interaction count

/**
 * Scope types
 */
export type ScopeType =
  | 'personal'      // Individual user account
  | 'org'           // Organization/team account
  | 'project'       // Cloud project (GCP, etc.)
  | 'workspace';     // Workspace-specific (Copilot workspace)

/**
 * Freshness states
 */
export type FreshnessState =
  | 'known'      // Data retrieved within TTL
  | 'unknown'    // No data ever retrieved
  | 'stale';      // Data older than TTL

/**
 * Time window configuration
 */
export interface TimeWindow {
  size: number;                  // Window size
  sizeUnit: 'minutes' | 'hours' | 'days' | 'weeks' | 'months';
  resetAnchor?: string;           // Fixed window reset (e.g., "1st 00:00", "monday 00:00")
}

/**
 * Quota rule definition
 */
export interface QuotaRule {
  // Identity
  id: string;
  provider: string;
  name: string;

  // State
  enabled: boolean;

  // Type
  type: WindowType;

  // Limit
  limit: number;
  unit: QuotaUnit;

  // Time window (for sliding_window and fixed_window)
  window?: TimeWindow;

  // Alert thresholds (0-1 percentages)
  alertThresholds: number[];
}

/**
 * Quota snapshot at a point in time
 */
export interface QuotaSnapshot {
  id?: number;                      // Auto-increment primary key
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
  freshness: FreshnessState;
  dataTimestamp: number | null;    // When underlying data was fetched
}

/**
 * Usage record for calculation
 */
export interface UsageRecord {
  id: string;
  provider: string;
  timestamp: number;

  // Usage metrics
  requestCount?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;

  // Cost
  costUsd?: number;

  // Context
  model?: string;
  sessionId?: string;

  // Scope
  scope: ScopeType;

  // Raw data
  raw?: unknown;
}

/**
 * Prediction context
 */
export interface PredictionContext {
  currentUsed: number;
  limit: number;
  recentUsageRecords: UsageRecord[];
  windowMs: number;          // Observation window (default: 2 hours)
}

/**
 * Quota evaluation result
 */
export interface QuotaEvaluation {
  rule: QuotaRule;
  used: number;
  limit: number;
  percentage: number;
  resetsAt: number | null;
  predictedExhaustAt: number | null;
  freshness: FreshnessState;
}
