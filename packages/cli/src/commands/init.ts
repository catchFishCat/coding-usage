/**
 * Init Command
 *
 * Initialize provider configuration
 */

import type { InitOptions } from '../types.js';
import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';

/**
 * Default data directory
 */
const DEFAULT_DATA_DIR = './data';

/**
 * Initialize configuration
 */
export async function init(provider: string | undefined, options: InitOptions = {}): Promise<void> {
  console.log(chalk.blue('🔧 Initializing coding-usage monitor...\n'));

  // Create data directory
  const dataDir = process.env.CODING_USAGE_DATA_DIR || DEFAULT_DATA_DIR;

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(chalk.green(`✓ Created data directory: ${dataDir}`));
  }

  // TODO: Implement provider configuration
  if (provider) {
    console.log(chalk.yellow(`Provider configuration for '${provider}' not yet implemented`));
  }

  // TODO: Save configuration file
  const configPath = path.join(dataDir, 'config.json');
  const config = {
    version: '0.1.0',
    initialized: Date.now(),
    providers: [],
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(chalk.green(`✓ Created configuration: ${configPath}`));

  console.log(chalk.green('\n✓ Initialization complete!'));
  console.log(chalk.gray('Run "coding-usage status" to check quota status\n'));
}
