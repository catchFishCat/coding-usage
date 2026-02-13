/**
 * Providers Command
 *
 * List available providers
 */

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
  console.log('Available providers:');
  AVAILABLE_PROVIDERS.forEach((provider) => {
    console.log(`  - ${provider.name} (${provider.id})`);
    console.log(`    Category: ${provider.category}`);
    console.log(`    Description: ${provider.description}`);
    console.log(`    Scopes: ${provider.scopes.join(', ')}`);
    console.log();
  });
}
