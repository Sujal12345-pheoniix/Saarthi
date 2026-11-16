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

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Aborted", "AbortError"));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

export function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
}

/**
 * Polls GET /api/report/{analysisId} until COMPLETED, FAILED or CANCELLED. Pass an AbortSignal so leaving the
 * page stops polling (the analysis itself keeps running and its report appears on the Reports page).
 */
export async function pollAnalysis<R>(
  analysisId: string,
  onStatus: (status: string) => void,
  { intervalMs = 1500, timeoutMs = 180_000, signal }: { intervalMs?: number; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<R> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const data = await apiRequest<{ status: string; report?: R; error?: string }>(
      `/api/report/${encodeURIComponent(analysisId)}`,
      { signal },
    );
    if (data.status === "COMPLETED" && data.report) return data.report;
    if (data.status === "FAILED")
      throw new ApiClientError(data.error ?? "The analysis failed.", "ANALYSIS_FAILED", 200);
    if (data.status === "CANCELLED") throw new ApiClientError("The analysis was cancelled.", "ANALYSIS_CANCELLED", 200);
    onStatus(data.status);
    if (Date.now() > deadline) {
      throw new ApiClientError(
        "The analysis is taking longer than expected. Check back on the Reports page.",
        "POLL_TIMEOUT",
        200,
      );
    }
    await sleep(intervalMs, signal);
  }
}

export interface UploadedImage {
  assetId: string;
  previewUrl: string | null;
}

/**
 * Uploads a photo to /api/upload. Uses XMLHttpRequest because fetch() cannot report upload progress.
 * `onProgress` receives 0–100.
 */
export function uploadImage(
  file: File,
  purpose: "skin" | "physical",
  { onProgress, signal }: { onProgress?: (pct: number) => void; signal?: AbortSignal } = {},
): Promise<UploadedImage> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", file);
    form.append("purpose", purpose);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.responseType = "text";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onerror = () => reject(new ApiClientError("Network error while uploading. Check your connection.", "NETWORK", 0));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));
    xhr.onload = () => {
      let payload: ApiResponse<UploadedImage> | null = null;
      try {
        payload = JSON.parse(xhr.responseText) as ApiResponse<UploadedImage>;
      } catch {
        return reject(new ApiClientError(`Unexpected response from server (${xhr.status}).`, "BAD_RESPONSE", xhr.status));
      }
      if (!payload.success) {
        return reject(new ApiClientError(payload.error.message, payload.error.code, xhr.status, payload.requestId));
      }
      onProgress?.(100);
      resolve(payload.data);
    };
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(form);
  });
}
