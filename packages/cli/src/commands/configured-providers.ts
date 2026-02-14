import type { ConfiguredProvidersOptions } from "../types.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

type ProviderSignal = {
  key: string;
};

type ProviderConfig = {
  id: string;
  name: string;
  signals: ProviderSignal[];
  extraSignals?: Array<() => { key: string; value: string | null }>;
};

function readOpencodeCopilotToken(): string | null {
  const authPath = path.join(
    os.homedir(),
    ".local",
    "share",
    "opencode",
    "auth.json",
  );
  if (!fs.existsSync(authPath)) {
    return null;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(authPath, "utf8")) as {
      "github-copilot"?: {
        access?: string;
        refresh?: string;
      };
    };
    const access = parsed["github-copilot"]?.access?.trim();
    if (access) {
      return access;
    }
    const refresh = parsed["github-copilot"]?.refresh?.trim();
    return refresh || null;
  } catch {
    return null;
  }
}

const PROVIDER_CONFIGS: ProviderConfig[] = [
  {
    id: "codex",
    name: "Codex",
    signals: [
      { key: "OPENAI_ADMIN_KEY" },
      { key: "OPENAI_OAUTH_ACCESS_TOKEN" },
      { key: "CHATGPT_SESSION_TOKEN" },
    ],
  },
  {
    id: "gemini",
    name: "Gemini",
    signals: [
      { key: "GEMINI_API_KEY" },
      { key: "GOOGLE_OAUTH_ACCESS_TOKEN" },
      { key: "GOOGLE_OAUTH_CLIENT_ID" },
      { key: "GOOGLE_OAUTH_CLIENT_SECRET" },
    ],
  },
  {
    id: "kimi",
    name: "Kimi",
    signals: [
      { key: "KIMI_CODE_API_KEY" },
      { key: "MOONSHOT_API_KEY" },
      { key: "KIMI_CONSOLE_SESSION_TOKEN" },
    ],
  },
  {
    id: "glm",
    name: "GLM",
    signals: [{ key: "ZHIPU_AUTH_TOKEN" }],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    signals: [{ key: "OPENROUTER_API_KEY" }],
  },
  {
    id: "github-copilot",
    name: "GitHub Copilot",
    signals: [{ key: "GITHUB_COPILOT_TOKEN" }, { key: "GITHUB_TOKEN" }],
    extraSignals: [
      () => ({
        key: "OPENCODE_GITHUB_COPILOT",
        value: readOpencodeCopilotToken(),
      }),
    ],
  },
];

function hasValue(key: string): boolean {
  const value = process.env[key];
  return typeof value === "string" && value.trim().length > 0;
}

function maskValue(key: string): string {
  const value = process.env[key]?.trim();
  return maskRawValue(value ?? null);
}

function maskRawValue(value: string | null): string {
  if (!value) {
    return "missing";
  }
  if (value.length <= 8) {
    return "set";
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export async function listConfiguredProviders(
  options: ConfiguredProvidersOptions = {},
): Promise<void> {
  const rows = PROVIDER_CONFIGS.map((provider) => {
    const activeSignals = provider.signals
      .filter((signal) => hasValue(signal.key))
      .map((signal) => signal.key);
    const extraSignalStatus = (provider.extraSignals ?? []).map((factory) => {
      const item = factory();
      return {
        key: item.key,
        value: item.value ? maskRawValue(item.value) : "missing",
      };
    });

    for (const signal of extraSignalStatus) {
      if (signal.value !== "missing") {
        activeSignals.push(signal.key);
      }
    }

    return {
      id: provider.id,
      name: provider.name,
      configured: activeSignals.length > 0,
      activeSignals,
      signalStatus: provider.signals
        .map((signal) => ({
          key: signal.key,
          value: maskValue(signal.key),
        }))
        .concat(extraSignalStatus),
    };
  });

  const filtered = options.all ? rows : rows.filter((row) => row.configured);

  if (options.json) {
    console.log(JSON.stringify(filtered, null, 2));
    return;
  }

  if (filtered.length === 0) {
    console.log("No configured providers found.");
    console.log("Tip: run `coding-usage auth login <provider>` first.");
    return;
  }

  console.log("Configured providers:");
  for (const row of filtered) {
    const status = row.configured ? "configured" : "not configured";
    console.log(`- ${row.name} (${row.id}): ${status}`);
    if (row.activeSignals.length > 0) {
      console.log(`  signals: ${row.activeSignals.join(", ")}`);
    }
    if (options.all) {
      for (const signal of row.signalStatus) {
        console.log(`  ${signal.key}: ${signal.value}`);
      }
    }
  }
}
