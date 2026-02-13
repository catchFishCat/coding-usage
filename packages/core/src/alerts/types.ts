/**
 * Alert System Type Definitions
 *
 * Types for quota evaluation alerts and notifications.
 */

import type { QuotaRule } from '../quota/index.js';

/**
 * Alert levels
 */
export type AlertLevel =
  | 'info'           // Info (70% threshold)
  | 'warning'        // Warning (85% threshold)
  | 'critical';      // Critical (95% threshold)

/**
 * Quota evaluation with provider info
 */
export interface QuotaEvaluation {
  rule: QuotaRule;
  used: number;
  limit: number;
  percentage: number;
  resetsAt: number | null;
  predictedExhaustAt: number | null;
  freshness: 'known' | 'unknown' | 'stale';
  provider: string;
  quotaRuleId: string;
}

/**
 * Alert event
 */
export interface AlertEvent {
  id: string;
  provider: string;
  quotaRuleId: string;
  level: AlertLevel;
  percentage: number;
  message: string;
  predictedExhaustAt: number | null;
  timestamp: number;
  acknowledged: boolean;
  notifiedChannels: string[];
}

/**
 * Alert configuration
 */
export interface AlertConfig {
  enabled: boolean;
  channels: string[];
  infoThreshold: number;
  warningThreshold: number;
  criticalThreshold: number;
  cooldownMs: number;           // Min time between same-level alerts
}

/**
 * Alert manager
 */
export class AlertManager {
  private config: AlertConfig = {
    enabled: true,
    channels: ['console'],
    infoThreshold: 0.7,
    warningThreshold: 0.85,
    criticalThreshold: 0.95,
    cooldownMs: 5 * 60 * 1000, // 5 minutes
  };

  /**
   * Check if alert should be triggered
   */
  shouldAlert(evaluation: QuotaEvaluation): boolean {
    if (!this.config.enabled) {
      return false;
    }

    return evaluation.percentage >= this.config.criticalThreshold ||
           evaluation.percentage >= this.config.warningThreshold ||
           evaluation.percentage >= this.config.infoThreshold;
  }

  /**
   * Get alert level for evaluation
   */
  getAlertLevel(evaluation: QuotaEvaluation): AlertLevel | null {
    if (evaluation.percentage >= this.config.criticalThreshold) {
      return 'critical';
    }
    if (evaluation.percentage >= this.config.warningThreshold) {
      return 'warning';
    }
    if (evaluation.percentage >= this.config.infoThreshold) {
      return 'info';
    }
    return null;
  }

  /**
   * Generate alert message
   */
  generateMessage(evaluation: QuotaEvaluation, level: AlertLevel): string {
    const { provider, quotaRuleId, percentage } = evaluation;

    switch (level) {
      case 'critical':
        return `CRITICAL: ${provider}/${quotaRuleId} at ${(percentage * 100).toFixed(1)}%`;
      case 'warning':
        return `WARNING: ${provider}/${quotaRuleId} at ${(percentage * 100).toFixed(1)}%`;
      case 'info':
        return `INFO: ${provider}/${quotaRuleId} at ${(percentage * 100).toFixed(1)}%`;
      default:
        throw new Error(`Unknown alert level: ${level}`);
    }
  }
}
