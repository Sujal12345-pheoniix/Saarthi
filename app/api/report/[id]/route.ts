import { withAuth } from "@/lib/api/handler";
import { getPrisma } from "@/lib/database/prisma";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { getAnalysisStatus } from "@/server/services/analysis-service";

export const runtime = "nodejs";

/**
 * GET /api/report/{analysisId} — status of one of the caller's analyses, with the report when COMPLETED.
 * Another user's analysis id returns 404 (existence is not revealed).
 */
export const GET = withAuth<{ id: string }>({ rateLimit: RATE_LIMITS.read }, async ({ params, user }) =>
  getAnalysisStatus(getPrisma(), user.id, params.id),
);
