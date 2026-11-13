-- ============================================================================================
-- Saarthi Phase 1 — schema consolidation with data migration.
--
-- Hand-written (Prisma's generated diff would DROP the legacy tables and their data).
-- Transforms data in place, then produces exactly the structure in prisma/schema.prisma.
-- Runs in one transaction: any failure leaves the database untouched.
-- Decisions are documented in docs/DATABASE_ARCHITECTURE.md § "Phase 1 migration".
-- ============================================================================================

BEGIN;

-- ───────────── Enums ─────────────
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');
CREATE TYPE "WellnessDomain" AS ENUM ('SKIN', 'PHYSICAL', 'MENTAL', 'COMBINED');
CREATE TYPE "AnalysisStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "ReportMethod" AS ENUM ('COMPUTER_VISION', 'QUESTIONNAIRE_RULES', 'LLM_SYNTHESIS', 'LEGACY_UNVERIFIED');
CREATE TYPE "StorageProvider" AS ENUM ('CLOUDINARY');
CREATE TYPE "AssetPurpose" AS ENUM ('SKIN_SCAN', 'PHYSICAL_SCAN');
CREATE TYPE "AssetStatus" AS ENUM ('ACTIVE', 'DELETED');
CREATE TYPE "ConsentType" AS ENUM ('TERMS_OF_SERVICE', 'PRIVACY_POLICY', 'HEALTH_DATA_PROCESSING', 'IMAGE_PROCESSING', 'AI_PROCESSING');
CREATE TYPE "UnitSystem" AS ENUM ('METRIC', 'IMPERIAL');
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');
CREATE TYPE "RecommendationStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'DISMISSED');

-- ───────────── New tables ─────────────
CREATE TABLE "UserProfile" (
    "userId" TEXT NOT NULL,
    "age" INTEGER,
    "gender" TEXT,
    "heightCm" DOUBLE PRECISION,
    "weightKg" DOUBLE PRECISION,
    "lifestyle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "UserPreferences" (
    "userId" TEXT NOT NULL,
    "unitSystem" "UnitSystem" NOT NULL DEFAULT 'METRIC',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "emailNotifications" BOOLEAN NOT NULL DEFAULT false,
    "imageRetentionDays" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UserPreferences_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ConsentType" NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "policyVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UploadedAsset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "StorageProvider" NOT NULL DEFAULT 'CLOUDINARY',
    "storageKey" TEXT NOT NULL,
    "deliveryType" TEXT NOT NULL DEFAULT 'authenticated',
    "purpose" "AssetPurpose" NOT NULL,
    "mimeType" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    CONSTRAINT "UploadedAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnalysisInput" (
    "analysisId" TEXT NOT NULL,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "questionnaire" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnalysisInput_pkey" PRIMARY KEY ("analysisId")
);

CREATE TABLE "AnalysisResult" (
    "analysisId" TEXT NOT NULL,
    "engine" TEXT NOT NULL,
    "engineVersion" TEXT NOT NULL,
    "rawOutput" JSONB NOT NULL,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AnalysisResult_pkey" PRIMARY KEY ("analysisId")
);

CREATE TABLE "PhysicalReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "analysisId" TEXT,
    "assetId" TEXT,
    "method" "ReportMethod" NOT NULL,
    "engineVersion" TEXT,
    "fitnessScore" INTEGER NOT NULL,
    "postureScore" INTEGER,
    "mobilityScore" INTEGER,
    "balanceScore" INTEGER,
    "symmetryScore" INTEGER,
    "bmi" DOUBLE PRECISION,
    "sleepHours" DOUBLE PRECISION,
    "waterLiters" DOUBLE PRECISION,
    "workoutMinutes" INTEGER,
    "activityLevel" TEXT,
    "goal" TEXT,
    "confidence" DOUBLE PRECISION,
    "metrics" JSONB,
    "detectedIssues" JSONB NOT NULL,
    "recommendations" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PhysicalReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MentalWellnessReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "analysisId" TEXT,
    "method" "ReportMethod" NOT NULL,
    "engineVersion" TEXT,
    "wellnessScore" INTEGER NOT NULL,
    "moodRating" INTEGER,
    "stressLevel" INTEGER,
    "energyRating" INTEGER,
    "sleepHours" DOUBLE PRECISION,
    "confidence" DOUBLE PRECISION,
    "metrics" JSONB,
    "recommendations" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MentalWellnessReport_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DailyHabit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "waterMl" INTEGER,
    "steps" INTEGER,
    "sleepHours" DOUBLE PRECISION,
    "exerciseMinutes" INTEGER,
    "moodRating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DailyHabit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "moodRating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "domain" "WellnessDomain" NOT NULL,
    "sourceReportId" TEXT,
    "text" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'ACTIVE',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AIMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AIMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "requestId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- ───────────── User → UserProfile ─────────────
ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';

INSERT INTO "UserProfile" ("userId", "age", "gender", "lifestyle", "createdAt", "updatedAt")
SELECT "id", "age", "gender", "lifestyle", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "User"
WHERE "age" IS NOT NULL OR "gender" IS NOT NULL OR "lifestyle" IS NOT NULL;

ALTER TABLE "User" DROP COLUMN "age", DROP COLUMN "gender", DROP COLUMN "lifestyle";

-- ───────────── Analysis (job) ─────────────
ALTER TABLE "Analysis" RENAME COLUMN "status" TO "legacyStatus";
ALTER TABLE "Analysis"
    ADD COLUMN "domain" "WellnessDomain",
    ADD COLUMN "status" "AnalysisStatus" NOT NULL DEFAULT 'QUEUED',
    ADD COLUMN "idempotencyKey" TEXT,
    ADD COLUMN "inputAssetId" TEXT,
    ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "errorCode" TEXT,
    ADD COLUMN "errorMessage" TEXT,
    ADD COLUMN "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "startedAt" TIMESTAMP(3),
    ADD COLUMN "completedAt" TIMESTAMP(3);

-- Unknown legacy types are left NULL and the SET NOT NULL below aborts the migration (explicit, not silent).
UPDATE "Analysis" SET "domain" = CASE "type"
    WHEN 'skin' THEN 'SKIN'::"WellnessDomain"
    WHEN 'fitness' THEN 'PHYSICAL'::"WellnessDomain"
    WHEN 'physical' THEN 'PHYSICAL'::"WellnessDomain"
    WHEN 'mental' THEN 'MENTAL'::"WellnessDomain"
END;
ALTER TABLE "Analysis" ALTER COLUMN "domain" SET NOT NULL;

UPDATE "Analysis" SET "queuedAt" = "createdAt";

-- Completed legacy jobs keep COMPLETED.
UPDATE "Analysis" SET "status" = 'COMPLETED', "completedAt" = "updatedAt", "attempts" = 1
WHERE "legacyStatus" = 'COMPLETED';

-- Legacy error text could contain provider responses (SEC-07); it is replaced with a generic message.
UPDATE "Analysis" SET "status" = 'FAILED', "completedAt" = "updatedAt", "attempts" = 1,
    "errorCode" = 'LEGACY_FAILURE', "errorMessage" = 'This analysis failed before the Phase 1 upgrade.'
WHERE "legacyStatus" = 'FAILED';

-- In-flight legacy jobs belong to the retired queue and will never be processed: fail them honestly.
UPDATE "Analysis" SET "status" = 'FAILED', "completedAt" = CURRENT_TIMESTAMP,
    "errorCode" = 'INTERRUPTED_BY_UPGRADE', "errorMessage" = 'This analysis was interrupted by a system upgrade. Please run it again.'
WHERE "legacyStatus" IS NULL OR "legacyStatus" NOT IN ('COMPLETED', 'FAILED');

-- ───────────── SkinReport (CV, legacy) — altered in place ─────────────
ALTER TABLE "SkinReport"
    ADD COLUMN "analysisId" TEXT,
    ADD COLUMN "assetId" TEXT,
    ADD COLUMN "method" "ReportMethod",
    ADD COLUMN "engineVersion" TEXT,
    ADD COLUMN "metrics" JSONB,
    ALTER COLUMN "hydrationScore" DROP NOT NULL,
    ALTER COLUMN "acneSeverity" DROP NOT NULL,
    ALTER COLUMN "confidence" DROP NOT NULL;
ALTER TABLE "SkinReport" RENAME COLUMN "aiSummary" TO "summary";

-- Provenance of pre-Phase-1 CV reports cannot be verified: the old worker could fabricate them with an LLM
-- (INT-01). Their confidence values were constants or model-invented, so they are moved to metrics.legacy.
UPDATE "SkinReport" SET
    "method" = 'LEGACY_UNVERIFIED',
    "metrics" = jsonb_build_object('legacy', jsonb_build_object('confidence', "confidence")),
    "confidence" = NULL;

-- Questionnaire skin reports (SkinAnalysis) become QUESTIONNAIRE_RULES rows of the same table.
-- Legacy SkinAnalysis.acneScore stored the overall skin score; drynessScore = 100 - reported hydration.
INSERT INTO "SkinReport" ("id", "userId", "imageUrl", "skinScore", "hydrationScore", "acneSeverity", "confidence",
    "detectedIssues", "recommendations", "summary", "createdAt", "updatedAt", "method", "engineVersion", "metrics")
SELECT "id", "userId", "imageUrl", "acneScore", GREATEST(0, LEAST(100, 100 - "drynessScore")), NULL, NULL,
    '[]'::jsonb, "recommendations", "aiSummary", "createdAt", "updatedAt", 'QUESTIONNAIRE_RULES', 'questionnaire-rules@0',
    jsonb_build_object('legacy', jsonb_build_object(
        'drynessScore', "drynessScore", 'oilinessScore', "oilinessScore",
        'pigmentationScore', "pigmentationScore", 'confidence', "confidence"))
FROM "SkinAnalysis";

ALTER TABLE "SkinReport" ALTER COLUMN "method" SET NOT NULL;

-- ───────────── PhysicalReport ← FitnessReport (CV, legacy) + PhysicalHealthAnalysis (questionnaire) ─────────────
-- Legacy mobilityScore was posture + 5 (not measured) → kept only in metrics.legacy.
INSERT INTO "PhysicalReport" ("id", "userId", "method", "engineVersion", "fitnessScore", "postureScore", "mobilityScore",
    "confidence", "metrics", "detectedIssues", "recommendations", "summary", "imageUrl", "createdAt", "updatedAt")
SELECT "id", "userId", 'LEGACY_UNVERIFIED', NULL, "fitnessScore", "postureScore", NULL,
    NULL, jsonb_build_object('legacy', jsonb_build_object('mobilityScore', "mobilityScore", 'confidence', "confidence")),
    "detectedIssues", "recommendations", "aiSummary", "imageUrl", "createdAt", "updatedAt"
FROM "FitnessReport";

-- Legacy PhysicalHealthAnalysis: hydration = round(liters * 40); activityLevel actually stored the goal.
INSERT INTO "PhysicalReport" ("id", "userId", "method", "engineVersion", "fitnessScore", "bmi", "sleepHours",
    "waterLiters", "goal", "confidence", "metrics", "detectedIssues", "recommendations", "summary", "createdAt", "updatedAt")
SELECT "id", "userId", 'QUESTIONNAIRE_RULES', 'questionnaire-rules@0', "fitnessScore", "bmi", "sleepHours",
    "hydration" / 40.0, "activityLevel", NULL, jsonb_build_object('legacy', jsonb_build_object('hydration', "hydration")),
    '[]'::jsonb, "recommendations", "aiSummary", "createdAt", "updatedAt"
FROM "PhysicalHealthAnalysis";

-- ───────────── MentalWellnessReport ← MentalHealthAnalysis ─────────────
-- moodScore stored the overall score; sleepScore = round(hours * 12); anxiety/burnout were ad-hoc derivations.
INSERT INTO "MentalWellnessReport" ("id", "userId", "method", "engineVersion", "wellnessScore", "stressLevel", "sleepHours",
    "confidence", "metrics", "recommendations", "summary", "createdAt", "updatedAt")
SELECT "id", "userId", 'QUESTIONNAIRE_RULES', 'questionnaire-rules@0', "moodScore", "stressLevel",
    CASE WHEN "sleepScore" > 0 THEN "sleepScore" / 12.0 ELSE NULL END, NULL,
    jsonb_build_object('legacy', jsonb_build_object('anxietyLevel', "anxietyLevel", 'burnoutRisk', "burnoutRisk", 'sleepScore', "sleepScore")),
    "recommendations", "aiSummary", "createdAt", "updatedAt"
FROM "MentalHealthAnalysis";

-- ───────────── Link legacy jobs to their reports, then drop legacy job columns ─────────────
UPDATE "SkinReport" r SET "analysisId" = a."id"
FROM "Analysis" a
WHERE a."resultId" = r."id" AND a."domain" = 'SKIN' AND a."userId" = r."userId";

UPDATE "PhysicalReport" r SET "analysisId" = a."id"
FROM "Analysis" a
WHERE a."resultId" = r."id" AND a."domain" = 'PHYSICAL' AND a."userId" = r."userId";

-- A COMPLETED job whose report cannot be found is not truthfully complete.
UPDATE "Analysis" a SET "status" = 'FAILED', "errorCode" = 'LEGACY_REPORT_MISSING',
    "errorMessage" = 'The report for this analysis could not be found.'
WHERE a."status" = 'COMPLETED'
  AND NOT EXISTS (SELECT 1 FROM "SkinReport" s WHERE s."analysisId" = a."id")
  AND NOT EXISTS (SELECT 1 FROM "PhysicalReport" p WHERE p."analysisId" = a."id");

ALTER TABLE "Analysis" DROP COLUMN "type", DROP COLUMN "legacyStatus", DROP COLUMN "error",
    DROP COLUMN "imageUrl", DROP COLUMN "resultId";

-- ───────────── ProgressHistory ─────────────
ALTER TABLE "ProgressHistory"
    ADD COLUMN "domain" "WellnessDomain",
    ADD COLUMN "metric" TEXT NOT NULL DEFAULT 'score',
    ADD COLUMN "value" DOUBLE PRECISION,
    ADD COLUMN "sourceReportId" TEXT;
ALTER TABLE "ProgressHistory" RENAME COLUMN "date" TO "recordedAt";
UPDATE "ProgressHistory" SET
    "domain" = CASE "metricType" WHEN 'skin' THEN 'SKIN'::"WellnessDomain" WHEN 'fitness' THEN 'PHYSICAL'::"WellnessDomain"
                                 WHEN 'physical' THEN 'PHYSICAL'::"WellnessDomain" WHEN 'mental' THEN 'MENTAL'::"WellnessDomain" END,
    "value" = "score";
ALTER TABLE "ProgressHistory" ALTER COLUMN "domain" SET NOT NULL, ALTER COLUMN "value" SET NOT NULL;
ALTER TABLE "ProgressHistory" DROP COLUMN "metricType", DROP COLUMN "score";

-- ───────────── Achievement codes (one per user; later duplicates keep a NULL code) ─────────────
ALTER TABLE "Achievement" ADD COLUMN "code" TEXT;
UPDATE "Achievement" a SET "code" = ranked.code
FROM (
    SELECT "id",
        CASE "title" WHEN 'Skin Pioneer' THEN 'FIRST_SKIN_SCAN' WHEN 'Fitness Explorer' THEN 'FIRST_POSTURE_SCAN' END AS code,
        ROW_NUMBER() OVER (PARTITION BY "userId", "title" ORDER BY "unlockedAt", "id") AS rn
    FROM "Achievement"
) ranked
WHERE a."id" = ranked."id" AND ranked.rn = 1 AND ranked.code IS NOT NULL;

-- ───────────── CombinedWellnessReport ─────────────
-- Legacy overall scores were produced by the language model (or defaulted to 70): kept, but labelled unverified.
ALTER TABLE "CombinedWellnessReport"
    ADD COLUMN "analysisId" TEXT,
    ADD COLUMN "method" "ReportMethod" NOT NULL DEFAULT 'LLM_SYNTHESIS',
    ADD COLUMN "model" TEXT,
    ADD COLUMN "sourceReportIds" JSONB,
    ALTER COLUMN "overallHealthScore" DROP NOT NULL;
UPDATE "CombinedWellnessReport" SET "method" = 'LEGACY_UNVERIFIED';

-- ───────────── DailyHabits → DailyHabit (one row per user per day; latest wins) ─────────────
INSERT INTO "DailyHabit" ("id", "userId", "date", "waterMl", "steps", "sleepHours", "exerciseMinutes", "moodRating", "createdAt", "updatedAt")
SELECT DISTINCT ON (dh."userId", (dh."date"::date))
    dh."id", dh."userId", dh."date"::date, dh."waterIntake", dh."steps", dh."sleep", dh."exercise", dh."mood", dh."date", dh."date"
FROM "DailyHabits" dh
ORDER BY dh."userId", (dh."date"::date), dh."date" DESC, dh."id";

-- ───────────── AIConversation: legacy rows were individual messages ─────────────
CREATE TEMP TABLE "_legacy_ai_messages" ON COMMIT DROP AS SELECT * FROM "AIConversation";
DELETE FROM "AIConversation";
ALTER TABLE "AIConversation" DROP COLUMN "role", DROP COLUMN "message", DROP COLUMN "embedding", DROP COLUMN "timestamp",
    ADD COLUMN "title" TEXT,
    ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL;
INSERT INTO "AIConversation" ("id", "userId", "title", "createdAt", "updatedAt")
SELECT 'legacy-' || "userId", "userId", 'Earlier conversation', MIN("timestamp"), MAX("timestamp")
FROM "_legacy_ai_messages" GROUP BY "userId";
INSERT INTO "AIMessage" ("id", "conversationId", "role", "content", "embedding", "createdAt")
SELECT "id", 'legacy-' || "userId",
    CASE WHEN "role" = 'user' THEN 'USER'::"MessageRole" ELSE 'ASSISTANT'::"MessageRole" END,
    "message", "embedding", "timestamp"
FROM "_legacy_ai_messages";

-- ───────────── Drop legacy tables (data already migrated above) ─────────────
ALTER TABLE "SkinAnalysis" DROP CONSTRAINT "SkinAnalysis_userId_fkey";
ALTER TABLE "MentalHealthAnalysis" DROP CONSTRAINT "MentalHealthAnalysis_userId_fkey";
ALTER TABLE "PhysicalHealthAnalysis" DROP CONSTRAINT "PhysicalHealthAnalysis_userId_fkey";
ALTER TABLE "FitnessReport" DROP CONSTRAINT "FitnessReport_userId_fkey";
ALTER TABLE "DailyHabits" DROP CONSTRAINT "DailyHabits_userId_fkey";
DROP TABLE "SkinAnalysis";
DROP TABLE "MentalHealthAnalysis";
DROP TABLE "PhysicalHealthAnalysis";
DROP TABLE "FitnessReport";
DROP TABLE "DailyHabits";

-- ───────────── Indexes ─────────────
CREATE INDEX "ConsentRecord_userId_type_createdAt_idx" ON "ConsentRecord"("userId", "type", "createdAt");
CREATE UNIQUE INDEX "UploadedAsset_storageKey_key" ON "UploadedAsset"("storageKey");
CREATE INDEX "UploadedAsset_userId_createdAt_idx" ON "UploadedAsset"("userId", "createdAt");
CREATE INDEX "UploadedAsset_userId_sha256_idx" ON "UploadedAsset"("userId", "sha256");
CREATE INDEX "UploadedAsset_status_createdAt_idx" ON "UploadedAsset"("status", "createdAt");
CREATE UNIQUE INDEX "PhysicalReport_analysisId_key" ON "PhysicalReport"("analysisId");
CREATE INDEX "PhysicalReport_userId_createdAt_idx" ON "PhysicalReport"("userId", "createdAt");
CREATE UNIQUE INDEX "MentalWellnessReport_analysisId_key" ON "MentalWellnessReport"("analysisId");
CREATE INDEX "MentalWellnessReport_userId_createdAt_idx" ON "MentalWellnessReport"("userId", "createdAt");
CREATE UNIQUE INDEX "DailyHabit_userId_date_key" ON "DailyHabit"("userId", "date");
CREATE INDEX "JournalEntry_userId_createdAt_idx" ON "JournalEntry"("userId", "createdAt");
CREATE INDEX "Recommendation_userId_status_createdAt_idx" ON "Recommendation"("userId", "status", "createdAt");
CREATE INDEX "AIMessage_conversationId_createdAt_idx" ON "AIMessage"("conversationId", "createdAt");
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
CREATE UNIQUE INDEX "SkinReport_analysisId_key" ON "SkinReport"("analysisId");
CREATE INDEX "SkinReport_userId_createdAt_idx" ON "SkinReport"("userId", "createdAt");
CREATE INDEX "Analysis_userId_createdAt_idx" ON "Analysis"("userId", "createdAt");
CREATE INDEX "Analysis_status_updatedAt_idx" ON "Analysis"("status", "updatedAt");
CREATE UNIQUE INDEX "Analysis_userId_idempotencyKey_key" ON "Analysis"("userId", "idempotencyKey");
CREATE INDEX "ProgressHistory_userId_domain_recordedAt_idx" ON "ProgressHistory"("userId", "domain", "recordedAt");
CREATE INDEX "Achievement_userId_unlockedAt_idx" ON "Achievement"("userId", "unlockedAt");
CREATE UNIQUE INDEX "Achievement_userId_code_key" ON "Achievement"("userId", "code");
CREATE UNIQUE INDEX "CombinedWellnessReport_analysisId_key" ON "CombinedWellnessReport"("analysisId");
CREATE INDEX "CombinedWellnessReport_userId_generatedAt_idx" ON "CombinedWellnessReport"("userId", "generatedAt");
CREATE INDEX "AIConversation_userId_updatedAt_idx" ON "AIConversation"("userId", "updatedAt");

-- ───────────── Foreign keys ─────────────
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserPreferences" ADD CONSTRAINT "UserPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UploadedAsset" ADD CONSTRAINT "UploadedAsset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Analysis" ADD CONSTRAINT "Analysis_inputAssetId_fkey" FOREIGN KEY ("inputAssetId") REFERENCES "UploadedAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AnalysisInput" ADD CONSTRAINT "AnalysisInput_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnalysisResult" ADD CONSTRAINT "AnalysisResult_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SkinReport" ADD CONSTRAINT "SkinReport_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SkinReport" ADD CONSTRAINT "SkinReport_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "UploadedAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PhysicalReport" ADD CONSTRAINT "PhysicalReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PhysicalReport" ADD CONSTRAINT "PhysicalReport_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PhysicalReport" ADD CONSTRAINT "PhysicalReport_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "UploadedAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MentalWellnessReport" ADD CONSTRAINT "MentalWellnessReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MentalWellnessReport" ADD CONSTRAINT "MentalWellnessReport_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CombinedWellnessReport" ADD CONSTRAINT "CombinedWellnessReport_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "Analysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DailyHabit" ADD CONSTRAINT "DailyHabit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AIMessage" ADD CONSTRAINT "AIMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
