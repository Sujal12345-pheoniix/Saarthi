import type { Prisma, PrismaClient, UploadedAsset } from "@prisma/client";
import { getPrisma } from "@/lib/database/prisma";
import { logger, type Logger } from "@/lib/logging/logger";
import { verifyImage } from "@/lib/security/image-validation";
import { FetchLimitError, UnsafeUrlError } from "@/lib/security/safe-fetch";
import { getStorage, type StorageProvider } from "@/lib/storage/storage";
import { createCvClient, type CvClient } from "@/server/integrations/ai-service";
import { getLlmClient, type LlmClient } from "@/server/integrations/llm";
import { AnalysisFailure, classifyUnknown } from "./analysis-errors";
import { buildCombinedSynthesis } from "./combined-report";

/**
 * Processes one Analysis. Used by the BullMQ worker and by ANALYSIS_EXECUTION_MODE=inline.
 *
 * Lifecycle: QUEUED → PROCESSING → COMPLETED | FAILED  (a retryable failure returns to QUEUED)
 * - Claiming is a conditional UPDATE, so two processors can never work on the same analysis.
 * - A PROCESSING row older than `staleAfterMs` (crashed worker) can be re-claimed.
 * - Report, raw engine output, progress point, achievement and COMPLETED status are written in one transaction.
 * - Nothing is ever defaulted: missing data fails the analysis with a user-safe message.
 */

export interface ProcessorDeps {
  db: PrismaClient;
  storage: StorageProvider | null;
  cv: CvClient;
  llm: () => LlmClient | null;
  log: Logger;
  now: () => Date;
}

export function defaultProcessorDeps(): ProcessorDeps {
  return {
    db: getPrisma(),
    storage: getStorage(),
    cv: createCvClient(),
    llm: getLlmClient,
    log: logger,
    now: () => new Date(),
  };
}

export type ProcessOutcome =
  | { status: "completed"; reportId: string }
  | { status: "skipped"; reason: string }
  | { status: "retry"; code: string }
  | { status: "failed"; code: string };

export const STALE_PROCESSING_MS = 10 * 60 * 1000;

const ACHIEVEMENTS = {
  SKIN: {
    code: "FIRST_SKIN_SCAN",
    title: "Skin Pioneer",
    description: "Completed your first computer-vision skin scan.",
  },
  PHYSICAL: {
    code: "FIRST_POSTURE_SCAN",
    title: "Posture Explorer",
    description: "Completed your first posture analysis.",
  },
} as const;

async function loadVerifiedImage(
  deps: ProcessorDeps,
  asset: UploadedAsset | null,
  userId: string,
): Promise<Uint8Array> {
  if (!asset || asset.userId !== userId || asset.status !== "ACTIVE") {
    throw new AnalysisFailure(
      "ASSET_UNAVAILABLE",
      "The uploaded image is no longer available. Please upload it again.",
      false,
    );
  }
  if (!deps.storage)
    throw new AnalysisFailure("STORAGE_NOT_CONFIGURED", "Image storage is not configured on this deployment.", false);
  let bytes: Uint8Array;
  try {
    bytes = await deps.storage.download(asset);
  } catch (error) {
    if (error instanceof UnsafeUrlError) {
      throw new AnalysisFailure("STORAGE_BLOCKED", "The stored image could not be retrieved safely.", false, error);
    }
    if (error instanceof FetchLimitError) {
      throw new AnalysisFailure(
        "STORAGE_FETCH_FAILED",
        "The stored image could not be retrieved. We will retry.",
        error.retryable,
        error,
      );
    }
    throw new AnalysisFailure(
      "STORAGE_FETCH_FAILED",
      "The stored image could not be retrieved. We will retry.",
      true,
      error,
    );
  }
  let verified;
  try {
    verified = verifyImage(bytes);
  } catch (error) {
    throw new AnalysisFailure(
      "ASSET_INTEGRITY",
      "The stored image failed verification. Please upload it again.",
      false,
      error,
    );
  }
  if (verified.sha256 !== asset.sha256) {
    throw new AnalysisFailure(
      "ASSET_INTEGRITY",
      "The stored image failed verification. Please upload it again.",
      false,
    );
  }
  return bytes;
}

export async function processAnalysis(
  analysisId: string,
  deps: ProcessorDeps = defaultProcessorDeps(),
  opts: { attempt: number; maxAttempts: number; staleAfterMs?: number } = { attempt: 1, maxAttempts: 1 },
): Promise<ProcessOutcome> {
  const { db } = deps;
  const log = deps.log.child({ analysisId, attempt: opts.attempt });
  const now = deps.now();
  const staleBefore = new Date(now.getTime() - (opts.staleAfterMs ?? STALE_PROCESSING_MS));

  const claim = await db.analysis.updateMany({
    where: {
      id: analysisId,
      OR: [{ status: "QUEUED" }, { status: "PROCESSING", updatedAt: { lt: staleBefore } }],
    },
    data: { status: "PROCESSING", startedAt: now, attempts: { increment: 1 }, errorCode: null, errorMessage: null },
  });
  if (claim.count === 0) {
    const current = await db.analysis.findUnique({ where: { id: analysisId }, select: { status: true } });
    log.info("analysis.skip", { reason: current?.status ?? "missing" });
    return { status: "skipped", reason: current?.status ?? "missing" };
  }

  const analysis = await db.analysis.findUniqueOrThrow({
    where: { id: analysisId },
    include: { input: true, inputAsset: true },
  });
  log.info("analysis.start", { domain: analysis.domain });

  try {
    const persist = async (write: (tx: Prisma.TransactionClient) => Promise<string>) =>
      db.$transaction(async (tx) => {
        const reportId = await write(tx);
        const done = await tx.analysis.updateMany({
          where: { id: analysisId, status: "PROCESSING" },
          data: { status: "COMPLETED", completedAt: deps.now(), errorCode: null, errorMessage: null },
        });
        if (done.count !== 1) throw new Error("analysis state changed during processing");
        return reportId;
      });

    let reportId: string;

    if (analysis.domain === "SKIN") {
      const bytes = await loadVerifiedImage(deps, analysis.inputAsset, analysis.userId);
      const { result, raw, durationMs } = await deps.cv.analyzeSkin(bytes, analysis.inputAsset!.mimeType);
      reportId = await persist(async (tx) => {
        await tx.analysisResult.create({
          data: {
            analysisId,
            engine: result.engine,
            engineVersion: result.engineVersion,
            rawOutput: raw as Prisma.InputJsonValue,
            durationMs,
          },
        });
        const report = await tx.skinReport.create({
          data: {
            userId: analysis.userId,
            analysisId,
            assetId: analysis.inputAssetId,
            method: "COMPUTER_VISION",
            engineVersion: result.engineVersion,
            skinScore: result.skinScore,
            hydrationScore: result.hydrationScore,
            acneSeverity: result.acneSeverity,
            confidence: result.confidence,
            metrics: {
              ...result.metrics,
              contractVersion: result.contractVersion,
              imageQuality: result.imageQuality,
              measurements: result.measurements,
              observations: result.observations,
              interpretations: result.interpretations,
              limitations: result.limitations,
              compositeFormula: result.compositeFormula,
            },
            detectedIssues: result.findings,
            recommendations: result.recommendations,
            summary: result.summary,
          },
        });
        await tx.progressHistory.create({
          data: {
            userId: analysis.userId,
            domain: "SKIN",
            metric: "skinScore",
            value: result.skinScore,
            sourceReportId: report.id,
          },
        });
        await tx.achievement.createMany({
          data: [{ userId: analysis.userId, ...ACHIEVEMENTS.SKIN }],
          skipDuplicates: true,
        });
        return report.id;
      });
    } else if (analysis.domain === "PHYSICAL") {
      const bytes = await loadVerifiedImage(deps, analysis.inputAsset, analysis.userId);
      const { result, raw, durationMs } = await deps.cv.analyzeFitness(bytes, analysis.inputAsset!.mimeType);
      const q = (analysis.input?.questionnaire ?? {}) as Record<string, unknown>;
      reportId = await persist(async (tx) => {
        await tx.analysisResult.create({
          data: {
            analysisId,
            engine: result.engine,
            engineVersion: result.engineVersion,
            rawOutput: raw as Prisma.InputJsonValue,
            durationMs,
          },
        });
        const report = await tx.physicalReport.create({
          data: {
            userId: analysis.userId,
            analysisId,
            assetId: analysis.inputAssetId,
            method: "COMPUTER_VISION",
            engineVersion: result.engineVersion,
            fitnessScore: result.fitnessScore,
            postureScore: result.postureScore,
            balanceScore: result.balanceScore,
            symmetryScore: result.symmetryScore,
            mobilityScore: result.mobilityScore,
            confidence: result.confidence,
            goal: typeof q.goal === "string" ? q.goal : null,
            metrics: {
              ...result.metrics,
              contractVersion: result.contractVersion,
              imageQuality: result.imageQuality,
              measurements: result.measurements,
              observations: result.observations,
              interpretations: result.interpretations,
              limitations: result.limitations,
              compositeFormula: result.compositeFormula,
            },
            detectedIssues: result.findings,
            recommendations: result.recommendations,
            summary: result.summary,
          },
        });
        await tx.progressHistory.create({
          data: {
            userId: analysis.userId,
            domain: "PHYSICAL",
            metric: "postureCompositeScore",
            value: result.fitnessScore,
            sourceReportId: report.id,
          },
        });
        await tx.achievement.createMany({
          data: [{ userId: analysis.userId, ...ACHIEVEMENTS.PHYSICAL }],
          skipDuplicates: true,
        });
        return report.id;
      });
    } else if (analysis.domain === "COMBINED") {
      const llm = deps.llm();
      if (!llm)
        throw new AnalysisFailure("LLM_NOT_CONFIGURED", "AI synthesis is not configured on this deployment.", false);
      const synthesis = await buildCombinedSynthesis(db, llm, analysis.userId);
      reportId = await persist(async (tx) => {
        await tx.analysisResult.create({
          data: {
            analysisId,
            engine: "llm",
            engineVersion: llm.id,
            rawOutput: synthesis.output,
            durationMs: synthesis.durationMs,
          },
        });
        const report = await tx.combinedWellnessReport.create({
          data: {
            userId: analysis.userId,
            analysisId,
            method: "LLM_SYNTHESIS",
            overallHealthScore: synthesis.overallHealthScore,
            aiInsights: synthesis.output.insights,
            risks: synthesis.output.risks,
            actionPlan: synthesis.output.actionPlan,
            model: llm.id,
            sourceReportIds: synthesis.sourceReportIds,
          },
        });
        return report.id;
      });
    } else {
      throw new AnalysisFailure("UNSUPPORTED_DOMAIN", "This analysis type is processed synchronously.", false);
    }

    log.info("analysis.completed", { domain: analysis.domain, reportId });
    return { status: "completed", reportId };
  } catch (error) {
    const failure = classifyUnknown(error);
    const willRetry = failure.retryable && opts.attempt < opts.maxAttempts;
    log[willRetry ? "warn" : "error"]("analysis.failed", {
      code: failure.code,
      retryable: failure.retryable,
      willRetry,
      error: failure.cause ?? failure,
    });
    await db.analysis.updateMany({
      where: { id: analysisId, status: "PROCESSING" },
      data: willRetry
        ? { status: "QUEUED", errorCode: failure.code, errorMessage: failure.userMessage }
        : { status: "FAILED", errorCode: failure.code, errorMessage: failure.userMessage, completedAt: deps.now() },
    });
    return willRetry ? { status: "retry", code: failure.code } : { status: "failed", code: failure.code };
  }
}

/** Marks an analysis FAILED from outside the processor (e.g. the queue exhausted its attempts). */
export async function markAnalysisFailed(db: PrismaClient, analysisId: string, code: string, userMessage: string) {
  await db.analysis.updateMany({
    where: { id: analysisId, status: { in: ["QUEUED", "PROCESSING"] } },
    data: { status: "FAILED", errorCode: code, errorMessage: userMessage, completedAt: new Date() },
  });
}
