import type { PollResult } from "../../types.js";

export async function probeKimiExperimental(): Promise<PollResult> {
  const apiKey = process.env.MOONSHOT_API_KEY;
  if (!apiKey) {
    return {
      provider: "kimi",
      mode: "experimental",
      ok: false,
      message: "MOONSHOT_API_KEY not set",
    };
  }

  const response = await fetch("https://api.moonshot.ai/v1/users/me/balance", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    return {
      provider: "kimi",
      mode: "experimental",
      ok: false,
      message: `alt host HTTP ${response.status}`,
    };
  }

  return {
    provider: "kimi",
    mode: "experimental",
    ok: true,
    message: "alternate moonshot host reachable",
  };
}

export function kimiAuthNotes(): string[] {
  return [
    "Official polling uses MOONSHOT_API_KEY against api.moonshot.cn (or MOONSHOT_BASE_URL when set).",
    "Experimental probing reuses MOONSHOT_API_KEY against alternate host api.moonshot.ai.",
  ];
}
