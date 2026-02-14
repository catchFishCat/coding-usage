import {
  insertQuotaSnapshot,
  insertUsageRecord,
  upsertProvider,
  upsertRule,
} from "./db.js";
import type { PollResult, ProviderPoller } from "./types.js";

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

interface KimiBalanceResponse {
  data?: {
    available_balance?: number;
  };
}

interface GlmQuotaLimitResponse {
  limits?: Array<{
    type?: string;
    percentage?: number;
  }>;
}

async function pollOpenRouterOfficial(db: any): Promise<PollResult> {
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

async function pollCodexOfficial(db: any): Promise<PollResult> {
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

async function pollGlmOfficial(db: any): Promise<PollResult> {
  const token = process.env.ZHIPU_AUTH_TOKEN;
  const baseUrl = process.env.ZHIPU_BASE_URL || "https://open.bigmodel.cn";
  if (!token) {
    return {
      provider: "glm",
      mode: "official",
      ok: false,
      message: "ZHIPU_AUTH_TOKEN not set",
    };
  }

  const response = await fetch(`${baseUrl}/api/monitor/usage/quota/limit`, {
    headers: {
      Authorization: token,
      "Accept-Language": "en-US,en",
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    return {
      provider: "glm",
      mode: "official",
      ok: false,
      message: `HTTP ${response.status}`,
    };
  }

  const payload = (await response.json()) as GlmQuotaLimitResponse;
  const tokenLimitPercent =
    payload.limits?.find((item) => item.type?.toLowerCase().includes("token"))
      ?.percentage ?? 0;

  upsertProvider(db, "glm", "GLM Coding Plan", "official");
  const ruleId = upsertRule(
    db,
    "glm",
    "glm-token-window",
    "GLM Token Window (5h)",
    "fixed_window",
    100,
    "requests",
  );
  insertUsageRecord(db, "glm", "api", payload);
  insertQuotaSnapshot(db, "glm", ruleId, tokenLimitPercent, 100);

  return {
    provider: "glm",
    mode: "official",
    ok: true,
    message: `quota fetched (${tokenLimitPercent.toFixed(2)}%)`,
  };
}

async function pollKimiOfficial(db: any): Promise<PollResult> {
  const apiKey = process.env.MOONSHOT_API_KEY;
  const baseUrl = process.env.MOONSHOT_BASE_URL || "https://api.moonshot.cn";
  if (!apiKey) {
    return {
      provider: "kimi",
      mode: "official",
      ok: false,
      message: "MOONSHOT_API_KEY not set",
    };
  }

  const response = await fetch(`${baseUrl}/v1/users/me/balance`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    return {
      provider: "kimi",
      mode: "official",
      ok: false,
      message: `HTTP ${response.status}`,
    };
  }

  const payload = (await response.json()) as KimiBalanceResponse;
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

async function pollGeminiOfficial(db: any): Promise<PollResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      provider: "gemini",
      mode: "official",
      ok: false,
      message: "GEMINI_API_KEY not set",
    };
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
  );
  if (!response.ok) {
    return {
      provider: "gemini",
      mode: "official",
      ok: false,
      message: `HTTP ${response.status}`,
    };
  }

  const payload = await response.json();
  upsertProvider(db, "gemini", "Gemini API", "official");
  insertUsageRecord(db, "gemini", "api", payload);

  return {
    provider: "gemini",
    mode: "official",
    ok: true,
    message: "api reachable",
  };
}

export const officialProviderPollers: ProviderPoller[] = [
  pollOpenRouterOfficial,
  pollCodexOfficial,
  pollGlmOfficial,
  pollKimiOfficial,
  pollGeminiOfficial,
];
