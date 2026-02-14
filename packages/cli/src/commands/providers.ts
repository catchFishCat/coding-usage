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
    id: "codex",
    name: "Codex (OpenAI API)",
    category: "official",
    confidence: "high",
    scopes: ["personal", "org"],
    description: "OpenAI usage API for Codex-related API activity",
  },
  {
    id: "glm",
    name: "GLM Coding Plan",
    category: "official",
    confidence: "medium",
    scopes: ["personal"],
    description:
      "Official plugin path and monitor endpoints for GLM plan usage",
  },
  {
    id: "kimi",
    name: "Kimi (Moonshot)",
    category: "official",
    confidence: "medium",
    scopes: ["personal"],
    description: "Moonshot balance endpoint and related coding-plan probes",
  },
  {
    id: "gemini",
    name: "Gemini",
    category: "official",
    confidence: "medium",
    scopes: ["project", "personal"],
    description: "Gemini API reachability with CLI/Cloud fallback probes",
  },
  {
    id: "openai",
    name: "OpenAI",
    category: "official",
    confidence: "high",
    scopes: ["personal", "org"],
    description: "GPT-4, GPT-3.5 Turbo",
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    category: "aggregator",
    confidence: "medium",
    scopes: ["personal", "org"],
    description: "Aggregate of 100+ models",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    category: "official",
    confidence: "high",
    scopes: ["personal"],
    description: "Claude, Claude Instant",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    category: "official",
    confidence: "high",
    scopes: ["personal"],
    description: "DeepSeek-V3, DeepSeek-Coder",
  },
  {
    id: "github-copilot",
    name: "GitHub Copilot",
    category: "official",
    confidence: "high",
    scopes: ["personal", "org", "workspace"],
    description: "AI pair programmer",
  },
];

/**
 * List available providers
 */
export async function listProviders(): Promise<void> {
  console.log("Available providers:");
  AVAILABLE_PROVIDERS.forEach((provider) => {
    console.log(`  - ${provider.name} (${provider.id})`);
    console.log(`    Category: ${provider.category}`);
    console.log(`    Description: ${provider.description}`);
    console.log(`    Scopes: ${provider.scopes.join(", ")}`);
    console.log();
  });
}
