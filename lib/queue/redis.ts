import Redis from 'ioredis';

const getRedisUrl = (): string => {
  if (process.env.REDIS_URL) {
    return process.env.REDIS_URL;
  }
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const url = new URL(process.env.UPSTASH_REDIS_REST_URL);
      // Upstash SSL/TLS Redis protocol uses rediss:// and port 6379 (or specified endpoint port)
      return `rediss://default:${process.env.UPSTASH_REDIS_REST_TOKEN}@${url.hostname}:6379`;
    } catch (e) {
      console.error("[redis] Failed to parse UPSTASH_REDIS_REST_URL:", e);
    }
  }
  return 'redis://localhost:6379';
};

export const redisUrl = getRedisUrl();

// Provide a singleton Redis connection for BullMQ
export const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
});

