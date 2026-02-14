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

interface KimiBalanceResponse {
  data?: {
    available_balance?: number;
  };
}

interface KimiUsageDetail {
  limit?: string;
  used?: string;
  remaining?: string;
  resetTime?: string;
}

interface KimiCodeUsageWindow {
  detail?: KimiUsageDetail;
  window?: {
    duration?: string;
    timeUnit?: string;
  };
}

interface KimiCodeUsageResponse {
  usage?: KimiUsageDetail;
  limits?: KimiCodeUsageWindow[];
}

interface KimiConsoleUsageWindow {
  detail?: {
    limit?: string;
    used?: string;
    remaining?: string;
  };
}

interface KimiConsoleUsageResponse {
  usages?: Array<{
    detail?: {
      limit?: string;
      used?: string;
      remaining?: string;
    };
    limits?: KimiConsoleUsageWindow[];
  }>;
}

function resolveKimiApiKeyFromOpencode(): string | null {
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
      "kimi-for-coding"?: { key?: string };
      "moonshotai-cn"?: { key?: string };
    };

    const kimiForCoding = parsed["kimi-for-coding"]?.key?.trim();
    if (kimiForCoding) {
      return kimiForCoding;
    }

    const moonshot = parsed["moonshotai-cn"]?.key?.trim();
    if (moonshot) {
      return moonshot;
    }
  } catch {
    return null;
  }

  return null;
}

function toNumber(value: string | number | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

function upsertKimiUsageSnapshot(
  db: unknown,
  ruleId: string,
  ruleName: string,
  used: number,
  limit: number,
): void {
  const upsertedRuleId = upsertRule(
    db,
    "kimi",
    ruleId,
    ruleName,
    "fixed_window",
    limit,
    "requests",
  );
  insertQuotaSnapshot(db, "kimi", upsertedRuleId, used, limit);
}

function persistKimiCodeUsage(
  db: unknown,
  payload: KimiCodeUsageResponse,
): string {
  upsertProvider(db, "kimi", "Kimi For Coding", "official");
  insertUsageRecord(db, "kimi", "api", payload);

  const summary = payload.usage;
  const summaryLimit = toNumber(summary?.limit);
  let summaryUsed = toNumber(summary?.used);
  const summaryRemaining = toNumber(summary?.remaining);
  if (
    summaryUsed === null &&
    summaryLimit !== null &&
    summaryRemaining !== null
  ) {
    summaryUsed = Math.max(0, summaryLimit - summaryRemaining);
  }

  if (summaryLimit !== null && summaryUsed !== null && summaryLimit > 0) {
    upsertKimiUsageSnapshot(
      db,
      "kimi-coding-weekly",
      "Kimi Coding Weekly Limit",
      summaryUsed,
      summaryLimit,
    );
  }

  let snapshotCount = 0;
  const detailParts: string[] = [];
  if (summaryLimit !== null && summaryUsed !== null && summaryLimit > 0) {
    snapshotCount += 1;
    detailParts.push(`weekly=${summaryUsed}/${summaryLimit}`);
  }

  for (const [index, item] of (payload.limits ?? []).entries()) {
    const limit = toNumber(item.detail?.limit);
    let used = toNumber(item.detail?.used);
    const remaining = toNumber(item.detail?.remaining);
    if (used === null && limit !== null && remaining !== null) {
      used = Math.max(0, limit - remaining);
    }
    if (limit === null || used === null || limit <= 0) {
      continue;
    }

    const duration = toNumber(item.window?.duration);
    const unit = (item.window?.timeUnit ?? "").toUpperCase();
    const windowLabel =
      duration !== null && unit.includes("MINUTE")
        ? `${duration}m`
        : duration !== null && unit.includes("HOUR")
          ? `${duration}h`
          : duration !== null && unit.includes("DAY")
            ? `${duration}d`
            : `limit-${index + 1}`;

    upsertKimiUsageSnapshot(
      db,
      `kimi-coding-${windowLabel}`,
      `Kimi Coding ${windowLabel} Limit`,
      used,
      limit,
    );
    snapshotCount += 1;
    detailParts.push(`${windowLabel}=${used}/${limit}`);
  }

  if (snapshotCount === 0) {
    return "usage fetched (no numeric limits)";
  }
  return `usage fetched (${detailParts.join(", ")})`;
}

async function fetchKimiBalance(
  apiKey: string,
  baseUrl: string,
): Promise<{ ok: boolean; status: number; payload?: KimiBalanceResponse }> {
  const response = await fetch(`${baseUrl}/v1/users/me/balance`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    return { ok: false, status: response.status };
  }

  return {
    ok: true,
    status: response.status,
    payload: (await response.json()) as KimiBalanceResponse,
  };
}

async function fetchKimiCodeUsage(apiKey: string): Promise<{
  ok: boolean;
  status: number;
  payload?: KimiCodeUsageResponse;
}> {
  const response = await fetch("https://api.kimi.com/coding/v1/usages", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    return { ok: false, status: response.status };
  }

  return {
    ok: true,
    status: response.status,
    payload: (await response.json()) as KimiCodeUsageResponse,
  };
}

async function pollKimiConsoleUsage(sessionToken: string): Promise<{
  ok: boolean;
  message: string;
  payload?: unknown;
}> {
  const response = await fetch(
    "https://www.kimi.com/apiv2/kimi.gateway.billing.v1.BillingService/GetUsages",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        "Content-Type": "application/json",
        Origin: "https://www.kimi.com",
        Referer: "https://www.kimi.com/code/console",
      },
      body: JSON.stringify({ scope: ["FEATURE_CODING"] }),
    },
  );

  if (!response.ok) {
    return { ok: false, message: `console usage HTTP ${response.status}` };
  }

  const payload = (await response.json()) as KimiConsoleUsageResponse;
  const codingUsage = payload.usages?.[0];
  const weeklyUsed = codingUsage?.detail?.used;
  const fiveHourUsed = codingUsage?.limits?.[0]?.detail?.used;

  return {
    ok: true,
    message:
      weeklyUsed || fiveHourUsed
        ? `console usage fetched (weekly=${weeklyUsed ?? "n/a"}, 5h=${fiveHourUsed ?? "n/a"})`
        : "console usage fetched",
    payload,
  };
}

export async function pollKimiOfficial(db: unknown): Promise<PollResult> {
  const envApiKey = process.env.MOONSHOT_API_KEY;
  const discoveredApiKey = resolveKimiApiKeyFromOpencode();
  const kimiCodeApiKey = process.env.KIMI_CODE_API_KEY;
  const baseUrl = process.env.MOONSHOT_BASE_URL || "https://api.moonshot.cn";
  const consoleSessionToken = process.env.KIMI_CONSOLE_SESSION_TOKEN;
  if (
    !envApiKey &&
    !discoveredApiKey &&
    !kimiCodeApiKey &&
    !consoleSessionToken
  ) {
    return {
      provider: "kimi",
      mode: "official",
      ok: false,
      message:
        "MOONSHOT_API_KEY/KIMI_CODE_API_KEY or KIMI_CONSOLE_SESSION_TOKEN not set",
    };
  }

  const triedKeys = [kimiCodeApiKey, envApiKey, discoveredApiKey].filter(
    (value, index, all): value is string =>
      typeof value === "string" &&
      value.length > 0 &&
      all.indexOf(value) === index,
  );

  let lastStatus = 0;
  for (const apiKey of triedKeys) {
    const usage = await fetchKimiCodeUsage(apiKey);
    if (usage.ok && usage.payload) {
      return {
        provider: "kimi",
        mode: "official",
        ok: true,
        message: persistKimiCodeUsage(db, usage.payload),
      };
    }

    if (usage.status !== 401) {
      lastStatus = usage.status;
      continue;
    }

    const balance = await fetchKimiBalance(apiKey, baseUrl);
    if (balance.ok && balance.payload) {
      const payload = balance.payload;
      const available = payload.data?.available_balance ?? 0;

      upsertProvider(db, "kimi", "Kimi (Moonshot)", "official");
      insertUsageRecord(db, "kimi", "api", payload);

      return {
        provider: "kimi",
        mode: "official",
        ok: true,
        message: `balance fetched (available=${available})`,
      };
    }

    lastStatus = balance.status;
  }

  if (triedKeys.length > 0) {
    if (!consoleSessionToken || lastStatus !== 401) {
      return {
        provider: "kimi",
        mode: "official",
        ok: false,
        message: `HTTP ${lastStatus || 401}`,
      };
    }
  }

  if (!consoleSessionToken) {
    return {
      provider: "kimi",
      mode: "official",
      ok: false,
      message: "KIMI_CONSOLE_SESSION_TOKEN not set",
    };
  }

  const consoleProbe = await pollKimiConsoleUsage(consoleSessionToken);
  if (!consoleProbe.ok) {
    return {
      provider: "kimi",
      mode: "official",
      ok: false,
      message: consoleProbe.message,
    };
  }

  upsertProvider(db, "kimi", "Kimi Code Console", "official");
  insertUsageRecord(db, "kimi", "api", consoleProbe.payload);

  return {
    provider: "kimi",
    mode: "official",
    ok: true,
    message: consoleProbe.message,
  };
}
