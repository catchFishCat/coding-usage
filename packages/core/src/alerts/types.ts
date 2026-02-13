/**
 * Alert System Type Definitions
 *
 * Types for quota evaluation alerts and notifications.
 */

import type { QuotaEvaluation } from '../quota/index.js';

/**
 * Alert levels
 */
export type AlertLevel =
  | 'info'           // Info (70% threshold)
  | 'warning'        // Warning (85% threshold)
  | 'critical';      // Critical (95% threshold)

/**
 * Alert event
 */
export interface AlertEvent {
  id: string;
  provider: string;
  quotaRuleId: string;

  // Alert details
  level: AlertLevel;
  percentage: number;
  message: string;

  // Prediction
  predictedExhaustAt: number | null;

  // Metadata
  timestamp: number;
  acknowledged: boolean;
  notifiedChannels: string[];    // Channels that have been notified
}

/**
 * Alert channel
 */
export type AlertChannel =
  | 'console'        // Console output
  | 'desktop'       // Desktop notification
  | 'webhook'       // Webhook callback
  | 'email';         // Email notification

/**
 * Alert configuration
 */
export interface AlertConfig {
  enabled: boolean;
  channels: AlertChannel[];

  // Thresholds
  infoThreshold: number;      // Default: 0.7
  warningThreshold: number;   // Default: 0.85
  criticalThreshold: number; // Default: 0.95

  // Cooldown
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
        return `${provider}/${quotaRuleId}: ${(percentage * 100).toFixed(1)}% used`;
    }
  }

  /**
   * Update alert configuration
   */
  updateConfig(updates: Partial<AlertConfig>): void {
    this.config = { ...this.config, ...updates };
  }

  /**
   * Get current configuration
   */
  getConfig(): AlertConfig {
    return { ...this.config };
  }

  /**
   * Export configuration
   */
  toJSON(): object {
    return this.config;
  }
}

/**
 * Export for use in other modules
 */
export { AlertManager, AlertConfig };
