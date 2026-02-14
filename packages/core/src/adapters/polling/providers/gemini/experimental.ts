import type { PollResult } from "../../types.js";

export async function probeGeminiExperimental(): Promise<PollResult> {
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
