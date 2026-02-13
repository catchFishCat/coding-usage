# Window Semantics

> **Version:** 1.0.0
> **Status:** Stable
> **Last Updated:** 2026-02-13

## Overview

Window semantics define how time-based quota limits are calculated and reset. Different providers use different window types (sliding, fixed, budget, balance), and this document specifies the exact behavior for each.

## Window Types

### 1. Sliding Window (Rolling Window)

Usage is counted over the last N units of time from the current moment.

**Definition:** A time window that "slides" forward as time progresses.

**Formula:**
```
used = sum(all records where timestamp >= (now - window_size))
```

**Characteristics:**
- Window end is always NOW
- Window start moves forward continuously
- No discrete reset events
- Usage naturally ages out of the window

**Examples:**

| Provider | Window | Unit | Limit |
|----------|--------|------|-------|
| GitHub Copilot | 5 | hours | 80 requests |
| Minimax Coding Plan | 5 | hours | 200 prompts |
| Anthropic (Claude) | 5 | hours | token limit |

**Visualization:**

```
Time:    |----|----|----|----|----|---->
            ↑                        ↑
         window_start              now
         (now - 5h)

Records counted: ████░░░░░░░░░░
            (only records in the last 5 hours)
```

**Edge Cases:**

1. **DST Boundary:** Window calculation must use UTC timestamps to avoid daylight saving time issues
2. **Clock Changes:** Handle system time changes gracefully (use monotonic clock if available)
3. **Empty Window:** If no records in window, `used = 0`

**Implementation:**

```typescript
function calculateSlidingWindow(
  records: UsageRecord[],
  windowSize: number,
  windowUnit: 'minutes' | 'hours' | 'days'
): number {
  const windowMs = windowSize * unitToMs(windowUnit);
  const cutoff = Date.now() - windowMs;

  return records
    .filter(r => r.timestamp >= cutoff)
    .reduce((sum, r) => sum + (r.requestCount || r.totalTokens || 0), 0);
}
```

### 2. Fixed Window

Usage is counted from a fixed anchor point until the next discrete reset.

**Definition:** A time window with fixed start and end times, resets on a schedule.

**Formula:**
```
window_start = last_reset_time
window_end = next_reset_time
used = sum(all records where timestamp >= window_start AND timestamp < window_end)
```

**Characteristics:**
- Discrete reset events (e.g., 1st of month, Monday 00:00)
- Window boundaries are predictable
- Usage resets to 0 at each reset
- May have proration at window start

**Reset Anchors:**

| Anchor | Description | Example |
|--------|-------------|---------|
| `"1st 00:00"` | First day of month at midnight | Monthly budget |
| `"monday 00:00"` | Monday at midnight | Weekly quota |
| `"1 00:00"` | 1st day of month at midnight | Same as "1st 00:00" |
| `"daily 00:00"` | Every day at midnight | Daily limit |

**Examples:**

| Provider | Reset | Unit | Limit |
|----------|-------|------|-------|
| OpenAI (monthly) | 1st 00:00 | months | $50 USD |
| Kimi (monthly) | 1st 00:00 | months | $30 USD |
| Daily limit | daily 00:00 | days | 1000 requests |

**Visualization:**

```
Time:  |----Jan----|----Feb----|----Mar----|
        ░░░░░░░░░░░████████████████████████
        ↑          ↑           ↑           ↑
    Jan 1   Feb 1 (reset) Mar 1 (reset)

Records counted in Feb: ████ (all Feb records, Jan records excluded)
```

**Reset Calculation:**

```typescript
function getNextResetTime(resetAnchor: string): number {
  const now = new Date();
  let nextReset: Date;

  if (resetAnchor === '1st 00:00' || resetAnchor === '1 00:00') {
    // First day of next month at midnight
    nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0);
  } else if (resetAnchor === 'monday 00:00') {
    // Next Monday at midnight
    const daysUntilMonday = (7 - now.getDay() + 1) % 7 || 7;
    nextReset = new Date(now);
    nextReset.setDate(now.getDate() + daysUntilMonday);
    nextReset.setHours(0, 0, 0, 0);
  } else if (resetAnchor === 'daily 00:00') {
    // Tomorrow at midnight
    nextReset = new Date(now);
    nextReset.setDate(now.getDate() + 1);
    nextReset.setHours(0, 0, 0, 0);
  }

  return nextReset.getTime();
}

function getLastResetTime(resetAnchor: string): number {
  // Inverse of getNextResetTime - calculate previous reset
  // Implementation similar to above but subtracting instead of adding
}
```

**Edge Cases:**

1. **First Run:** If no history, assume current window started at last reset
2. **Timezone:** All calculations MUST use UTC to avoid DST issues
3. **Missing Records:** If records from window start are missing, mark as `stale`

### 3. Budget

Special case of fixed window with currency unit (USD).

**Definition:** Fixed window (usually monthly) tracking monetary spend.

**Same as:** Fixed Window with `unit: "usd"`

**Examples:**

| Provider | Reset | Limit |
|----------|-------|-------|
| OpenAI | 1st 00:00 | $50/month |
| Kimi | 1st 00:00 | $30/month |

**Calculation:** Sum `costUsed` field from usage records in current window.

### 4. Balance

Credit-based system with no automatic reset.

**Definition:** Track remaining credits/balance, decrement on usage.

**Characteristics:**
- No automatic reset
- Balance decrements on each usage event
- May refill via top-up or subscription renewal
- Current balance fetched from provider API

**Calculation:**

```typescript
async function calculateBalance(
  provider: string,
  rule: QuotaRule
): Promise<{used: number, limit: number, percentage: number}> {
  // Fetch latest balance from provider
  const snapshot = await adapter.fetchUsage(config);

  const balance = snapshot.metrics.creditsRemaining ?? 0;
  const limit = snapshot.metrics.creditsLimit ?? rule.limit;
  const used = limit - balance;
  const percentage = used / limit;

  return { used, limit, percentage };
}
```

**Examples:**

| Provider | Limit | Unit |
|----------|-------|------|
| OpenRouter | 100 | credits |
| DeepSeek | $50 | USD |
| SiliconFlow | $20 | USD |

**Edge Cases:**

1. **Unknown Balance:** If provider API unavailable, mark as `unknown` (NOT zero)
2. **Top-up:** Handle balance increases (refill) as adjustment events
3. **Over-limit:** Allow percentage > 1.0 if provider allows overages

## Unit Types

```typescript
type QuotaUnit =
  | "requests"      // Request count
  | "tokens"        // Token count (input + output)
  | "usd"           // US Dollars (budget)
  | "credits"        // Provider credits
  | "prompts";      // Prompt/interaction count
```

### Unit Conversion Table

| Unit | Aggregation Field | Source |
|------|-------------------|--------|
| `requests` | `requestCount` | API response, proxy header |
| `tokens` | `totalTokens` | API response, proxy usage |
| `usd` | `costUsed` | Calculated from model pricing |
| `credits` | `creditsRemaining` | Provider API |
| `prompts` | `requestCount` | Specialized for certain providers |

## Comparison Table

| Window Type | Resets | Aging | Predictability | Complexity |
|-------------|--------|-------|---------------|------------|
| Sliding | No | Yes (continuous) | Low | Medium |
| Fixed | Yes (discrete) | No (at reset) | High | Low |
| Budget | Yes (discrete) | No (at reset) | High | Low |
| Balance | Manual | No | Low | Low |

## Invariants

### Timezone Handling

**ALL window calculations MUST use UTC timestamps.**

```typescript
// ✅ Correct: Use UTC
const timestamp = Date.now();  // Always UTC
const date = new Date(timestamp);  // JS Date uses UTC internally

// ❌ Wrong: Use local time
const localTimestamp = date.getTime();  // Already UTC, don't convert back
```

**Rationale:** Daylight saving time changes can create 23 or 25 hour days, breaking window calculations.

### Idempotency

Window calculation MUST be idempotent for the same input state.

```typescript
// Given the same records and rule, result must be identical
const result1 = calculateWindow(records, rule, timestamp);
const result2 = calculateWindow(records, rule, timestamp);
assert(result1 === result2);
```

### Monotonicity

For sliding windows, `used` must be monotonically non-decreasing as time progresses.

```typescript
// As time moves forward, usage in sliding window cannot decrease
const used1 = calculateSlidingWindow(records, t1);
const used2 = calculateSlidingWindow(records, t2);
assert(t2 > t1 ? used2 >= used1 : true);
```

**Exception:** When records naturally age out (move outside window), `used` can decrease. This is correct behavior.

## Reset Calculation Examples

### Monthly Reset (1st of month)

```typescript
// Input: 2026-02-13 15:30 UTC
// Output: 2026-03-01 00:00 UTC

function getNextMonthlyReset(): number {
  const now = new Date(Date.UTC(2026, 1, 13, 15, 30, 0));  // Feb 13, 2026
  const nextReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));
  return nextReset.getTime();  // Mar 1, 2026 00:00:00 UTC
}
```

### Weekly Reset (Monday)

```typescript
// Input: 2026-02-13 (Thursday)
// Output: 2026-02-17 (Monday)

function getNextWeeklyReset(): number {
  const now = new Date(Date.UTC(2026, 1, 13));  // Feb 13, 2026 (Thu)
  const daysUntilMonday = (7 - now.getUTCDay() + 1) % 7 || 7;  // 4 days
  const nextReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilMonday, 0, 0, 0));
  return nextReset.getTime();  // Feb 17, 2026 00:00:00 UTC
}
```

## Testing Requirements

All window implementations MUST include:

1. **DST Boundary Test:** Verify window calculation across DST transitions
2. **Leap Year Test:** Verify Feb 29 calculation works correctly
3. **Reset Edge Test:** Verify behavior when now === reset_time
4. **Empty Data Test:** Verify `used = 0` with no records
5. **Overflow Test:** Verify usage > limit is handled correctly

## References

- Claude Quota Tracker: 5h/7d sliding window display semantics
- Oracle Risk Model: Stale data must not be treated as zero
- cc-switch: Window boundary and caching behavior
