import { insertUsageRecord, upsertProvider } from "../../db.js";
import type { PollResult } from "../../types.js";

export async function pollGeminiOfficial(db: unknown): Promise<PollResult> {
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
