import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import type { PollResult } from "../../types.js";

function resolveKimiApiKeyFromOpencode(): string | null {
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
      "kimi-for-coding"?: { key?: string };
      "moonshotai-cn"?: { key?: string };
    };

    const kimiForCoding = parsed["kimi-for-coding"]?.key?.trim();
    if (kimiForCoding) {
      return kimiForCoding;
    }

    const moonshot = parsed["moonshotai-cn"]?.key?.trim();
    if (moonshot) {
      return moonshot;
    }
  } catch {
    return null;
  }

  return null;
}

export async function probeKimiExperimental(): Promise<PollResult> {
  const apiKey =
    process.env.KIMI_CODE_API_KEY ||
    process.env.MOONSHOT_API_KEY ||
    resolveKimiApiKeyFromOpencode();
  const consoleSessionToken = process.env.KIMI_CONSOLE_SESSION_TOKEN;

  if (consoleSessionToken) {
    const consoleResponse = await fetch(
      "https://www.kimi.com/apiv2/kimi.gateway.billing.v1.BillingService/GetUsages",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${consoleSessionToken}`,
          "Content-Type": "application/json",
          Origin: "https://www.kimi.com",
          Referer: "https://www.kimi.com/code/console",
        },
        body: JSON.stringify({ scope: ["FEATURE_CODING"] }),
      },
    );

    if (consoleResponse.ok) {
      return {
        provider: "kimi",
        mode: "experimental",
        ok: true,
        message: "console usage endpoint reachable",
      };
    }
  }

  if (!apiKey) {
    return {
      provider: "kimi",
      mode: "experimental",
      ok: false,
      message:
        "MOONSHOT_API_KEY/KIMI_CODE_API_KEY or KIMI_CONSOLE_SESSION_TOKEN not set",
    };
  }

  const codingUsageResponse = await fetch(
    "https://api.kimi.com/coding/v1/usages",
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (codingUsageResponse.ok) {
    return {
      provider: "kimi",
      mode: "experimental",
      ok: true,
      message: "coding usage endpoint reachable",
    };
  }

  const response = await fetch("https://api.moonshot.ai/v1/users/me/balance", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    return {
      provider: "kimi",
      mode: "experimental",
      ok: false,
      message: `alt host HTTP ${response.status}`,
    };
  }

  return {
    provider: "kimi",
    mode: "experimental",
    ok: true,
    message: "alternate moonshot host reachable",
  };
}

export function kimiAuthNotes(): string[] {
  return [
    "Official polling first tries Kimi For Coding usage endpoint at api.kimi.com/coding/v1/usages.",
    "KIMI_CODE_API_KEY can be set explicitly; otherwise MOONSHOT_API_KEY and opencode auth keys are auto-discovered.",
    "Legacy fallback uses MOONSHOT_API_KEY against api.moonshot.cn (or MOONSHOT_BASE_URL when set).",
    "Experimental probing reuses MOONSHOT_API_KEY against alternate host api.moonshot.ai.",
    "Kimi Code console session token can be used for usage probing at www.kimi.com/code/console endpoints.",
  ];
}
