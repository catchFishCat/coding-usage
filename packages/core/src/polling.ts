import { randomUUID } from "node:crypto";
import {
  closeDatabase,
  createDatabase,
  initializeDatabase,
} from "./database/db.js";

interface PollResult {
  provider: string;
  ok: boolean;
  message: string;
}

interface OpenRouterKeyResponse {
  data?: {
    usage?: number;
    limit?: number;
  };
}

interface OpenAiUsageBucket {
  input_tokens?: number;
  output_tokens?: number;
  num_model_requests?: number;
}

interface OpenAiUsageResponse {
  data?: OpenAiUsageBucket[];
}

function upsertProvider(db: any, id: string, name: string): void {
  const now = Date.now();
  db.prepare(
    `
    INSERT INTO providers (id, name, category, enabled, config, created_at, updated_at)
    VALUES (?, ?, 'official', 1, '{}', ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      updated_at = excluded.updated_at
  `,
  ).run(id, name, now, now);
}

function upsertDefaultBalanceRule(
  db: any,
  providerId: string,
  name: string,
  limit: number,
): string {
  const now = Date.now();
  const ruleId = `${providerId}-credits-balance`;

  db.prepare(
    `
    INSERT INTO quota_rules (
      id, provider_id, name, enabled, type, "limit", unit,
      alert_thresholds, created_at, updated_at
    )
    VALUES (?, ?, ?, 1, 'balance', ?, 'credits', '[0.7,0.85,0.95]', ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      "limit" = excluded."limit",
      updated_at = excluded.updated_at
  `,
  ).run(ruleId, providerId, name, limit, now, now);

  return ruleId;
}

function insertUsageRecord(
  db: any,
  providerId: string,
  totalCost: number | null,
  raw: unknown,
): void {
  db.prepare(
    `
    INSERT INTO usage_records (
      id, provider_id, timestamp, source, cost_used, scope, raw_data
    ) VALUES (?, ?, ?, 'api', ?, 'personal', ?)
  `,
  ).run(randomUUID(), providerId, Date.now(), totalCost, JSON.stringify(raw));
}

function insertQuotaSnapshot(
  db: any,
  providerId: string,
  ruleId: string,
  used: number,
  limit: number,
): void {
  const percentage = limit > 0 ? Math.max(0, Math.min(1, used / limit)) : 0;
  db.prepare(
    `
    INSERT INTO quota_snapshots (
      provider_id, quota_rule_id, timestamp, used, "limit", percentage,
      resets_at, predicted_exhaust_at, freshness, data_timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 'known', ?)
  `,
  ).run(providerId, ruleId, Date.now(), used, limit, percentage, Date.now());
}

async function pollOpenRouter(db: any): Promise<PollResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return {
      provider: "openrouter",
      ok: false,
      message: "OPENROUTER_API_KEY not set",
    };
  }

  const response = await fetch("https://openrouter.ai/api/v1/key", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    return {
      provider: "openrouter",
      ok: false,
      message: `OpenRouter API error: ${response.status}`,
    };
  }

  const payload = (await response.json()) as OpenRouterKeyResponse;
  const usage = payload.data?.usage ?? 0;
  const limit = payload.data?.limit ?? 0;

  upsertProvider(db, "openrouter", "OpenRouter");
  const ruleId = upsertDefaultBalanceRule(
    db,
    "openrouter",
    "OpenRouter Credits Balance",
    limit,
  );
  insertUsageRecord(db, "openrouter", usage, payload);
  insertQuotaSnapshot(db, "openrouter", ruleId, usage, limit);

  return { provider: "openrouter", ok: true, message: "polled successfully" };
}

async function pollOpenAi(db: any): Promise<PollResult> {
  const adminKey = process.env.OPENAI_ADMIN_KEY;
  if (!adminKey) {
    return {
      provider: "openai",
      ok: false,
      message: "OPENAI_ADMIN_KEY not set",
    };
  }

  const startTime = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
  const url = `https://api.openai.com/v1/organization/usage/completions?start_time=${startTime}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${adminKey}`,
    },
  });

  if (!response.ok) {
    return {
      provider: "openai",
      ok: false,
      message: `OpenAI usage API error: ${response.status}`,
    };
  }

  const payload = (await response.json()) as OpenAiUsageResponse;
  const totals = (payload.data ?? []).reduce(
    (acc, row) => {
      acc.requests += row.num_model_requests ?? 0;
      acc.tokens += (row.input_tokens ?? 0) + (row.output_tokens ?? 0);
      return acc;
    },
    { requests: 0, tokens: 0 },
  );

  upsertProvider(db, "openai", "OpenAI");
  insertUsageRecord(db, "openai", null, payload);

  // For OpenAI MVP polling we only store raw usage record.
  // Quota rule/limit depends on user-configured budget and is added later.
  return {
    provider: "openai",
    ok: true,
    message: `polled usage (requests=${totals.requests}, tokens=${totals.tokens})`,
  };
}

export async function pollProvidersOnce(): Promise<PollResult[]> {
  const db = createDatabase();
  initializeDatabase(db);

  try {
    const results: PollResult[] = [];

    try {
      results.push(await pollOpenRouter(db));
    } catch (error) {
      results.push({
        provider: "openrouter",
        ok: false,
        message: error instanceof Error ? error.message : "unknown error",
      });
    }

    try {
      results.push(await pollOpenAi(db));
    } catch (error) {
      results.push({
        provider: "openai",
        ok: false,
        message: error instanceof Error ? error.message : "unknown error",
      });
    }

    return results;
  } finally {
    closeDatabase(db);
  }
}
