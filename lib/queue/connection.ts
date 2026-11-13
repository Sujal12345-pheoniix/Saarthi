import IORedis, { type Redis } from "ioredis";
import { getEnv } from "@/lib/config/env";

/**
 * Redis connections are created lazily from validated config — importing this module never connects.
 *
 * - Producer (web): fails fast. `enableOfflineQueue: false` makes commands reject immediately while
 *   disconnected instead of hanging the HTTP request.
 * - Worker: `maxRetriesPerRequest: null` as BullMQ requires for blocking commands.
 */

const g = globalThis as typeof globalThis & { __saarthiRedisProducer?: Redis; __saarthiRedisShared?: Redis };

export function isRedisConfigured(): boolean {
  return Boolean(getEnv().redisUrl);
}

function requireUrl(): string {
  const url = getEnv().redisUrl;
  if (!url) throw new Error("REDIS_URL is not configured.");
  return url;
}

export function getProducerConnection(): Redis {
  if (!g.__saarthiRedisProducer) {
    g.__saarthiRedisProducer = new IORedis(requireUrl(), {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 5_000,
      lazyConnect: false,
    });
    // Errors surface on the commands themselves; this listener only prevents unhandled-error crashes.
    g.__saarthiRedisProducer.on("error", () => undefined);
  }
  return g.__saarthiRedisProducer;
}

export function createWorkerConnection(): Redis {
  return new IORedis(requireUrl(), { maxRetriesPerRequest: null });
}

export async function closeProducerConnection(): Promise<void> {
  const c = g.__saarthiRedisProducer;
  g.__saarthiRedisProducer = undefined;
  if (c) await c.quit().catch(() => c.disconnect());
}
