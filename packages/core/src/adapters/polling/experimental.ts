import {
  probeCodexExperimental,
  probeGeminiExperimental,
  probeGlmExperimental,
  probeKimiExperimental,
} from "./providers/index.js";
import type { ProviderProbe } from "./types.js";

export const experimentalProviderProbes: ProviderProbe[] = [
  probeCodexExperimental,
  probeGlmExperimental,
  probeKimiExperimental,
  probeGeminiExperimental,
];
