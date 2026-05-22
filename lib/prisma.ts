import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

let prisma: PrismaClient;

try {
  prisma = globalThis.prisma ?? new PrismaClient();
  if (process.env.NODE_ENV !== "production") {
    globalThis.prisma = prisma;
  }
} catch (err) {
  // During build-time or in environments where Prisma cannot be constructed
  // (missing DATABASE_URL or platform restrictions), avoid throwing so the
  // Next.js build can continue. Provide a lightweight stub that will throw
  // at runtime if used improperly.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma = {} as any;
}

export { prisma };
