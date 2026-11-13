import { withAuth } from "@/lib/api/handler";
import { getPrisma } from "@/lib/database/prisma";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { listOwnedAnalyses } from "@/server/repositories/analyses";

export const runtime = "nodejs";

/** GET /api/history — the caller's 50 most recent analyses (no inputs, no report bodies). */
export const GET = withAuth({ rateLimit: RATE_LIMITS.read }, async ({ user }) => ({
  history: await listOwnedAnalyses(getPrisma(), user.id),
}));
