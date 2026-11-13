import type { z } from "zod";
import { Errors, type ValidationIssue } from "./errors";

export const DEFAULT_JSON_LIMIT_BYTES = 32 * 1024;

/** Read a request body as bytes without ever buffering more than `maxBytes` (+1 chunk). */
export async function readBodyWithLimit(req: Request, maxBytes: number): Promise<Uint8Array> {
  const declared = req.headers.get("content-length");
  if (declared !== null && Number(declared) > maxBytes) throw Errors.payloadTooLarge(maxBytes);
  if (!req.body) return new Uint8Array();

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw Errors.payloadTooLarge(maxBytes);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

export function zodIssues(error: z.ZodError): ValidationIssue[] {
  // Messages and paths only — never echo submitted values.
  return error.issues.map((i) => ({ path: i.path.join(".") || "(root)", message: i.message }));
}

export function parseWithSchema<S extends z.ZodType>(schema: S, value: unknown): z.infer<S> {
  const result = schema.safeParse(value);
  if (!result.success) throw Errors.validation(zodIssues(result.error));
  return result.data;
}

/**
 * Parse and validate a JSON body.
 * - 415 unless Content-Type is application/json
 * - 413 above `maxBytes`
 * - 400 for malformed JSON or schema violations
 * An empty body is treated as `{}` so endpoints with all-optional fields accept bodyless POSTs.
 */
export async function readJson<S extends z.ZodType>(
  req: Request,
  schema: S,
  maxBytes = DEFAULT_JSON_LIMIT_BYTES,
): Promise<z.infer<S>> {
  const bytes = await readBodyWithLimit(req, maxBytes);
  let value: unknown = {};
  if (bytes.byteLength > 0) {
    const contentType = req.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("application/json")) {
      throw Errors.unsupportedMediaType("Content-Type must be application/json.");
    }
    try {
      value = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw Errors.badRequest("Request body is not valid JSON.");
    }
  }
  return parseWithSchema(schema, value);
}
