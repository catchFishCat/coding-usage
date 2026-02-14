import {
  insertQuotaSnapshot,
  insertUsageRecord,
  upsertProvider,
  upsertRule,
} from "../../db.js";
import type { PollResult } from "../../types.js";

interface GlmQuotaLimitResponse {
  limits?: Array<{
    type?: string;
    percentage?: number;
  }>;
}

export async function pollGlmOfficial(db: unknown): Promise<PollResult> {
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

export function glmAuthNotes(): string[] {
  return [
    "Use ZHIPU_AUTH_TOKEN as a preformatted Authorization header value (no Bearer prefix added).",
    "Official polling calls `${ZHIPU_BASE_URL || https://open.bigmodel.cn}/api/monitor/usage/quota/limit`.",
    "Experimental probe calls https://api.z.ai/api/monitor/usage/quota/limit with identical headers.",
    "Both GLM endpoints assume Accept-Language=en-US,en and Content-Type=application/json.",
  ];
}
