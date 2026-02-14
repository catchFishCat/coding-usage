import {
  insertQuotaSnapshot,
  insertUsageRecord,
  upsertProvider,
  upsertRule,
} from "../../db.js";
import type { PollResult } from "../../types.js";

interface OpenRouterKeyResponse {
  data?: {
    usage?: number;
    limit?: number;
  };
}

export async function pollOpenRouterOfficial(db: unknown): Promise<PollResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return {
      provider: "openrouter",
      mode: "official",
      ok: false,
      message: "OPENROUTER_API_KEY not set",
    };
  }

  const response = await fetch("https://openrouter.ai/api/v1/key", {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    return {
      provider: "openrouter",
      mode: "official",
      ok: false,
      message: `HTTP ${response.status}`,
    };
  }

  const payload = (await response.json()) as OpenRouterKeyResponse;
  const usage = payload.data?.usage ?? 0;
  const limit = payload.data?.limit ?? 0;

  upsertProvider(db, "openrouter", "OpenRouter");
  const ruleId = upsertRule(
    db,
    "openrouter",
    "openrouter-credits-balance",
    "OpenRouter Credits Balance",
    "balance",
    limit,
    "credits",
  );
  insertUsageRecord(db, "openrouter", "api", payload);
  insertQuotaSnapshot(db, "openrouter", ruleId, usage, limit);

  return {
    provider: "openrouter",
    mode: "official",
    ok: true,
    message: "credits fetched",
  };
}
