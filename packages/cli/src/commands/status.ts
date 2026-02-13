/**
 * Status Command
 *
 * Display current quota status for all configured providers
 */

import type { StatusOptions } from '../types.js';
import Table from 'cli-table3';
import chalk from 'chalk';

/**
 * Display quota status
 */
export async function status(options: StatusOptions = {}): Promise<void> {
  // TODO: Implement actual database query
  const mockData = [
    {
      provider: 'openai',
      rule: 'gpt-4-monthly',
      used: 1234567,
      limit: 10000000,
      percentage: 0.1234,
      freshness: 'known',
    },
    {
      provider: 'openrouter',
      rule: 'claude-opus-monthly',
      used: 850000,
      limit: 5000000,
      percentage: 0.17,
      freshness: 'stale',
    },
  ];

  if (options.json) {
    console.log(JSON.stringify(mockData, null, 2));
    return;
  }

  // Display as table
  const table = new Table({
    head: ['Provider', 'Rule', 'Used', 'Limit', '%', 'Freshness'],
    colWidths: [20, 25, 15, 15, 8, 12],
  });

  mockData.forEach((row) => {
    const percentage = (row.percentage * 100).toFixed(1) + '%';
    const freshness = row.freshness === 'known' ? '✓' : '⚠';

    table.push([
      row.provider,
      row.rule,
      formatNumber(row.used),
      formatNumber(row.limit),
      percentage,
      freshness,
    ]);
  });

  console.log(table.toString());
}

/**
 * Format number with thousand separators
 */
function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}
