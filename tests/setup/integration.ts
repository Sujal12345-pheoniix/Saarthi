import { afterAll, beforeEach, vi } from "vitest";

// Point the application at the test infrastructure.
(process.env as Record<string, string>).NODE_ENV = "test";
process.env.APP_ENV = "test";
process.env.LOG_LEVEL = "error";
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.REDIS_URL = process.env.TEST_REDIS_URL;
process.env.ANALYSIS_EXECUTION_MODE = "queue";
process.env.RATE_LIMIT_ENABLED = "false";
process.env.AI_SERVICE_URL = "http://ai-service.test";
process.env.AI_SERVICE_TOKEN = "test-token-0123456789-0123456789-abcdef";
process.env.APP_URL = "http://localhost:3000";
delete process.env.DEV_ALLOW_ANON;
delete process.env.ANTHROPIC_API_KEY;
delete process.env.GEMINI_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.CLOUDINARY_CLOUD_NAME;

/**
 * Clerk is the only mocked boundary for HTTP-level tests: `auth()` returns whatever identity the test sets.
 * Everything behind it (user resolution, ownership, database, Redis) is real.
 */
const clerkState = vi.hoisted(() => ({ userId: null as string | null }));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(async () => ({ userId: clerkState.userId })),
  currentUser: vi.fn(async () =>
    clerkState.userId
      ? {
          firstName: "Test",
          lastName: clerkState.userId,
          username: null,
          imageUrl: null,
          primaryEmailAddress: null,
          emailAddresses: [],
        }
      : null,
  ),
  clerkClient: vi.fn(async () => ({ users: { deleteUser: vi.fn(async () => ({})) } })),
}));

(globalThis as Record<string, unknown>).__setClerkUser = (id: string | null) => {
  clerkState.userId = id;
};

beforeEach(async () => {
  clerkState.userId = null;
  const { resetEnvForTesting } = await import("@/lib/config/env");
  resetEnvForTesting();
});

afterAll(async () => {
  const { disconnectPrisma } = await import("@/lib/database/prisma");
  const { closeAnalysisQueue } = await import("@/lib/queue/analysis-queue");
  const { closeProducerConnection } = await import("@/lib/queue/connection");
  await closeAnalysisQueue();
  await closeProducerConnection();
  await disconnectPrisma();
});
