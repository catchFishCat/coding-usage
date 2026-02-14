import type { PollResult } from "../../types.js";

export async function probeGlmExperimental(): Promise<PollResult> {
  const token = process.env.ZHIPU_AUTH_TOKEN;
  if (!token) {
    return {
      provider: "glm",
      mode: "experimental",
      ok: false,
      message: "ZHIPU_AUTH_TOKEN not set",
    };
  }

  const response = await fetch(
    "https://api.z.ai/api/monitor/usage/quota/limit",
    {
      headers: {
        Authorization: token,
        "Accept-Language": "en-US,en",
        "Content-Type": "application/json",
      },
    },
  );

  if (!response.ok) {
    return {
      provider: "glm",
      mode: "experimental",
      ok: false,
      message: `global monitor endpoint HTTP ${response.status}`,
    };
  }

  return {
    provider: "glm",
    mode: "experimental",
    ok: true,
    message: "global monitor endpoint reachable",
  };
}
