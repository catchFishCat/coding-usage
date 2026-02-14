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
    const results = await Promise.all(
      officialProviderPollers.map(async (poller) => {
        try {
          return await poller(db);
        } catch (error) {
          return normalizeError("unknown", "official", error);
        }
      }),
    );

    return results;
  } finally {
    closeDatabase(db);
  }
}

export async function probeAllProviderPaths(): Promise<PollResult[]> {
  return Promise.all(
    experimentalProviderProbes.map(async (probe) => {
      try {
        return await probe();
      } catch (error) {
        return normalizeError("unknown", "experimental", error);
      }
    }),
  );
}

export type { PollResult } from "./adapters/polling/index.js";
