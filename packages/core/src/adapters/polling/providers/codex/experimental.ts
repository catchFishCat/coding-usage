import {
  insertQuotaSnapshot,
  insertUsageRecord,
  upsertProvider,
  upsertRule,
} from "../../db.js";
import type { PollResult } from "../../types.js";

interface CodexWindowData {
  used_percent?: number;
}

interface CodexUsagePayload {
  plan_type?: string;
  rate_limit?: {
    primary_window?: CodexWindowData;
    secondary_window?: CodexWindowData;
  };
}

export async function probeCodexExperimental(db: unknown): Promise<PollResult> {
  const sessionToken = process.env.CHATGPT_SESSION_TOKEN;
  const oauthAccessToken = process.env.OPENAI_OAUTH_ACCESS_TOKEN;
  const accountId = process.env.OPENAI_ACCOUNT_ID;

  if (!sessionToken && !oauthAccessToken) {
    return {
      provider: "codex",
      mode: "experimental",
      ok: false,
      message: "CHATGPT_SESSION_TOKEN or OPENAI_OAUTH_ACCESS_TOKEN not set",
    };
  }

  const response = await fetch("https://chatgpt.com/backend-api/wham/usage", {
    headers: {
      ...(sessionToken
        ? { Cookie: `__Secure-next-auth.session-token=${sessionToken}` }
        : { Authorization: `Bearer ${oauthAccessToken}` }),
      ...(accountId ? { "chatgpt-account-id": accountId } : {}),
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

  const payload = (await response.json()) as CodexUsagePayload;
  const primaryUsed = payload.rate_limit?.primary_window?.used_percent;
  const secondaryUsed = payload.rate_limit?.secondary_window?.used_percent;

  upsertProvider(db, "codex", "Codex (ChatGPT Web)", "experimental");
  insertUsageRecord(db, "codex", "api", payload);

  const usageParts: string[] = [];
  if (typeof primaryUsed === "number") {
    const ruleId = upsertRule(
      db,
      "codex",
      "codex-primary-window-5h",
      "Codex Primary Window (5h)",
      "fixed_window",
      100,
      "requests",
    );
    insertQuotaSnapshot(db, "codex", ruleId, primaryUsed, 100);
    usageParts.push(`5h=${primaryUsed.toFixed(1)}%`);
  }

  if (typeof secondaryUsed === "number") {
    const ruleId = upsertRule(
      db,
      "codex",
      "codex-secondary-window-7d",
      "Codex Secondary Window (7d)",
      "fixed_window",
      100,
      "requests",
    );
    insertQuotaSnapshot(db, "codex", ruleId, secondaryUsed, 100);
    usageParts.push(`7d=${secondaryUsed.toFixed(1)}%`);
  }

  const planPart = payload.plan_type ? `plan=${payload.plan_type}` : null;
  const details = [planPart, ...usageParts].filter(Boolean).join(", ");

  return {
    provider: "codex",
    mode: "experimental",
    ok: true,
    message:
      details.length > 0
        ? `usage fetched via ${sessionToken ? "session-token" : "oauth token"} (${details})`
        : `private endpoint reachable via ${sessionToken ? "session-token" : "oauth token"}`,
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
      "No official OAuth scope currently guarantees access to ChatGPT private usage polling endpoints.",
      "Experimental polling supports session-cookie and oauth access-token attempts for runtime feasibility checks.",
    ],
  };
}
