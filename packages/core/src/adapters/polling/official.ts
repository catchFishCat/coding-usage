import {
  pollCodexOfficial,
  pollGeminiOfficial,
  pollGitHubCopilotOfficial,
  pollGlmOfficial,
  pollKimiOfficial,
  pollOpenRouterOfficial,
} from "./providers/index.js";
import type { ProviderPoller } from "./types.js";

export const officialProviderPollers: ProviderPoller[] = [
  pollOpenRouterOfficial,
  pollCodexOfficial,
  pollGlmOfficial,
  pollKimiOfficial,
  pollGeminiOfficial,
  pollGitHubCopilotOfficial,
];
