/**
 * CLI Tool for coding-usage monitor
 *
 * Command-line interface for managing quotas, providers, and alerts.
 */

import { Command } from "commander";

/**
 * Root command
 */
const program = new Command();

program
  .name("coding-usage")
  .description("AI coding quota monitor - Track usage across providers")
  .version("0.1.0");

/**
 * Status command - show current quota status
 */
program
  .command("status")
  .description("Show quota status for all providers")
  .option("--json", "output as JSON")
  .option("-v, --verbose", "verbose output")
  .action(async (options) => {
    const { status } = await import("./commands/status.js");
    await status(options);
  });

/**
 * Init command - initialize configuration
 */
program
  .command("init [provider]")
  .description("Initialize a provider configuration")
  .option("-k, --api-key <key>", "API key")
  .option("-o, --org-id <id>", "Organization ID")
  .action(async (provider, options) => {
    const { init } = await import("./commands/init.js");
    await init(provider, options);
  });

/**
 * List providers command
 */
program
  .command("providers")
  .description("List available providers")
  .action(async () => {
    const { listProviders } = await import("./commands/providers.js");
    await listProviders();
  });

/**
 * Collect command - run provider polling once
 */
program
  .command("collect")
  .description("Collect usage from configured provider APIs once")
  .action(async () => {
    const { collect } = await import("./commands/collect.js");
    await collect();
  });

/**
 * Add rule command
 */
program
  .command("rule add")
  .description("Add a new quota rule")
  .option("-p, --provider <id>", "Provider ID")
  .option("-t, --type <type>", "Rule type: sliding|fixed|budget|balance")
  .option("-l, --limit <limit>", "Quota limit")
  .option("-u, --unit <unit>", "Unit: requests|tokens|usd|credits")
  .action(async (options) => {
    const { addRule } = await import("./commands/rule.js");
    await addRule(options);
  });

/**
 * Parse arguments
 */
program.parse(process.argv);

/**
 * Show help if no command
 */
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

/**
 * Export for testing
 */
export { program };
