import { pollProvidersOnce } from "@coding-usage/core";

export async function collect(): Promise<void> {
  const results = await pollProvidersOnce();

  console.log("\nPolling results:");
  for (const row of results) {
    const prefix = row.ok ? "✓" : "✗";
    console.log(`${prefix} ${row.provider}: ${row.message}`);
  }
  console.log("");
}
