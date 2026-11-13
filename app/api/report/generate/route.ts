import { readJson } from "@/lib/api/body";
import { withAuth } from "@/lib/api/handler";
import { getPrisma } from "@/lib/database/prisma";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { combinedReportRequestSchema } from "@/features/wellness/schemas";
import { createCombinedAnalysis } from "@/server/services/analysis-service";

export const runtime = "nodejs";

/**
 * POST /api/report/generate  { idempotencyKey? }
 * Queues a combined wellness synthesis over the caller's stored reports. Poll GET /api/report/{analysisId}.
 */
export const POST = withAuth({ rateLimit: RATE_LIMITS.combinedReport }, async ({ req, user, requestId, log }) => {
  const body = await readJson(req, combinedReportRequestSchema);
  return createCombinedAnalysis(getPrisma(), { userId: user.id, idempotencyKey: body.idempotencyKey, requestId, log });
});
