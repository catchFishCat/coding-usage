import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  insertQuotaSnapshot,
  insertUsageRecord,
  upsertProvider,
  upsertRule,
} from "../../db.js";
import type { PollResult } from "../../types.js";

interface CopilotQuotaSnapshot {
  entitlement?: number;
  remaining?: number;
  unlimited?: boolean;
}

interface CopilotUserPayload {
  copilot_plan?: string;
  access_type_sku?: string;
  quota_reset_date_utc?: string;
  quota_snapshots?: {
    premium_interactions?: CopilotQuotaSnapshot;
  };
}

function resolveCopilotTokenFromOpencode(): string | null {
  const authPath = path.join(
    os.homedir(),
    ".local",
    "share",
    "opencode",
    "auth.json",
  );
  if (!fs.existsSync(authPath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(authPath, "utf8")) as {
      "github-copilot"?: {
        access?: string;
        refresh?: string;
      };
    };

    const access = parsed["github-copilot"]?.access?.trim();
    if (access) {
      return access;
    }

    const refresh = parsed["github-copilot"]?.refresh?.trim();
    if (refresh) {
      return refresh;
    }
  } catch {
    return null;
  }

  return null;
}

export async function pollGitHubCopilotOfficial(
  db: unknown,
): Promise<PollResult> {
  const token =
    process.env.GITHUB_COPILOT_TOKEN ||
    process.env.GITHUB_TOKEN ||
    resolveCopilotTokenFromOpencode();
  if (!token) {
    return {
      provider: "github-copilot",
      mode: "official",
      ok: false,
      message: "GITHUB_COPILOT_TOKEN/GITHUB_TOKEN not set",
    };
  }

  const response = await fetch("https://api.github.com/copilot_internal/user", {
    headers: {
      Authorization: `token ${token}`,
      "User-Agent": "coding-usage",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    return {
      provider: "github-copilot",
      mode: "official",
      ok: false,
      message: `HTTP ${response.status}`,
    };
  }

  const payload = (await response.json()) as CopilotUserPayload;
  const premium = payload.quota_snapshots?.premium_interactions;
  const limit = premium?.unlimited ? 0 : (premium?.entitlement ?? 0);
  const remaining = premium?.remaining ?? 0;
  const used = Math.max(0, limit - remaining);

  upsertProvider(db, "github-copilot", "GitHub Copilot", "official");
  insertUsageRecord(db, "github-copilot", "api", payload);

  const details = [
    payload.copilot_plan ? `plan=${payload.copilot_plan}` : null,
    payload.access_type_sku ? `sku=${payload.access_type_sku}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  if (limit <= 0) {
    return {
      provider: "github-copilot",
      mode: "official",
      ok: true,
      message:
        details.length > 0
          ? `usage fetched (${details}, premium unlimited)`
          : "usage fetched (premium unlimited)",
    };
  }

  const ruleId = upsertRule(
    db,
    "github-copilot",
    "github-copilot-premium-monthly",
    "GitHub Copilot Premium Requests (Monthly)",
    "fixed_window",
    limit,
    "requests",
  );
  insertQuotaSnapshot(db, "github-copilot", ruleId, used, limit);

  return {
    provider: "github-copilot",
    mode: "official",
    ok: true,
    message:
      details.length > 0
        ? `usage fetched (${details}, premium=${used}/${limit})`
        : `usage fetched (premium=${used}/${limit})`,
  };
}
