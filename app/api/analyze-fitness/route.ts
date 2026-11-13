import { readJson } from "@/lib/api/body";
import { withAuth } from "@/lib/api/handler";
import { getPrisma } from "@/lib/database/prisma";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { physicalAnalysisRequestSchema } from "@/features/wellness/schemas";
import { createImageAnalysis } from "@/server/services/analysis-service";

export const runtime = "nodejs";

/**
 * POST /api/analyze-fitness  { assetId, questionnaire?, idempotencyKey? }
 * Posture analysis of the caller's own uploaded photo. Without a photo, use POST /api/reports/physical.
 */
export const POST = withAuth({ rateLimit: RATE_LIMITS.analysis }, async ({ req, user, requestId, log }) => {
  const body = await readJson(req, physicalAnalysisRequestSchema);
  return createImageAnalysis(getPrisma(), {
    userId: user.id,
    domain: "PHYSICAL",
    assetId: body.assetId,
    questionnaire: body.questionnaire,
    idempotencyKey: body.idempotencyKey,
    requestId,
    log,
  });
});
