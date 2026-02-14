import { insertUsageRecord, upsertProvider } from "../../db.js";
import type { PollResult } from "../../types.js";

interface OpenAiUsageBucket {
  input_tokens?: number;
  output_tokens?: number;
  num_model_requests?: number;
}

interface OpenAiUsageResponse {
  data?: OpenAiUsageBucket[];
}

export async function pollCodexOfficial(db: unknown): Promise<PollResult> {
  const adminKey = process.env.OPENAI_ADMIN_KEY;
  if (!adminKey) {
    return {
      provider: "codex",
      mode: "official",
      ok: false,
      message: "OPENAI_ADMIN_KEY not set",
    };
  }

  const startTime = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
  const url = `https://api.openai.com/v1/organization/usage/completions?start_time=${startTime}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${adminKey}` },
  });

  if (!response.ok) {
    return {
      provider: "codex",
      mode: "official",
      ok: false,
      message: `HTTP ${response.status}`,
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

  upsertProvider(db, "codex", "Codex (OpenAI API)", "official");
  insertUsageRecord(db, "codex", "api", payload);

  return {
    provider: "codex",
    mode: "official",
    ok: true,
    message: `usage fetched (requests=${totals.requests}, tokens=${totals.tokens})`,
  };
}
