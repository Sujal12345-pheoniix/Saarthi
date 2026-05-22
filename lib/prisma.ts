import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line vars-on-top
  var prisma: PrismaClient | undefined;
}

let _prisma: PrismaClient | undefined = globalThis.prisma;

function createPrismaClient(): PrismaClient {
  if (_prisma) return _prisma;
  if (!process.env.DATABASE_URL) {
    console.error('[prisma] Missing DATABASE_URL in process.env');
    throw new Error("Missing DATABASE_URL — provide a valid DATABASE_URL in .env to use Prisma at runtime.");
  }

  // Debug: log that we're constructing PrismaClient and a short hint about the DB URL
  try {
    const hint = process.env.DATABASE_URL?.slice(0, 40).replace(/:.+@/, ':*****@') ?? 'undefined';
    console.log(`[prisma] Constructing PrismaClient, DATABASE_URL=${hint}...`);
  } catch {}

  _prisma = new PrismaClient();
  if (process.env.NODE_ENV !== "production") globalThis.prisma = _prisma;
  return _prisma;
}

// Export a proxy so imports can access properties (e.g. prisma.skinReport.upsert)
// and the real client is constructed lazily on first access. If DATABASE_URL
// is missing, this will surface a clear error instead of returning an empty
// stub that causes `undefined` property errors.
const prisma = new Proxy({} as PrismaClient, {
  get(_, prop: string) {
    const client = createPrismaClient();
    return (client as any)[prop];
  },
  set(_, prop: string, value) {
    const client = createPrismaClient();
    (client as any)[prop] = value;
    return true;
  },
}) as unknown as PrismaClient;

export { prisma };
