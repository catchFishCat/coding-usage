import type { PollResult } from "../../types.js";

async function resolveGeminiOAuthToken(): Promise<string | null> {
  const directToken = process.env.GOOGLE_OAUTH_ACCESS_TOKEN;
  if (directToken) {
    return directToken;
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

export async function probeGeminiExperimental(): Promise<PollResult> {
  const oauthToken = await resolveGeminiOAuthToken();
  if (oauthToken) {
    try {
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models",
        {
          headers: {
            Authorization: `Bearer ${oauthToken}`,
          },
        },
      );

      if (response.ok) {
        return {
          provider: "gemini",
          mode: "experimental",
          ok: true,
          message: "oauth token reachable",
        };
      }
    } catch {
      // Fallback to CLI probe.
    }
  }

  const cliPath = process.env.GEMINI_CLI_PATH || "gemini";

  try {
    const { execFileSync } = await import("node:child_process");
    const output = execFileSync(cliPath, ["/stats"], {
      encoding: "utf8",
      timeout: 10000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return {
      provider: "gemini",
      mode: "experimental",
      ok: true,
      message: output.trim()
        ? "gemini /stats available"
        : "gemini /stats returned empty output",
    };
  } catch (error) {
    return {
      provider: "gemini",
      mode: "experimental",
      ok: false,
      message:
        error instanceof Error ? error.message : "gemini cli probe failed",
    };
  }
}
