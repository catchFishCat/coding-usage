import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  insertQuotaSnapshot,
  pruneProviderRules,
  insertUsageRecord,
  upsertProvider,
  upsertRule,
} from "../../db.js";
import type { PollResult } from "../../types.js";

interface GeminiQuotaBucket {
  modelId?: string;
  remainingFraction?: number;
  resetTime?: string;
}

interface GeminiLoadCodeAssistResponse {
  cloudaicompanionProject?: string;
  currentTier?: {
    name?: string;
    id?: string;
  };
}

interface GeminiRetrieveQuotaResponse {
  buckets?: GeminiQuotaBucket[];
}

interface AntigravityCachedQuotaEntry {
  remainingFraction?: number;
  resetTime?: string;
}

interface AntigravityAccountsFile {
  accounts?: Array<{
    enabled?: boolean;
    projectId?: string;
    managedProjectId?: string;
    refreshToken?: string;
    cachedQuota?: Record<string, AntigravityCachedQuotaEntry>;
    cachedQuotaUpdatedAt?: number;
  }>;
}

interface OpencodeAuthGoogleEntry {
  access?: string;
  expires?: number;
  refresh?: string;
}

interface GcloudAdcCredentials {
  client_id?: string;
  client_secret?: string;
}

interface OAuthClientCredentials {
  client_id: string;
  client_secret?: string;
}

function resolveOAuthClientsFromEnv(): OAuthClientCredentials[] {
  const candidates = [
    {
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID,
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    },
    {
      client_id: process.env.ANTIGRAVITY_GOOGLE_CLIENT_ID,
      client_secret: process.env.ANTIGRAVITY_GOOGLE_CLIENT_SECRET,
    },
  ];

  return candidates
    .map((item) => ({
      client_id: item.client_id?.trim() ?? "",
      client_secret: item.client_secret?.trim() || undefined,
    }))
    .filter((item) => item.client_id.length > 0);
}

function toRuleId(modelId: string): string {
  return `gemini-${modelId.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
}

function upsertGeminiModelSnapshot(
  db: unknown,
  modelId: string,
  usedPercent: number,
): void {
  const ruleId = upsertRule(
    db,
    "gemini",
    toRuleId(modelId),
    `Gemini ${modelId} Quota`,
    "fixed_window",
    100,
    "requests",
  );
  insertQuotaSnapshot(db, "gemini", ruleId, usedPercent, 100);
}

function readJsonFile<T>(filePath: string): T | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function getOpencodeAuthPath(): string {
  return path.join(os.homedir(), ".local", "share", "opencode", "auth.json");
}

function readOpencodeGoogleAuth(): OpencodeAuthGoogleEntry | null {
  const parsed = readJsonFile<{
    google?: OpencodeAuthGoogleEntry;
  }>(getOpencodeAuthPath());
  return parsed?.google ?? null;
}

export function parseGoogleRefreshValue(raw: string): {
  refreshToken: string;
  projectId: string | null;
} {
  const value = raw.trim();
  if (!value) {
    return { refreshToken: "", projectId: null };
  }

  const [refreshToken, projectId] = value.split("|", 2);
  return {
    refreshToken,
    projectId: projectId && projectId.length > 0 ? projectId : null,
  };
}

export function resolveAdcPathCandidates(
  homeDir = os.homedir(),
  appData = process.env.APPDATA,
): string[] {
  const candidates = [
    appData
      ? path.join(appData, "gcloud", "application_default_credentials.json")
      : null,
    path.join(
      homeDir,
      ".config",
      "gcloud",
      "application_default_credentials.json",
    ),
  ].filter(
    (item): item is string => typeof item === "string" && item.length > 0,
  );

  return Array.from(new Set(candidates));
}

function resolveProjectIdFromAntigravity(): string | null {
  const accountsPath = path.join(
    os.homedir(),
    ".config",
    "opencode",
    "antigravity-accounts.json",
  );
  const parsed = readJsonFile<AntigravityAccountsFile>(accountsPath);
  if (!parsed?.accounts || parsed.accounts.length === 0) {
    return null;
  }

  const account =
    parsed.accounts.find((item) => item.enabled !== false) ??
    parsed.accounts[0];

  const managedProjectId = account?.managedProjectId?.trim();
  if (managedProjectId) {
    return managedProjectId;
  }

  const projectId = account?.projectId?.trim();
  return projectId || null;
}

function resolveRefreshTokenFromAntigravity(): string | null {
  const accountsPath = path.join(
    os.homedir(),
    ".config",
    "opencode",
    "antigravity-accounts.json",
  );
  const parsed = readJsonFile<AntigravityAccountsFile>(accountsPath);
  if (!parsed?.accounts || parsed.accounts.length === 0) {
    return null;
  }

  const account =
    parsed.accounts.find((item) => item.enabled !== false) ??
    parsed.accounts[0];
  const refreshToken = account?.refreshToken?.trim();
  if (!refreshToken) {
    return null;
  }
  return parseGoogleRefreshValue(refreshToken).refreshToken || null;
}

function readGcloudAdcCredentials(): GcloudAdcCredentials | null {
  for (const candidate of resolveAdcPathCandidates()) {
    const parsed = readJsonFile<GcloudAdcCredentials>(candidate);
    if (!parsed?.client_id) {
      continue;
    }
    return parsed;
  }
  return null;
}

async function refreshGoogleAccessToken(
  refreshToken: string,
): Promise<string | null> {
  const token = refreshToken.trim();
  if (!token) {
    return null;
  }

  const adc = readGcloudAdcCredentials();
  const clients: OAuthClientCredentials[] = [
    ...(adc?.client_id
      ? [{ client_id: adc.client_id, client_secret: adc.client_secret }]
      : []),
    ...resolveOAuthClientsFromEnv(),
  ];

  const seen = new Set<string>();
  for (const client of clients) {
    if (seen.has(client.client_id)) {
      continue;
    }
    seen.add(client.client_id);

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: token,
      client_id: client.client_id,
    });
    if (client.client_secret) {
      body.set("client_secret", client.client_secret);
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!response.ok) {
      continue;
    }

    const payload = (await response.json()) as {
      access_token?: string;
    };
    const accessToken = payload.access_token?.trim();
    if (accessToken && accessToken.length > 0) {
      return accessToken;
    }
  }

  return null;
}

function persistOpencodeGoogleAccessToken(accessToken: string): void {
  const authPath = getOpencodeAuthPath();
  const parsed = readJsonFile<{
    google?: OpencodeAuthGoogleEntry;
    [key: string]: unknown;
  }>(authPath);
  if (!parsed || !parsed.google) {
    return;
  }

  parsed.google.access = accessToken;
  parsed.google.expires = Date.now() + 55 * 60 * 1000;

  try {
    fs.writeFileSync(authPath, JSON.stringify(parsed, null, 2));
  } catch {
    // Ignore local cache write errors, runtime token remains usable.
  }
}

function resolveGeminiTokenFromOpencode(): string | null {
  const parsed = readOpencodeGoogleAuth();

  const access = parsed?.access?.trim();
  if (!access) {
    return null;
  }

  const expires = parsed?.expires ?? 0;
  if (expires > 0 && expires < Date.now()) {
    return null;
  }

  return access;
}

function readAntigravityCachedQuota(): Array<{
  modelId: string;
  usedPercent: number;
  resetTime?: string;
}> {
  const accountsPath = path.join(
    os.homedir(),
    ".config",
    "opencode",
    "antigravity-accounts.json",
  );

  const parsed = readJsonFile<AntigravityAccountsFile>(accountsPath);
  if (!parsed?.accounts || parsed.accounts.length === 0) {
    return [];
  }

  const account =
    parsed.accounts.find(
      (item) => item.enabled !== false && item.cachedQuota,
    ) ?? parsed.accounts.find((item) => item.cachedQuota);
  const cached = account?.cachedQuota;
  if (!cached) {
    return [];
  }

  const entries: Array<{
    modelId: string;
    usedPercent: number;
    resetTime?: string;
  }> = [];
  for (const [modelId, quota] of Object.entries(cached)) {
    if (typeof quota.remainingFraction !== "number") {
      continue;
    }
    const used = Math.max(
      0,
      Math.min(100, (1 - quota.remainingFraction) * 100),
    );
    entries.push({
      modelId,
      usedPercent: Math.round(used * 10) / 10,
      resetTime: quota.resetTime,
    });
  }
  return entries;
}

async function resolveGeminiOAuthToken(): Promise<string | null> {
  const directToken = process.env.GOOGLE_OAUTH_ACCESS_TOKEN;
  if (directToken) {
    return directToken;
  }

  const opencodeToken = resolveGeminiTokenFromOpencode();
  if (opencodeToken) {
    return opencodeToken;
  }

  const opencodeGoogleAuth = readOpencodeGoogleAuth();
  const parsedRefresh = opencodeGoogleAuth?.refresh
    ? parseGoogleRefreshValue(opencodeGoogleAuth.refresh)
    : null;
  if (parsedRefresh?.refreshToken) {
    const refreshed = await refreshGoogleAccessToken(
      parsedRefresh.refreshToken,
    );
    if (refreshed) {
      persistOpencodeGoogleAccessToken(refreshed);
      return refreshed;
    }
  }

  const antigravityRefresh = resolveRefreshTokenFromAntigravity();
  if (antigravityRefresh) {
    const refreshed = await refreshGoogleAccessToken(antigravityRefresh);
    if (refreshed) {
      return refreshed;
    }
  }

  const gcloudPath = process.env.GCLOUD_CLI_PATH || "gcloud";
  try {
    const { execFileSync } = await import("node:child_process");
    const token = execFileSync(
      gcloudPath,
      ["auth", "application-default", "print-access-token"],
      {
        encoding: "utf8",
        timeout: 10000,
        stdio: ["ignore", "pipe", "ignore"],
      },
    ).trim();

    return token.length > 0 ? token : null;
  } catch {
    return null;
  }
}

export async function pollGeminiOfficial(db: unknown): Promise<PollResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  const opencodeGoogleAuth = readOpencodeGoogleAuth();
  const parsedRefresh = opencodeGoogleAuth?.refresh
    ? parseGoogleRefreshValue(opencodeGoogleAuth.refresh)
    : null;
  const projectIdFromAuth =
    parsedRefresh?.projectId ?? resolveProjectIdFromAntigravity();
  const oauthToken = apiKey ? null : await resolveGeminiOAuthToken();
  if (!apiKey && !oauthToken) {
    const cachedQuota = readAntigravityCachedQuota();
    if (cachedQuota.length > 0) {
      upsertProvider(
        db,
        "gemini",
        "Gemini (Antigravity Cached Quota)",
        "official",
      );
      insertUsageRecord(db, "gemini", "api", {
        source: "antigravity-cache",
        cachedQuota,
      });
      for (const item of cachedQuota) {
        upsertGeminiModelSnapshot(db, item.modelId, item.usedPercent);
      }

      return {
        provider: "gemini",
        mode: "official",
        ok: true,
        message: `cached quota loaded (${cachedQuota.length} models)`,
      };
    }

    return {
      provider: "gemini",
      mode: "official",
      ok: false,
      message: "GEMINI_API_KEY or GOOGLE_OAUTH_ACCESS_TOKEN not set",
    };
  }

  if (oauthToken) {
    const headers = {
      Authorization: `Bearer ${oauthToken}`,
      "Content-Type": "application/json",
    };

    const loadResponse = await fetch(
      "https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist",
      {
        method: "POST",
        headers,
        body: JSON.stringify({
          metadata: {
            ideType: "IDE_UNSPECIFIED",
            platform: "PLATFORM_UNSPECIFIED",
            pluginType: "GEMINI",
          },
        }),
      },
    );

    if (loadResponse.ok) {
      const loadPayload =
        (await loadResponse.json()) as GeminiLoadCodeAssistResponse;
      const projectId =
        loadPayload.cloudaicompanionProject || projectIdFromAuth || undefined;

      if (projectId) {
        const quotaResponse = await fetch(
          "https://cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota",
          {
            method: "POST",
            headers,
            body: JSON.stringify({ project: projectId }),
          },
        );

        if (quotaResponse.ok) {
          const quotaPayload =
            (await quotaResponse.json()) as GeminiRetrieveQuotaResponse;
          const buckets = quotaPayload.buckets ?? [];

          upsertProvider(
            db,
            "gemini",
            "Gemini (Cloud Code Assist)",
            "official",
          );
          insertUsageRecord(db, "gemini", "api", {
            load: loadPayload,
            quota: quotaPayload,
          });

          let count = 0;
          const activeRuleIds: string[] = [];
          for (const bucket of buckets) {
            const modelId = bucket.modelId;
            const remaining = bucket.remainingFraction;
            if (!modelId || typeof remaining !== "number") {
              continue;
            }

            const usedPercent = Math.max(
              0,
              Math.min(100, (1 - remaining) * 100),
            );
            activeRuleIds.push(toRuleId(modelId));
            upsertGeminiModelSnapshot(db, modelId, usedPercent);
            count += 1;
          }

          if (count > 0) {
            pruneProviderRules(db, "gemini", activeRuleIds);
            return {
              provider: "gemini",
              mode: "official",
              ok: true,
              message: `quota fetched (${count} models)`,
            };
          }
        }
      }
    }
  }

  const reachabilityResponse = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models",
    {
      headers: apiKey
        ? {
            "x-goog-api-key": apiKey,
          }
        : {
            Authorization: `Bearer ${oauthToken}`,
          },
    },
  );
  if (!reachabilityResponse.ok) {
    return {
      provider: "gemini",
      mode: "official",
      ok: false,
      message: `HTTP ${reachabilityResponse.status}`,
    };
  }

  const payload = await reachabilityResponse.json();
  upsertProvider(db, "gemini", "Gemini API", "official");
  insertUsageRecord(db, "gemini", "api", payload);

  return {
    provider: "gemini",
    mode: "official",
    ok: true,
    message: "api reachable (quota unavailable)",
  };
}
