import type { Redis } from "ioredis";
import { Errors } from "@/lib/api/errors";
import { logger } from "@/lib/logging/logger";

/**
 * Fixed-window rate limiting.
 *
 * Store selection (lib/security/rate-limit-store.ts decides at runtime):
 * - Redis (shared across instances) whenever REDIS_URL is configured.
 * - In-memory (per process) otherwise — adequate for local development only.
 * If Redis errors, the limiter fails OPEN and logs a warning: availability is preferred over blocking all
 * users during a Redis outage. Documented in docs/SECURITY_ARCHITECTURE.md.
 */

export interface RateLimitRule {
  /** Stable bucket name, e.g. "upload". */
  name: string;
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetSeconds: number;
}

export interface RateLimitStore {
  hit(key: string, windowSeconds: number): Promise<{ count: number; ttlSeconds: number }>;
}

export class RedisRateLimitStore implements RateLimitStore {
  constructor(private readonly redis: Redis) {}

  async hit(key: string, windowSeconds: number) {
    const results = await this.redis.multi().incr(key).ttl(key).exec();
    if (!results) throw new Error("rate limit transaction aborted");
    const [incrErr, count] = results[0] ?? [];
    const [ttlErr, ttlRaw] = results[1] ?? [];
    if (incrErr) throw incrErr;
    if (ttlErr) throw ttlErr;
    let ttl = Number(ttlRaw);
    // -1 = key has no expiry (first hit in this window, or a lost EXPIRE). Portable across Redis versions.
    if (ttl < 0) {
      await this.redis.expire(key, windowSeconds);
      ttl = windowSeconds;
    }
    return { count: Number(count), ttlSeconds: Math.max(1, ttl) };
  }
}

export class MemoryRateLimitStore implements RateLimitStore {
  private readonly buckets = new Map<string, { count: number; resetAt: number }>();

  async hit(key: string, windowSeconds: number) {
    const now = Date.now();
    const current = this.buckets.get(key);
    if (!current || current.resetAt <= now) {
      const fresh = { count: 1, resetAt: now + windowSeconds * 1000 };
      this.buckets.set(key, fresh);
      return { count: 1, ttlSeconds: windowSeconds };
    }
    current.count += 1;
    return { count: current.count, ttlSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)) };
  }
}

export async function checkRateLimit(
  store: RateLimitStore,
  rule: RateLimitRule,
  subject: string,
): Promise<RateLimitResult> {
  const key = `saarthi:rl:${rule.name}:${subject}`;
  try {
    const { count, ttlSeconds } = await store.hit(key, rule.windowSeconds);
    return { allowed: count <= rule.limit, remaining: Math.max(0, rule.limit - count), resetSeconds: ttlSeconds };
  } catch (error) {
    logger.warn("rate_limit.store_unavailable", { rule: rule.name, error });
    return { allowed: true, remaining: rule.limit, resetSeconds: rule.windowSeconds };
  }
}

export async function enforceRateLimit(
  store: RateLimitStore,
  rule: RateLimitRule,
  subject: string,
): Promise<RateLimitResult> {
  const result = await checkRateLimit(store, rule, subject);
  if (!result.allowed) throw Errors.rateLimited(result.resetSeconds);
  return result;
}

/** Per-route budgets. Tune with production data in Phase 4. */
export const RATE_LIMITS = {
  read: { name: "read", limit: 120, windowSeconds: 60 },
  upload: { name: "upload", limit: 20, windowSeconds: 600 },
  analysis: { name: "analysis", limit: 20, windowSeconds: 600 },
  questionnaire: { name: "questionnaire", limit: 30, windowSeconds: 600 },
  combinedReport: { name: "combined-report", limit: 5, windowSeconds: 3600 },
  accountExport: { name: "account-export", limit: 3, windowSeconds: 3600 },
  accountDelete: { name: "account-delete", limit: 3, windowSeconds: 3600 },
} satisfies Record<string, RateLimitRule>;
