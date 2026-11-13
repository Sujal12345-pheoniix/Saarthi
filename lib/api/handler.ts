import { randomUUID } from "node:crypto";
import { requireUser, type SessionUser } from "@/lib/auth/session";
import { getEnv } from "@/lib/config/env";
import { logger, type Logger } from "@/lib/logging/logger";
import { getProducerConnection } from "@/lib/queue/connection";
import { assertSameOrigin } from "@/lib/security/origin";
import {
  enforceRateLimit,
  MemoryRateLimitStore,
  RedisRateLimitStore,
  type RateLimitRule,
  type RateLimitStore,
} from "@/lib/security/rate-limit";
import { API_VERSION, type ApiFailure, type ApiSuccess } from "./contracts";
import { AppError, isAppError } from "./errors";

/**
 * Route handler wrapper: request id, structured logging, origin check, authentication, rate limiting,
 * and the uniform response envelope. Every API route uses it.
 */

type Params = Record<string, string | string[] | undefined>;

export interface RouteContext<P extends Params> {
  params: Promise<P>;
}

interface BaseArgs<P extends Params> {
  req: Request;
  params: P;
  requestId: string;
  log: Logger;
}

export interface AuthedArgs<P extends Params> extends BaseArgs<P> {
  user: SessionUser;
}

const REQUEST_ID_RE = /^[A-Za-z0-9._-]{8,128}$/;

let memoryStore: MemoryRateLimitStore | undefined;
let storeOverride: RateLimitStore | undefined;

/** Tests inject a store; production picks Redis when configured. */
export function setRateLimitStoreForTesting(store: RateLimitStore | undefined) {
  storeOverride = store;
}

function rateLimitStore(): RateLimitStore {
  if (storeOverride) return storeOverride;
  if (getEnv().redisUrl) return new RedisRateLimitStore(getProducerConnection());
  memoryStore ??= new MemoryRateLimitStore();
  return memoryStore;
}

function baseHeaders(requestId: string): Record<string, string> {
  return { "x-request-id": requestId, "x-api-version": API_VERSION, "cache-control": "no-store" };
}

export function jsonOk<T>(data: T, requestId: string, status = 200): Response {
  const body: ApiSuccess<T> = { success: true, data, requestId };
  return Response.json(body, { status, headers: baseHeaders(requestId) });
}

export function jsonError(error: AppError, requestId: string): Response {
  const body: ApiFailure = {
    success: false,
    error: {
      code: error.code,
      message: error.expose ? error.message : "Something went wrong. Please try again.",
      ...(error.expose && error.details !== undefined ? { details: error.details } : {}),
    },
    requestId,
  };
  return Response.json(body, { status: error.status, headers: { ...baseHeaders(requestId), ...error.headers } });
}

function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error;
  return new AppError("INTERNAL_ERROR", "Internal error", 500, { expose: false, cause: error });
}

interface CommonOptions {
  rateLimit?: RateLimitRule;
}

async function run<P extends Params>(
  req: Request,
  ctx: RouteContext<P> | undefined,
  execute: (base: BaseArgs<P>) => Promise<unknown>,
): Promise<Response> {
  const incoming = req.headers.get("x-request-id");
  const requestId = incoming && REQUEST_ID_RE.test(incoming) ? incoming : randomUUID();
  const path = new URL(req.url).pathname;
  const log = logger.child({ requestId, method: req.method, path });
  const started = Date.now();
  try {
    const env = getEnv();
    assertSameOrigin(req, { appUrl: env.appUrl, allowedOrigins: env.allowedOrigins });
    const params = ((await ctx?.params) ?? {}) as P;
    const result = await execute({ req, params, requestId, log });
    const response = result instanceof Response ? result : jsonOk(result, requestId);
    if (!response.headers.has("x-request-id")) response.headers.set("x-request-id", requestId);
    log.info("request.completed", { status: response.status, durationMs: Date.now() - started });
    return response;
  } catch (error) {
    const appError = toAppError(error);
    const level = appError.status >= 500 ? "error" : "info";
    log[level]("request.failed", {
      status: appError.status,
      code: appError.code,
      durationMs: Date.now() - started,
      ...(appError.status >= 500 ? { error: (appError.cause as Error | undefined) ?? appError } : {}),
    });
    return jsonError(appError, requestId);
  }
}

/** Authenticated route. The handler receives the server-resolved user; never read user ids from the request. */
export function withAuth<P extends Params = Record<string, never>>(
  options: CommonOptions,
  handler: (args: AuthedArgs<P>) => Promise<unknown>,
) {
  return (req: Request, ctx: RouteContext<P>) =>
    run<P>(req, ctx, async (base) => {
      const user = await requireUser();
      const log = base.log.child({ userId: user.id });
      if (options.rateLimit && getEnv().rateLimitEnabled) {
        await enforceRateLimit(rateLimitStore(), options.rateLimit, `user:${user.id}`);
      }
      return handler({ ...base, log, user });
    });
}

/** Public route (health checks only). */
export function withPublic<P extends Params = Record<string, never>>(handler: (args: BaseArgs<P>) => Promise<unknown>) {
  return (req: Request, ctx: RouteContext<P>) => run<P>(req, ctx, handler);
}
