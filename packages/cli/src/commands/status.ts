/**
 * Status Command
 *
 * Display current quota status for all configured providers
 */

import type { StatusOptions } from "../types.js";
import { getQuotaStatusSnapshot } from "@coding-usage/core";
import type { ProviderQuotaStatus } from "@coding-usage/core";

function formatTime(timestamp: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return "unknown";
  }
  return new Date(timestamp).toLocaleString();
}

/**
 * Display quota status
 */
export async function status(options: StatusOptions = {}): Promise<void> {
  const snapshot = getQuotaStatusSnapshot();

  if (options.json) {
    console.log(JSON.stringify(snapshot, null, 2));
    return;
  }

  if (snapshot.length === 0) {
    console.log("\nNo quota snapshots found yet.");
    console.log("Tip: add providers/rules and ingest usage data first.\n");
    return;
  }

  const latestRefresh = snapshot.reduce(
    (max, row) => Math.max(max, row.snapshotTimestamp),
    0,
  );

  // Display as simple table
  console.log("\nQuota Status:");
  console.log(`Last refresh: ${formatTime(latestRefresh)}`);
  console.log("─".repeat(60));
  snapshot.forEach((row: ProviderQuotaStatus) => {
    const percentage = (row.percentage * 100).toFixed(1) + "%";
    const freshness = row.freshness === "known" ? "✓" : "⚠";

    console.log(`${row.providerId}/${row.ruleName}`);
    console.log(
      `  Used: ${row.used.toLocaleString()} / ${row.limit.toLocaleString()} (${percentage})`,
    );
    console.log(`  Updated: ${formatTime(row.snapshotTimestamp)}`);
    console.log(`  Freshness: ${freshness}`);
    console.log("─".repeat(60));
  });
}
