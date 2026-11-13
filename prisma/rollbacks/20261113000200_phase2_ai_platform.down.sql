-- Rollback for 20261113000200_phase2_ai_platform. Run manually ONLY after restoring application code
-- that predates Phase 2, then: prisma migrate resolve --rolled-back 20261113000200_phase2_ai_platform
-- DATA LOSS: drops goals, AI usage events, and the new columns' contents (check-in stress/energy/sleep quality,
-- recommendation evidence, analysis provenance, profile calculation fields).
BEGIN;

DROP TABLE IF EXISTS "AiUsageEvent";
DROP TABLE IF EXISTS "WellnessGoal";
DROP INDEX IF EXISTS "Recommendation_userId_ruleId_idx";

ALTER TABLE "UserProfile" DROP COLUMN IF EXISTS "birthYear", DROP COLUMN IF EXISTS "sexForCalculation",
  DROP COLUMN IF EXISTS "pregnantOrLactating", DROP COLUMN IF EXISTS "mobilityLimitation";
ALTER TABLE "Recommendation" DROP COLUMN IF EXISTS "engineVersion", DROP COLUMN IF EXISTS "evidence",
  DROP COLUMN IF EXISTS "expiresAt", DROP COLUMN IF EXISTS "frequency", DROP COLUMN IF EXISTS "limitations",
  DROP COLUMN IF EXISTS "measurableTarget", DROP COLUMN IF EXISTS "rationale", DROP COLUMN IF EXISTS "ruleId";
ALTER TABLE "DailyHabit" DROP COLUMN IF EXISTS "energyRating", DROP COLUMN IF EXISTS "sleepQuality",
  DROP COLUMN IF EXISTS "stressLevel";
ALTER TABLE "AnalysisResult" DROP COLUMN IF EXISTS "estimatedCostUsd", DROP COLUMN IF EXISTS "inputTokens",
  DROP COLUMN IF EXISTS "outputTokens";
ALTER TABLE "AIMessage" DROP COLUMN IF EXISTS "inputTokens", DROP COLUMN IF EXISTS "model",
  DROP COLUMN IF EXISTS "outputTokens", DROP COLUMN IF EXISTS "safety";
ALTER TABLE "Analysis" DROP COLUMN IF EXISTS "cancelledAt", DROP COLUMN IF EXISTS "inputMetadata",
  DROP COLUMN IF EXISTS "jobId", DROP COLUMN IF EXISTS "modelId", DROP COLUMN IF EXISTS "modelProvider",
  DROP COLUMN IF EXISTS "modelVersion", DROP COLUMN IF EXISTS "promptVersion", DROP COLUMN IF EXISTS "resultMetadata";

-- PostgreSQL cannot drop an enum value. CANCELLED rows are converted to FAILED and the type is rebuilt.
UPDATE "Analysis" SET "status" = 'FAILED', "errorCode" = COALESCE("errorCode", 'CANCELLED') WHERE "status" = 'CANCELLED';
ALTER TYPE "AnalysisStatus" RENAME TO "AnalysisStatus_old";
CREATE TYPE "AnalysisStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');
ALTER TABLE "Analysis" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Analysis" ALTER COLUMN "status" TYPE "AnalysisStatus" USING ("status"::text::"AnalysisStatus");
ALTER TABLE "Analysis" ALTER COLUMN "status" SET DEFAULT 'QUEUED';
DROP TYPE "AnalysisStatus_old";

DROP TYPE IF EXISTS "SexForCalculation";
DROP TYPE IF EXISTS "GoalStatus";
DROP TYPE IF EXISTS "AiFeature";

COMMIT;
