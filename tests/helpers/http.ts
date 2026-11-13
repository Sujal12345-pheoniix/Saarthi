import type { ApiResponse } from "@/lib/api/contracts";

export const BASE = "http://localhost:3000";

export function setClerkUser(clerkId: string | null) {
  (globalThis as unknown as { __setClerkUser: (id: string | null) => void }).__setClerkUser(clerkId);
}

/** Accepts any route handler regardless of its params type (Promise<never> is assignable to every Promise<P>). */
type Handler = (req: Request, ctx: { params: Promise<never> }) => Promise<Response>;

export async function call<T = unknown>(
  handler: Handler,
  init: {
    method?: string;
    path?: string;
    json?: unknown;
    body?: BodyInit;
    headers?: Record<string, string>;
    params?: Record<string, string>;
  } = {},
): Promise<{ status: number; body: ApiResponse<T>; headers: Headers }> {
  const headers: Record<string, string> = { ...(init.headers ?? {}) };
  let body: BodyInit | undefined = init.body;
  if (init.json !== undefined) {
    body = JSON.stringify(init.json);
    headers["content-type"] ??= "application/json";
    headers["content-length"] ??= String(Buffer.byteLength(body as string));
  }
  const req = new Request(`${BASE}${init.path ?? "/api/test"}`, { method: init.method ?? "GET", headers, body });
  const res = await handler(req, { params: Promise.resolve(init.params ?? {}) as Promise<never> });
  return { status: res.status, body: (await res.json()) as ApiResponse<T>, headers: res.headers };
}

export function multipart(fields: Record<string, string | { bytes: Uint8Array; type: string; name: string }>) {
  const boundary = "----saarthitest" + Math.random().toString(16).slice(2);
  const parts: Buffer[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === "string") {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`));
    } else {
      parts.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${key}"; filename="${value.name}"\r\nContent-Type: ${value.type}\r\n\r\n`,
        ),
        Buffer.from(value.bytes),
        Buffer.from("\r\n"),
      );
    }
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  const body = Buffer.concat(parts);
  return {
    body: new Uint8Array(body),
    headers: { "content-type": `multipart/form-data; boundary=${boundary}`, "content-length": String(body.length) },
  };
}
