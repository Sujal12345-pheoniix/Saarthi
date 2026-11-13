import { withAuth } from "@/lib/api/handler";
import { getPrisma } from "@/lib/database/prisma";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { getDashboardSummary } from "@/server/services/dashboard";

export const runtime = "nodejs";

/** GET /api/dashboard/summary — latest scores, streak and 90-day progress, from stored data only. */
export const GET = withAuth({ rateLimit: RATE_LIMITS.read }, async ({ user }) =>
  getDashboardSummary(getPrisma(), user.id),
);
