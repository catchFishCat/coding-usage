import { insertUsageRecord, upsertProvider } from "../../db.js";
import type { PollResult } from "../../types.js";

interface KimiBalanceResponse {
  data?: {
    available_balance?: number;
  };
}

export async function pollKimiOfficial(db: unknown): Promise<PollResult> {
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
