import { getEnv } from "@/lib/config/env";
import {
  fitnessCvResultSchema,
  skinCvResultSchema,
  type FitnessCvResult,
  type SkinCvResult,
} from "@/features/analysis/cv-contract";
import { AnalysisFailure } from "@/server/services/analysis-errors";

/**
 * Client for the Python CV service. Sends image BYTES (multipart) — the service never fetches URLs.
 * Authenticated with a shared bearer token (AI_SERVICE_TOKEN).
 */

export interface CvClient {
  analyzeSkin(image: Uint8Array, mimeType: string): Promise<{ result: SkinCvResult; raw: unknown; durationMs: number }>;
  analyzeFitness(
    image: Uint8Array,
    mimeType: string,
  ): Promise<{ result: FitnessCvResult; raw: unknown; durationMs: number }>;
}

async function call(kind: "skin" | "fitness", image: Uint8Array, mimeType: string, fetchImpl: typeof fetch) {
  const cfg = getEnv().aiService;
  if (!cfg)
    throw new AnalysisFailure("CV_NOT_CONFIGURED", "Image analysis is not configured on this deployment.", false);

  const form = new FormData();
  form.append("image", new Blob([Buffer.from(image)], { type: mimeType }), `upload.${mimeType.split("/")[1] ?? "img"}`);

  const started = Date.now();
  let response: Response;
  try {
    response = await fetchImpl(`${cfg.url}/v1/analyze/${kind}`, {
      method: "POST",
      body: form,
      headers: cfg.token ? { authorization: `Bearer ${cfg.token}` } : {},
      signal: AbortSignal.timeout(cfg.timeoutMs),
      redirect: "error",
    });
  } catch (error) {
    const timedOut = (error as Error)?.name === "TimeoutError";
    throw new AnalysisFailure(
      timedOut ? "CV_TIMEOUT" : "CV_UNREACHABLE",
      "The analysis service did not respond. We will retry automatically.",
      true,
      error,
    );
  }

  const durationMs = Date.now() - started;
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (response.status === 422) {
    // Image-quality rejections from our own service carry a user-safe `detail` string.
    const detail = (body as { detail?: unknown } | null)?.detail;
    const message =
      typeof detail === "string" && detail.length < 300
        ? detail
        : "The image could not be analysed. Please try a clearer photo.";
    throw new AnalysisFailure("IMAGE_REJECTED", message, false);
  }
  if (response.status === 401 || response.status === 403) {
    throw new AnalysisFailure("CV_AUTH_FAILED", "The analysis service rejected our credentials.", false);
  }
  if (response.status === 413 || response.status === 415 || response.status === 400) {
    throw new AnalysisFailure("CV_BAD_INPUT", "The image could not be processed.", false);
  }
  if (!response.ok) {
    throw new AnalysisFailure(
      "CV_ERROR",
      "The analysis service had a temporary problem. We will retry.",
      response.status >= 500 || response.status === 429,
    );
  }

  const schema = kind === "skin" ? skinCvResultSchema : fitnessCvResultSchema;
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new AnalysisFailure("CV_INVALID_RESPONSE", "The analysis service returned an unexpected result.", false);
  }
  return { result: parsed.data, raw: body, durationMs };
}

export function createCvClient(fetchImpl: typeof fetch = fetch): CvClient {
  return {
    analyzeSkin: async (image, mimeType) => {
      const r = await call("skin", image, mimeType, fetchImpl);
      return r as { result: SkinCvResult; raw: unknown; durationMs: number };
    },
    analyzeFitness: async (image, mimeType) => {
      const r = await call("fitness", image, mimeType, fetchImpl);
      return r as { result: FitnessCvResult; raw: unknown; durationMs: number };
    },
  };
}
