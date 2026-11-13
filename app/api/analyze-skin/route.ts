import { readJson } from "@/lib/api/body";
import { withAuth } from "@/lib/api/handler";
import { getPrisma } from "@/lib/database/prisma";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { skinAnalysisRequestSchema } from "@/features/wellness/schemas";
import { createImageAnalysis } from "@/server/services/analysis-service";

export const runtime = "nodejs";

/**
 * POST /api/analyze-skin  { assetId, questionnaire?, idempotencyKey? }
 * Creates a skin analysis for an image the caller uploaded. Poll GET /api/report/{analysisId}.
 */
export const POST = withAuth({ rateLimit: RATE_LIMITS.analysis }, async ({ req, user, requestId, log }) => {
  const body = await readJson(req, skinAnalysisRequestSchema);
  return createImageAnalysis(getPrisma(), {
    userId: user.id,
    domain: "SKIN",
    assetId: body.assetId,
    questionnaire: body.questionnaire,
    idempotencyKey: body.idempotencyKey,
    requestId,
    log,
  });
});
