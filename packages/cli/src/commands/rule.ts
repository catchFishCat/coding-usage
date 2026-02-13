/**
 * Rule Command
 *
 * Manage quota rules
 */

import type { RuleOptions } from '../types.js';
import chalk from 'chalk';

/**
 * Add a new quota rule
 */
export async function addRule(options: RuleOptions = {}): Promise<void> {
  const { provider, type, limit, unit } = options;

  if (!provider) {
    console.error(chalk.red('Error: --provider is required'));
    process.exit(1);
  }

  if (!type) {
    console.error(chalk.red('Error: --type is required'));
    process.exit(1);
  }

  if (!limit) {
    console.error(chalk.red('Error: --limit is required'));
    process.exit(1);
  }

  if (!unit) {
    console.error(chalk.red('Error: --unit is required'));
    process.exit(1);
  }

  // TODO: Implement actual rule creation
  console.log(chalk.green('✓ Rule created (not yet implemented)'));
  console.log(chalk.gray(`Provider: ${provider}`));
  console.log(chalk.gray(`Type: ${type}`));
  console.log(chalk.gray(`Limit: ${limit} ${unit}`));
}
