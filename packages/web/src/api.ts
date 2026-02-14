/**
 * API utilities for fetching quota status
 */

import type { StatusResponse } from "./types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

function endpoint(path: string): string {
  if (!API_BASE_URL) {
    return path;
  }
  return `${API_BASE_URL}${path}`;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: Response,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function fetchStatus(): Promise<StatusResponse> {
  let response: Response;
  try {
    response = await fetch(endpoint("/status"), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });
  } catch {
    throw new ApiError(
      "Cannot reach local API server. Start `pnpm daemon` and retry.",
    );
  }

  if (!response.ok) {
    throw new ApiError(
      `HTTP error! status: ${response.status}`,
      response.status,
      response,
    );
  }

  const data: StatusResponse = await response.json();
  return data;
}

export async function checkHealth(): Promise<boolean> {
  try {
    const response = await fetch(endpoint("/health"), {
      method: "GET",
      signal: AbortSignal.timeout(3000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
