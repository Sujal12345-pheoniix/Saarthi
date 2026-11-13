"use client";

import type { ApiResponse } from "./contracts";

/** Browser helper for Saarthi API routes. Unwraps the response envelope and throws ApiClientError on failure. */

export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function apiRequest<T>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...(headers ?? {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  let payload: ApiResponse<T> | null = null;
  try {
    payload = (await res.json()) as ApiResponse<T>;
  } catch {
    throw new ApiClientError(`Unexpected response from server (${res.status}).`, "BAD_RESPONSE", res.status);
  }
  if (!payload.success) {
    throw new ApiClientError(payload.error.message, payload.error.code, res.status, payload.requestId);
  }
  return payload.data;
}

export function newIdempotencyKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Polls GET /api/report/{analysisId} until COMPLETED or FAILED. */
export async function pollAnalysis<R>(
  analysisId: string,
  onStatus: (status: string) => void,
  { intervalMs = 1500, timeoutMs = 180_000 } = {},
): Promise<R> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const data = await apiRequest<{ status: string; report?: R; error?: string }>(
      `/api/report/${encodeURIComponent(analysisId)}`,
    );
    if (data.status === "COMPLETED" && data.report) return data.report;
    if (data.status === "FAILED")
      throw new ApiClientError(data.error ?? "The analysis failed.", "ANALYSIS_FAILED", 200);
    onStatus(data.status);
    if (Date.now() > deadline) {
      throw new ApiClientError(
        "The analysis is taking longer than expected. Check back on the Reports page.",
        "POLL_TIMEOUT",
        200,
      );
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

export async function uploadImage(
  file: File,
  purpose: "skin" | "physical",
): Promise<{ assetId: string; previewUrl: string | null }> {
  const form = new FormData();
  form.append("file", file);
  form.append("purpose", purpose);
  return apiRequest("/api/upload", { method: "POST", body: form });
}
