import {
  closeDatabase,
  createDatabase,
  initializeDatabase,
} from "./database/db.js";
import {
  experimentalProviderProbes,
  officialProviderPollers,
  type PollMode,
  type PollResult,
} from "./adapters/polling/index.js";

function normalizeError(
  provider: string,
  mode: PollMode,
  error: unknown,
): PollResult {
  return {
    provider,
    mode,
    ok: false,
    message: error instanceof Error ? error.message : "unknown error",
  };
}

export async function pollProvidersOnce(): Promise<PollResult[]> {
  const db = createDatabase();
  initializeDatabase(db);

  try {
    const officialTargets = [
      "openrouter",
      "codex",
      "glm",
      "kimi",
      "gemini",
    ] as const;

    const results = await Promise.all(
      officialProviderPollers.map(async (poller, index) => {
        try {
          return await poller(db);
        } catch (error) {
          return normalizeError(
            officialTargets[index] ?? "unknown",
            "official",
            error,
          );
        }
      }),
    );

    return results;
  } finally {
    closeDatabase(db);
  }
}

export async function probeAllProviderPaths(): Promise<PollResult[]> {
  const db = createDatabase();
  initializeDatabase(db);
  const experimentalTargets = ["codex", "glm", "kimi", "gemini"] as const;

  try {
    return await Promise.all(
      experimentalProviderProbes.map(async (probe, index) => {
        try {
          return await probe(db);
        } catch (error) {
          return normalizeError(
            experimentalTargets[index] ?? "unknown",
            "experimental",
            error,
          );
        }
      }),
    );
  } finally {
    closeDatabase(db);
  }
}

export type { PollResult } from "./adapters/polling/index.js";
