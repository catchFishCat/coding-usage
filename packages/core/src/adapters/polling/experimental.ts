import type { PollResult, ProviderProbe } from "./types.js";

async function probeCodexExperimental(): Promise<PollResult> {
  const sessionToken = process.env.CHATGPT_SESSION_TOKEN;
  if (!sessionToken) {
    return {
      provider: "codex",
      mode: "experimental",
      ok: false,
      message: "CHATGPT_SESSION_TOKEN not set",
    };
  }

  const response = await fetch("https://chatgpt.com/backend-api/wham/usage", {
    headers: {
      Cookie: `__Secure-next-auth.session-token=${sessionToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    return {
      provider: "codex",
      mode: "experimental",
      ok: false,
      message: `private endpoint HTTP ${response.status}`,
    };
  }

  return {
    provider: "codex",
    mode: "experimental",
    ok: true,
    message: "private endpoint reachable",
  };
}

async function probeGeminiExperimental(): Promise<PollResult> {
  const cliPath = process.env.GEMINI_CLI_PATH || "gemini";

  try {
    const { execFileSync } = await import("node:child_process");
    const output = execFileSync(cliPath, ["/stats"], {
      encoding: "utf8",
      timeout: 10000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return {
      provider: "gemini",
      mode: "experimental",
      ok: true,
      message: output.trim()
        ? "gemini /stats available"
        : "gemini /stats returned empty output",
    };
  } catch (error) {
    return {
      provider: "gemini",
      mode: "experimental",
      ok: false,
      message:
        error instanceof Error ? error.message : "gemini cli probe failed",
    };
  }
}

async function probeKimiExperimental(): Promise<PollResult> {
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

async function probeGlmExperimental(): Promise<PollResult> {
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

export const experimentalProviderProbes: ProviderProbe[] = [
  probeCodexExperimental,
  probeGlmExperimental,
  probeKimiExperimental,
  probeGeminiExperimental,
];
