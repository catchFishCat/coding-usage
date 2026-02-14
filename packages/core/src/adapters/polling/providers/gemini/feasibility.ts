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
      "OAuth access is practical via GOOGLE_OAUTH_ACCESS_TOKEN or gcloud application-default credentials.",
      "Gemini CLI /stats remains a fallback when OAuth/API key probing is unavailable.",
    ],
  };
}
