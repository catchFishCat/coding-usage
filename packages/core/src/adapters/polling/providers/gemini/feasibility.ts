export function geminiAuthFeasibility(): {
  apiKey: boolean;
  oauthCli: boolean;
  notes: string[];
} {
  return {
    apiKey: true,
    oauthCli: true,
    notes: [
      "Official reachability can be checked with GEMINI_API_KEY via /v1beta/models.",
      "OAuth access is currently practical through the Gemini CLI, which exposes /stats.",
      "No stable public OAuth quota polling endpoint is documented for direct API use.",
    ],
  };
}
