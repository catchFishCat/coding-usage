/**
 * Providers Command
 *
 * List available providers
 */

import chalk from 'chalk';
import Table from 'cli-table3';

/**
 * Available providers
 */
const AVAILABLE_PROVIDERS = [
  {
    id: 'openai',
    name: 'OpenAI',
    category: 'official',
    confidence: 'high',
    scopes: ['personal', 'org'],
    description: 'GPT-4, GPT-3.5 Turbo',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    category: 'aggregator',
    confidence: 'medium',
    scopes: ['personal', 'org'],
    description: 'Aggregate of 100+ models',
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    category: 'official',
    confidence: 'high',
    scopes: ['personal'],
    description: 'Claude, Claude Instant',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    category: 'official',
    confidence: 'high',
    scopes: ['personal'],
    description: 'DeepSeek-V3, DeepSeek-Coder',
  },
  {
    id: 'github-copilot',
    name: 'GitHub Copilot',
    category: 'official',
    confidence: 'high',
    scopes: ['personal', 'org', 'workspace'],
    description: 'AI pair programmer',
  },
];

/**
 * List available providers
 */
export async function listProviders(): Promise<void> {
  const table = new Table({
    head: ['ID', 'Name', 'Category', 'Confidence', 'Scopes'],
    colWidths: [15, 20, 15, 12, 20],
  });

  AVAILABLE_PROVIDERS.forEach((provider) => {
    table.push([
      provider.id,
      provider.name,
      provider.category,
      provider.confidence,
      provider.scopes.join(', '),
    ]);
  });

  console.log(table.toString());
}
