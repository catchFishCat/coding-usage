/**
 * Window Semantics Implementation
 *
 * Handles time-based quota window calculations for different window types.
 * Reference: docs/contracts/window-semantics.md
 */

import type { WindowType, TimeWindow } from './types.js';

/**
 * Convert time window to milliseconds
 */
export function windowToMs(window: TimeWindow): number {
  const { size, sizeUnit } = window;

  switch (sizeUnit) {
    case 'minutes':
      return size * 60 * 1000;
    case 'hours':
      return size * 60 * 60 * 1000;
    case 'days':
      return size * 24 * 60 * 60 * 1000;
    case 'weeks':
      return size * 7 * 24 * 60 * 60 * 1000;
    case 'months':
      return size * 30 * 24 * 60 * 60 * 1000;
    default:
      throw new Error(`Unknown time unit: ${sizeUnit}`);
  }
}

/**
 * Get window start time for sliding window
 */
export function getSlidingWindowStart(window: TimeWindow, now: number = Date.now()): number {
  const windowMs = windowToMs(window);
  return now - windowMs;
}

/**
 * Get window start time for fixed window
 */
export function getFixedWindowStart(window: TimeWindow, now: number = Date.now()): number {
  const { resetAnchor } = window;

  if (!resetAnchor) {
    throw new Error('Fixed window requires resetAnchor');
  }

  // Parse reset anchor (e.g., "1st 00:00", "monday 00:00")
  const [dayPart, timePart] = resetAnchor.split(' ');

  // Calculate start of current period
  const current = new Date(now);
  const year = current.getFullYear();
  const month = current.getMonth(); // 0-indexed

  if (dayPart === '1st' || dayPart === '1st') {
    // First day of month
    return new Date(year, month, 1, 0, 0, 0).getTime();
  }

  if (dayPart === 'monday' || dayPart === 'monday') {
    // Most recent Monday
    const day = current.getDate();
    const weekDay = current.getDay(); // 0 = Sunday
    const daysSinceMonday = day - weekDay + (weekDay === 0 ? 7 : 0);
    const monday = new Date(current);
    monday.setDate(current.getDate() - daysSinceMonday);
    monday.setHours(0, 0, 0, 0);
    return monday.getTime();
  }

  throw new Error(`Unsupported reset anchor: ${resetAnchor}`);
}

/**
 * Get next reset time for fixed window
 */
export function getNextResetTime(window: TimeWindow, now: number = Date.now()): number {
  const start = getFixedWindowStart(window, now);
  const windowMs = windowToMs(window);
  return start + windowMs;
}

/**
 * Get window start time based on window type
 */
export function getWindowStart(rule: { type: WindowType; window?: TimeWindow }, now: number = Date.now()): number {
  switch (rule.type) {
    case 'sliding_window':
      if (!rule.window) {
        throw new Error('Sliding window requires window config');
      }
      return getSlidingWindowStart(rule.window, now);

    case 'fixed_window':
    case 'budget':
      if (!rule.window) {
        throw new Error('Fixed window requires window config');
      }
      return getFixedWindowStart(rule.window, now);

    case 'balance':
      // Balance has no time window - returns epoch
      return 0;

    default:
      throw new Error(`Unknown window type: ${rule.type}`);
  }
}

/**
 * Get next reset time based on window type
 */
export function getResetsAt(rule: { type: WindowType; window?: TimeWindow }, now: number = Date.now()): number | null {
  switch (rule.type) {
    case 'sliding_window':
      // Sliding window has no reset
      return null;

    case 'fixed_window':
    case 'budget':
      if (!rule.window) {
        throw new Error('Fixed window requires window config');
      }
      return getNextResetTime(rule.window, now);

    case 'balance':
      // Balance has no reset
      return null;

    default:
      throw new Error(`Unknown window type: ${rule.type}`);
  }
}

/**
 * Check if data is fresh based on TTL
 */
export function isDataFresh(dataTimestamp: number | null, freshnessTTL: number, now: number = Date.now()): FreshnessState {
  if (!dataTimestamp) {
    return 'unknown';
  }

  const age = now - dataTimestamp;
  return age < freshnessTTL ? 'known' : 'stale';
}

/**
 * Calculate confidence level based on data freshness
 */
export function getFreshnessConfidence(
  freshness: FreshnessState,
  dataTimestamp: number | null
): 'high' | 'medium' | 'low' {
  if (freshness === 'known') return 'high';
  if (freshness === 'stale') return 'medium';
  return 'low';
}
