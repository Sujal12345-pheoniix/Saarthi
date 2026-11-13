import { execSync } from "node:child_process";
import IORedis from "ioredis";
import pg from "pg";

/**
 * Integration tests need a real PostgreSQL (with pgvector) and Redis:
 *   TEST_DATABASE_URL=postgresql://saarthi:saarthi@localhost:5432/saarthi_test
 *   TEST_REDIS_URL=redis://localhost:6379/1
 * `npm run infra:up` starts both (docker-compose.yml). The test database is WIPED and re-migrated.
 */
export default async function setup() {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  const redisUrl = process.env.TEST_REDIS_URL;
  if (!databaseUrl || !redisUrl) {
    throw new Error(
      "Integration tests require TEST_DATABASE_URL and TEST_REDIS_URL (see docs/DEVELOPMENT.md). They are not skipped silently.",
    );
  }
  if (!/test/i.test(new URL(databaseUrl).pathname)) {
    throw new Error("TEST_DATABASE_URL must point to a database whose name contains 'test' (it will be wiped).");
  }

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  await client.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
  await client.end();

  // Apply the real migration files exactly as production would.
  execSync("npx prisma migrate deploy", {
    stdio: "pipe",
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });

  const redis = new IORedis(redisUrl, { maxRetriesPerRequest: 1 });
  await redis.flushdb();
  await redis.quit();
}
