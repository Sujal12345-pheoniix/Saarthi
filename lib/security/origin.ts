import { Errors } from "@/lib/api/errors";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function originOf(value: string | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * CSRF defence in depth for cookie-authenticated, state-changing requests.
 *
 * Browsers always send `Origin` on cross-origin fetch/form POSTs. We reject a state-changing request when
 * an Origin header is present and is neither the request's own origin nor an explicitly allowed origin.
 * Requests without Origin (server-to-server, curl) are not browser CSRF vectors and are allowed; they still
 * need a valid session. No CORS headers are emitted anywhere, so cross-origin *reads* stay blocked too.
 */
export function assertSameOrigin(req: Request, allowed: { appUrl?: string; allowedOrigins: string[] }): void {
  if (SAFE_METHODS.has(req.method.toUpperCase())) return;
  const origin = req.headers.get("origin");
  if (origin === null) return;
  if (origin === "null") throw Errors.badOrigin();

  const permitted = new Set<string>();
  const self = originOf(req.url);
  if (self) permitted.add(self);
  const app = originOf(allowed.appUrl);
  if (app) permitted.add(app);
  for (const o of allowed.allowedOrigins) {
    const normalized = originOf(o);
    if (normalized) permitted.add(normalized);
  }
  if (!permitted.has(origin)) throw Errors.badOrigin();
}
