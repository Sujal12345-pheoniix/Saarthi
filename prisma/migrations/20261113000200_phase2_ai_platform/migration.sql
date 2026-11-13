-- Phase 2: AI platform, analysis lifecycle provenance, tracking and recommendations.
-- Purely additive: new enums/values, nullable columns and new tables. No existing data is modified
-- except the jobId backfill at the end (queued work used jobId = analysis id since Phase 1).
-- Rollback: prisma/rollbacks/20261113000200_phase2_ai_platform.down.sql (see docs/deployment/MIGRATIONS.md).

-- CreateEnum
CREATE TYPE "AiFeature" AS ENUM ('COMBINED_SYNTHESIS', 'COMPANION', 'JOURNAL_SUMMARY');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('ACTIVE', 'ACHIEVED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "SexForCalculation" AS ENUM ('FEMALE', 'MALE');

-- AlterEnum
ALTER TYPE "AnalysisStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "AIMessage" ADD COLUMN     "inputTokens" INTEGER,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "outputTokens" INTEGER,
ADD COLUMN     "safety" JSONB;

-- AlterTable
ALTER TABLE "Analysis" ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "inputMetadata" JSONB,
ADD COLUMN     "jobId" TEXT,
ADD COLUMN     "modelId" TEXT,
ADD COLUMN     "modelProvider" TEXT,
ADD COLUMN     "modelVersion" TEXT,
ADD COLUMN     "promptVersion" TEXT,
ADD COLUMN     "resultMetadata" JSONB;

-- AlterTable
ALTER TABLE "AnalysisResult" ADD COLUMN     "estimatedCostUsd" DOUBLE PRECISION,
ADD COLUMN     "inputTokens" INTEGER,
ADD COLUMN     "outputTokens" INTEGER;

-- AlterTable
ALTER TABLE "DailyHabit" ADD COLUMN     "energyRating" INTEGER,
ADD COLUMN     "sleepQuality" INTEGER,
ADD COLUMN     "stressLevel" INTEGER;

-- AlterTable
ALTER TABLE "Recommendation" ADD COLUMN     "engineVersion" TEXT,
ADD COLUMN     "evidence" JSONB,
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "frequency" TEXT,
ADD COLUMN     "limitations" JSONB,
ADD COLUMN     "measurableTarget" TEXT,
ADD COLUMN     "rationale" TEXT,
ADD COLUMN     "ruleId" TEXT;

-- AlterTable
ALTER TABLE "UserProfile" ADD COLUMN     "birthYear" INTEGER,
ADD COLUMN     "mobilityLimitation" BOOLEAN,
ADD COLUMN     "pregnantOrLactating" BOOLEAN,
ADD COLUMN     "sexForCalculation" "SexForCalculation";

-- CreateTable
CREATE TABLE "WellnessGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "domain" "WellnessDomain" NOT NULL,
    "metric" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "targetValue" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "targetDate" DATE,
    "status" "GoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WellnessGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsageEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "feature" "AiFeature" NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT,
    "success" BOOLEAN NOT NULL,
    "errorCode" TEXT,
    "latencyMs" INTEGER NOT NULL,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "estimatedCostUsd" DOUBLE PRECISION,
    "fallbackFrom" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WellnessGoal_userId_status_idx" ON "WellnessGoal"("userId", "status");

-- CreateIndex
CREATE INDEX "AiUsageEvent_feature_createdAt_idx" ON "AiUsageEvent"("feature", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsageEvent_userId_createdAt_idx" ON "AiUsageEvent"("userId", "createdAt");


-- CreateIndex
CREATE INDEX "Recommendation_userId_ruleId_idx" ON "Recommendation"("userId", "ruleId");

-- AddForeignKey
ALTER TABLE "WellnessGoal" ADD CONSTRAINT "WellnessGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiUsageEvent" ADD CONSTRAINT "AiUsageEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: Phase 1 enqueued image and combined analyses with jobId = analysis id.
UPDATE "Analysis" SET "jobId" = "id"
WHERE "jobId" IS NULL AND ("inputAssetId" IS NOT NULL OR "domain" = 'COMBINED');
