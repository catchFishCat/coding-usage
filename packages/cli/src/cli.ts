/**
 * CLI Tool for coding-usage monitor
 *
 * Command-line interface for managing quotas, providers, and alerts.
 */

import { Command } from "commander";

import { loadLocalEnv } from "./env.js";

loadLocalEnv();

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

program
  .command("configured-providers")
  .description("List all configured providers in one shot")
  .option("--json", "output as JSON")
  .option("-a, --all", "include unconfigured providers and signal status")
  .action(async (options) => {
    const { listConfiguredProviders } =
      await import("./commands/configured-providers.js");
    await listConfiguredProviders(options);
  });

program
  .command("usage")
  .description("Collect latest usage and show package usage status")
  .option("--json", "output status as JSON")
  .option("--no-refresh", "skip refresh and print cached status only")
  .action(async (options) => {
    if (options.refresh) {
      const { collect } = await import("./commands/collect.js");
      await collect({ experimental: true, hideModeLabel: true });
    }

    const { status } = await import("./commands/status.js");
    await status({ json: options.json });
  });

/**
 * Collect command - run provider polling once
 */
program
  .command("collect")
  .description("Collect usage from configured provider APIs once")
  .option("-e, --experimental", "also probe experimental/unofficial paths")
  .action(async (options) => {
    const { collect } = await import("./commands/collect.js");
    await collect(options);
  });

/**
 * Auth commands
 */
const auth = program.command("auth").description("Manage provider auth tokens");

auth
  .command("login <provider>")
  .description("Run provider login flow and auto-discover local credentials")
  .option("--env <name>", "unused compatibility option")
  .option("--url <url>", "unused compatibility option")
  .action(async (provider, options) => {
    const { authLogin } = await import("./commands/auth.js");
    await authLogin(provider, options);
  });

auth
  .command("status")
  .description("Show auth token/key availability from .env.local")
  .action(async () => {
    const { authStatus } = await import("./commands/auth.js");
    await authStatus();
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
