import type { PollResult } from "../../types.js";

export async function probeCodexExperimental(): Promise<PollResult> {
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

/**
 * OAuth is not currently viable for Codex private usage polling because the
 * endpoint relies on ChatGPT web-session cookies instead of public OAuth scopes.
 */
export function codexOAuthFeasibility(): {
  supported: boolean;
  authMode: string;
  notes: string[];
} {
  return {
    supported: false,
    authMode: "session-token-cookie",
    notes: [
      "No official OAuth flow currently exposes ChatGPT private usage polling endpoints.",
      "Experimental polling still relies on __Secure-next-auth.session-token cookie material.",
    ],
  };
}
