/**
 * Quota Engine Implementation
 *
 * Evaluates quota rules against usage records to determine current state.
 * Reference: docs/contracts/canonical-quota-model.md
 */

import type {
  QuotaRule,
  QuotaSnapshot,
  UsageRecord,
  QuotaEvaluation,
  WindowType,
  FreshnessState,
} from './types.js';
import {
  getWindowStart,
  getResetsAt,
  windowToMs,
  isDataFresh,
  getFreshnessConfidence,
} from './window.js';

/**
 * Default freshness TTL (10 minutes)
 */
const DEFAULT_FRESHNESS_TTL = 10 * 60 * 1000; // 10 minutes in ms

/**
 * Default observation window for prediction (2 hours)
 */
const DEFAULT_PREDIION_WINDOW = 2 * 60 * 60 * 1000; // 2 hours in ms

/**
 * Quota Engine class
 */
export class QuotaEngine {
  private rules: Map<string, QuotaRule> = new Map();

  /**
   * Add or update a quota rule
   */
  addRule(rule: QuotaRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Remove a quota rule
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  /**
   * Get a quota rule
   */
  getRule(ruleId: string): QuotaRule | undefined {
    return this.rules.get(ruleId);
  }

  /**
   * Get all quota rules
   */
  getAllRules(): QuotaRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get enabled rules
   */
  getEnabledRules(): QuotaRule[] {
    return this.getAllRules().filter((r) => r.enabled);
  }

  /**
   * Evaluate quota for a specific rule
   */
  evaluate(
    rule: QuotaRule,
    currentUsage: number,
    dataTimestamp: number | null,
    now: number = Date.now()
  ): QuotaEvaluation {
    // Calculate percentage
    const percentage = Math.min(1, Math.max(0, currentUsage / rule.limit));

    // Get reset time
    const resetsAt = getResetsAt(rule, now);

    // Determine freshness
    const freshness = isDataFresh(dataTimestamp, DEFAULT_FRESHNESS_TTL, now);

    // Predict exhaustion
    const predictedExhaustAt = this.predictExhaustion(rule, currentUsage);

    return {
      rule,
      used: currentUsage,
      limit: rule.limit,
      percentage,
      resetsAt,
      predictedExhaustAt,
      freshness,
    };
  }

  /**
   * Predict when quota will be exhausted
   */
  private predictExhaustion(rule: QuotaRule, currentUsed: number): number | null {
    // Simple linear prediction based on recent usage rate
    // This is a simplified version - real implementation would use recent usage records

    const remaining = rule.limit - currentUsed;
    if (remaining <= 0) {
      return Date.now(); // Already exhausted
    }

    // Default prediction: 30 days from now if no specific data
    // Real implementation would analyze recent UsageRecords to calculate rate
    return Date.now() + 30 * 24 * 60 * 60 * 1000;
  }
}

/**
 * Export for use in other modules
 */
export { QuotaEngine, DEFAULT_FRESHNESS_TTL, DEFAULT_PREDICTION_WINDOW };
