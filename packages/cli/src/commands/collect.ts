import { pollProvidersOnce, probeAllProviderPaths } from "@coding-usage/core";

interface CollectOptions {
  experimental?: boolean;
  hideModeLabel?: boolean;
}

export async function collect(options: CollectOptions = {}): Promise<void> {
  const results = await pollProvidersOnce();
  const experimental = options.experimental
    ? await probeAllProviderPaths()
    : [];
  const allResults = [...results, ...experimental];

  console.log("\nPolling results:");
  for (const row of allResults) {
    const prefix = row.ok ? "✓" : "✗";
    if (options.hideModeLabel) {
      console.log(`${prefix} ${row.provider}: ${row.message}`);
      continue;
    }
    console.log(`${prefix} [${row.mode}] ${row.provider}: ${row.message}`);
  }
  console.log("");
}
