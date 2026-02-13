/**
 * Status Command
 *
 * Display current quota status for all configured providers
 */

import type { StatusOptions } from '../types.js';

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
      limit: 1000000,
      percentage: 0.1234,
      freshness: 'known',
    },
    {
      provider: 'openrouter',
      rule: 'claude-opus-monthly',
      used: 85000,
      limit: 500000,
      percentage: 0.17,
      freshness: 'stale',
    },
  ];

  if (options.json) {
    console.log(JSON.stringify(mockData, null, 2));
    return;
  }

  // Display as simple table
  console.log('\nQuota Status:');
  console.log('─'.repeat(60));
  mockData.forEach((row) => {
    const percentage = (row.percentage * 100).toFixed(1) + '%';
    const freshness = row.freshness === 'known' ? '✓' : '⚠';

    console.log(`${row.provider}/${row.rule}`);
    console.log(`  Used: ${row.used.toLocaleString()} / ${row.limit.toLocaleString()} (${percentage})`);
    console.log(`  Freshness: ${freshness}`);
    console.log('─'.repeat(60));
  });
}
