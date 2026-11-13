import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getEnv } from "@/lib/config/env";

/**
 * Lazily-constructed Prisma client (PostgreSQL via the pg driver adapter).
 * A single instance is reused across hot reloads in development.
 */

const globalForPrisma = globalThis as typeof globalThis & { __saarthiPrisma?: PrismaClient };

export function getPrisma(): PrismaClient {
  if (globalForPrisma.__saarthiPrisma) return globalForPrisma.__saarthiPrisma;
  const { databaseUrl } = getEnv();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: databaseUrl }) });
  globalForPrisma.__saarthiPrisma = client;
  return client;
}

/** Test/worker shutdown helper. */
export async function disconnectPrisma(): Promise<void> {
  const client = globalForPrisma.__saarthiPrisma;
  globalForPrisma.__saarthiPrisma = undefined;
  if (client) await client.$disconnect();
}

export type { PrismaClient };
