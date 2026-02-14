import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";

import type { AuthLoginOptions } from "../types.js";

type ProviderId = "codex" | "gemini" | "kimi";

interface ProviderAuthConfig {
  loginCommand: string;
  loginArgs: string[];
  discoveredEnv: string[];
}

const PROVIDER_AUTH: Record<ProviderId, ProviderAuthConfig> = {
  codex: {
    loginCommand: "codex",
    loginArgs: ["login"],
    discoveredEnv: ["OPENAI_OAUTH_ACCESS_TOKEN", "OPENAI_ACCOUNT_ID"],
  },
  gemini: {
    loginCommand: "gcloud",
    loginArgs: ["auth", "application-default", "login"],
    discoveredEnv: ["GOOGLE_OAUTH_ACCESS_TOKEN"],
  },
  kimi: {
    loginCommand: "kimi",
    loginArgs: ["login"],
    discoveredEnv: ["KIMI_CONSOLE_SESSION_TOKEN"],
  },
};

const PROVIDER_INSTALL_HINT: Record<ProviderId, string> = {
  codex: "Install Codex CLI: npm i -g @openai/codex",
  gemini: "Install gcloud CLI and run: gcloud auth application-default login",
  kimi: "Install Kimi CLI and ensure `kimi` is in PATH.",
};

function getEnvFilePath(): string {
  return path.resolve(process.cwd(), ".env.local");
}

function upsertEnvVar(filePath: string, key: string, value: string): void {
  const content = fs.existsSync(filePath)
    ? fs.readFileSync(filePath, "utf8")
    : "";

  const lines = content.length > 0 ? content.split(/\r?\n/) : [];
  const pattern = new RegExp(`^${key}=`);

  let updated = false;
  const nextLines = lines.map((line) => {
    if (pattern.test(line)) {
      updated = true;
      return `${key}=${value}`;
    }
    return line;
  });

  if (!updated) {
    if (nextLines.length > 0 && nextLines[nextLines.length - 1] !== "") {
      nextLines.push("");
    }
    nextLines.push(`${key}=${value}`);
  }

  const out = `${nextLines.join("\n").replace(/\n+$/g, "")}\n`;
  fs.writeFileSync(filePath, out, "utf8");
}

function getEnvVarValue(filePath: string, key: string): string | null {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, "utf8");
  const line = content
    .split(/\r?\n/)
    .find((row) => row.trim().startsWith(`${key}=`));
  if (!line) {
    return null;
  }

  return line.slice(key.length + 1) || null;
}

function mask(value: string | null): string {
  if (!value) {
    return "missing";
  }
  if (value.length <= 8) {
    return "set";
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function runLoginCommand(command: string, args: string[]): boolean {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  return result.status === 0;
}

function hasCommand(command: string): boolean {
  const checker = process.platform === "win32" ? "where" : "which";
  const result = spawnSync(checker, [command], {
    stdio: "ignore",
    shell: process.platform === "win32",
  });
  return result.status === 0;
}

function discoverCodexAuth(): Record<string, string> {
  const home = os.homedir();
  const authPaths = [
    path.join(home, ".codex", "auth.json"),
    path.join(home, ".config", "codex", "auth.json"),
  ];

  for (const authPath of authPaths) {
    if (!fs.existsSync(authPath)) {
      continue;
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(authPath, "utf8")) as {
        tokens?: { access_token?: string; account_id?: string };
      };
      const token = parsed.tokens?.access_token?.trim();
      if (!token) {
        continue;
      }

      const out: Record<string, string> = {
        OPENAI_OAUTH_ACCESS_TOKEN: token,
      };
      const accountId = parsed.tokens?.account_id?.trim();
      if (accountId) {
        out.OPENAI_ACCOUNT_ID = accountId;
      }
      return out;
    } catch {
      continue;
    }
  }

  return {};
}

function discoverGeminiAuth(): Record<string, string> {
  const home = os.homedir();
  const oauthPaths = [
    path.join(home, ".gemini", "oauth_creds.json"),
    path.join(home, ".config", "gemini", "oauth_creds.json"),
  ];

  for (const oauthPath of oauthPaths) {
    if (!fs.existsSync(oauthPath)) {
      continue;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(oauthPath, "utf8")) as {
        access_token?: string;
      };
      const token = parsed.access_token?.trim();
      if (token) {
        return { GOOGLE_OAUTH_ACCESS_TOKEN: token };
      }
    } catch {
      continue;
    }
  }

  try {
    const gcloudPath = process.env.GCLOUD_CLI_PATH || "gcloud";
    const token = execFileSync(
      gcloudPath,
      ["auth", "application-default", "print-access-token"],
      {
        encoding: "utf8",
        timeout: 10000,
        stdio: ["ignore", "pipe", "ignore"],
      },
    ).trim();

    if (token) {
      return { GOOGLE_OAUTH_ACCESS_TOKEN: token };
    }
  } catch {
    return {};
  }

  return {};
}

function discoverKimiAuth(): Record<string, string> {
  const pySnippet = [
    "import json, keyring",
    "raw=keyring.get_password('kimi-code','oauth/kimi-code')",
    "print(raw or '')",
  ].join(";");

  const interpreters: Array<[string, string[]]> = [
    ["python", ["-c", pySnippet]],
    ["py", ["-3", "-c", pySnippet]],
  ];

  for (const [cmd, args] of interpreters) {
    try {
      const raw = execFileSync(cmd, args, {
        encoding: "utf8",
        timeout: 10000,
        stdio: ["ignore", "pipe", "ignore"],
      }).trim();

      if (!raw) {
        continue;
      }

      const parsed = JSON.parse(raw) as { access_token?: string };
      const token = parsed.access_token?.trim();
      if (token) {
        return { KIMI_CONSOLE_SESSION_TOKEN: token };
      }
    } catch {
      continue;
    }
  }

  return {};
}

function discoverProviderAuth(providerId: ProviderId): Record<string, string> {
  if (providerId === "codex") {
    return discoverCodexAuth();
  }
  if (providerId === "gemini") {
    return discoverGeminiAuth();
  }
  return discoverKimiAuth();
}

export async function authLogin(
  provider: string,
  _options: AuthLoginOptions = {},
): Promise<void> {
  const providerId = provider as ProviderId;
  const config = PROVIDER_AUTH[providerId];

  if (!config) {
    console.error(
      `Unsupported provider '${provider}'. Use one of: codex, gemini, kimi.`,
    );
    return;
  }

  console.log(
    `Running login flow: ${config.loginCommand} ${config.loginArgs.join(" ")}`,
  );
  let loginOk = false;

  if (hasCommand(config.loginCommand)) {
    loginOk = runLoginCommand(config.loginCommand, config.loginArgs);
  } else if (providerId === "codex") {
    console.log("'codex' not found, trying: npx -y @openai/codex login");
    loginOk = runLoginCommand("npx", ["-y", "@openai/codex", "login"]);
  } else if (providerId === "gemini") {
    if (hasCommand("gemini")) {
      console.log("'gcloud' not found, trying installed Gemini CLI: gemini");
      loginOk = runLoginCommand("gemini", []);
    } else {
      console.log("'gcloud' not found, trying: npx -y @google/gemini-cli");
      loginOk = runLoginCommand("npx", ["-y", "@google/gemini-cli"]);
    }
  } else if (providerId === "kimi") {
    console.log("'kimi' not found, trying: python -m kimi_cli login");
    loginOk = runLoginCommand("python", ["-m", "kimi_cli", "login"]);
  }

  if (!loginOk) {
    console.error(`Login command failed. ${PROVIDER_INSTALL_HINT[providerId]}`);
    return;
  }

  const discovered = discoverProviderAuth(providerId);
  const keys = Object.keys(discovered);
  if (keys.length === 0) {
    console.error("Login finished, but no token/key could be auto-discovered.");
    return;
  }

  const envPath = getEnvFilePath();
  for (const [key, value] of Object.entries(discovered)) {
    upsertEnvVar(envPath, key, value);
    console.log(`Saved ${key} to ${envPath}`);
  }

  const missing = config.discoveredEnv.filter((key) => !discovered[key]);
  if (missing.length > 0) {
    console.log(`Not discovered: ${missing.join(", ")}`);
  }

  console.log("Run: pnpm cli collect --experimental");
}

export async function authStatus(): Promise<void> {
  const envPath = getEnvFilePath();

  const codex =
    getEnvVarValue(envPath, "OPENAI_OAUTH_ACCESS_TOKEN") ||
    getEnvVarValue(envPath, "CHATGPT_SESSION_TOKEN");
  const gemini =
    getEnvVarValue(envPath, "GEMINI_API_KEY") ||
    getEnvVarValue(envPath, "GOOGLE_OAUTH_ACCESS_TOKEN");
  const kimi =
    getEnvVarValue(envPath, "KIMI_CONSOLE_SESSION_TOKEN") ||
    getEnvVarValue(envPath, "MOONSHOT_API_KEY");

  console.log("Auth status (.env.local):");
  console.log(`- codex:  ${mask(codex)}`);
  console.log(`- gemini: ${mask(gemini)}`);
  console.log(`- kimi:   ${mask(kimi)}`);
}
