/**
 * CLI Types
 */

/**
 * CLI configuration
 */
export interface CliConfig {
  dataDir?: string;
  verbose?: boolean;
}

/**
 * Command options
 */
export interface CommandOptions {
  verbose?: boolean;
}

/**
 * Status command options
 */
export interface StatusOptions extends CommandOptions {
  json?: boolean;
}

/**
 * Init command options
 */
export interface InitOptions {
  apiKey?: string;
  orgId?: string;
}

/**
 * Auth login command options
 */
export interface AuthLoginOptions {
  env?: string;
  url?: string;
}

/**
 * Rule command options
 */
export interface RuleOptions {
  provider?: string;
  type?: "sliding" | "fixed" | "budget" | "balance";
  limit?: number;
  unit?: "requests" | "tokens" | "usd" | "credits";
}
