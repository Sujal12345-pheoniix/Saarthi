import { Prisma, type AnalysisStatus, type PrismaClient, type WellnessDomain } from "@prisma/client";
import { Errors } from "@/lib/api/errors";
import { getEnv } from "@/lib/config/env";
import type { Logger } from "@/lib/logging/logger";
import { enqueueAnalysisJob, QueueUnavailableError } from "@/lib/queue/analysis-queue";
import { findOwnedActiveAsset } from "@/server/repositories/assets";
import { findOwnedAnalysis } from "@/server/repositories/analyses";
import { getStorage } from "@/lib/storage/storage";
import {
  combinedReportView,
  mentalReportView,
  physicalReportView,
  skinReportView,
  type CombinedReportView,
  type ReportView,
} from "@/features/reports/view-model";
import { audit } from "./audit";
import { processAnalysis } from "./analysis-processor";

/**
 * Creates analyses and dispatches them according to ANALYSIS_EXECUTION_MODE:
 *  - "queue" (default): enqueue to BullMQ. If the queue is unreachable the analysis is marked FAILED with
 *    QUEUE_UNAVAILABLE and the request returns 503 — it never silently switches to another code path.
 *  - "inline": process inside the request with the same processor (for deployments without a worker).
 */

export interface Dispatcher {
  enqueue(analysisId: string): Promise<void>;
  processInline(analysisId: string): Promise<void>;
  mode(): "queue" | "inline";
}

export const defaultDispatcher: Dispatcher = {
  async enqueue(analysisId) {
    await enqueueAnalysisJob(analysisId);
  },
  async processInline(analysisId) {
    await processAnalysis(analysisId);
  },
  mode: () => getEnv().analysisExecutionMode,
};

const IMAGE_PURPOSE: Record<"SKIN" | "PHYSICAL", "SKIN_SCAN" | "PHYSICAL_SCAN"> = {
  SKIN: "SKIN_SCAN",
  PHYSICAL: "PHYSICAL_SCAN",
};

export interface AnalysisSummary {
  analysisId: string;
  domain: WellnessDomain;
  status: AnalysisStatus;
}

async function dispatch(db: PrismaClient, analysisId: string, dispatcher: Dispatcher, log: Logger) {
  if (dispatcher.mode() === "inline") {
    await dispatcher.processInline(analysisId);
    return;
  }
  try {
    await dispatcher.enqueue(analysisId);
  } catch (error) {
    log.error("analysis.enqueue_failed", {
      analysisId,
      error: error instanceof QueueUnavailableError ? error.cause : error,
    });
    await db.analysis.updateMany({
      where: { id: analysisId, status: "QUEUED" },
      data: {
        status: "FAILED",
        errorCode: "QUEUE_UNAVAILABLE",
        errorMessage: "The analysis service was unavailable. Please try again.",
        completedAt: new Date(),
      },
    });
    throw Errors.queueUnavailable();
  }
}

async function createOrReuse(
  db: PrismaClient,
  data: Prisma.AnalysisUncheckedCreateInput & { userId: string },
  questionnaire: Prisma.InputJsonValue | undefined,
): Promise<{ id: string; reused: boolean }> {
  if (data.idempotencyKey) {
    const existing = await db.analysis.findUnique({
      where: { userId_idempotencyKey: { userId: data.userId, idempotencyKey: data.idempotencyKey } },
      select: { id: true },
    });
    if (existing) return { id: existing.id, reused: true };
  }
  try {
    const created = await db.analysis.create({
      data: { ...data, ...(questionnaire !== undefined ? { input: { create: { questionnaire } } } : {}) },
      select: { id: true },
    });
    return { id: created.id, reused: false };
  } catch (error) {
    // Concurrent duplicate with the same idempotency key.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && data.idempotencyKey) {
      const existing = await db.analysis.findUniqueOrThrow({
        where: { userId_idempotencyKey: { userId: data.userId, idempotencyKey: data.idempotencyKey } },
        select: { id: true },
      });
      return { id: existing.id, reused: true };
    }
    throw error;
  }
}

async function summary(db: PrismaClient, analysisId: string): Promise<AnalysisSummary> {
  const a = await db.analysis.findUniqueOrThrow({
    where: { id: analysisId },
    select: { id: true, domain: true, status: true },
  });
  return { analysisId: a.id, domain: a.domain, status: a.status };
}

export async function createImageAnalysis(
  db: PrismaClient,
  args: {
    userId: string;
    domain: "SKIN" | "PHYSICAL";
    assetId: string;
    questionnaire?: Prisma.InputJsonValue;
    idempotencyKey?: string;
    requestId: string;
    log: Logger;
  },
  dispatcher: Dispatcher = defaultDispatcher,
): Promise<AnalysisSummary> {
  const asset = await findOwnedActiveAsset(db, args.userId, args.assetId);
  if (!asset) throw Errors.notFound("Uploaded image");
  if (asset.purpose !== IMAGE_PURPOSE[args.domain]) {
    throw Errors.badRequest(`This image was uploaded for a different analysis type.`);
  }

  const { id, reused } = await createOrReuse(
    db,
    {
      userId: args.userId,
      domain: args.domain,
      status: "QUEUED",
      inputAssetId: asset.id,
      idempotencyKey: args.idempotencyKey ?? null,
    },
    args.questionnaire,
  );
  if (!reused) {
    await audit(db, {
      actorUserId: args.userId,
      action: "analysis.create",
      resourceType: "Analysis",
      resourceId: id,
      requestId: args.requestId,
      metadata: { domain: args.domain },
    });
    await dispatch(db, id, dispatcher, args.log);
  }
  return summary(db, id);
}

export async function createCombinedAnalysis(
  db: PrismaClient,
  args: { userId: string; idempotencyKey?: string; requestId: string; log: Logger },
  dispatcher: Dispatcher = defaultDispatcher,
): Promise<AnalysisSummary> {
  const { id, reused } = await createOrReuse(
    db,
    { userId: args.userId, domain: "COMBINED", status: "QUEUED", idempotencyKey: args.idempotencyKey ?? null },
    undefined,
  );
  if (!reused) {
    await audit(db, {
      actorUserId: args.userId,
      action: "analysis.create",
      resourceType: "Analysis",
      resourceId: id,
      requestId: args.requestId,
      metadata: { domain: "COMBINED" },
    });
    await dispatch(db, id, dispatcher, args.log);
  }
  return summary(db, id);
}

export type AnalysisStatusView =
  | { analysisId: string; domain: WellnessDomain; status: "QUEUED" | "PROCESSING"; attempts: number }
  | { analysisId: string; domain: WellnessDomain; status: "FAILED"; errorCode: string | null; error: string }
  | { analysisId: string; domain: WellnessDomain; status: "CANCELLED" }
  | { analysisId: string; domain: WellnessDomain; status: "COMPLETED"; report: ReportView | CombinedReportView };

export function signedImageUrl(
  asset: { storageKey: string; deliveryType: string; format: string; status: string } | null | undefined,
): string | null {
  if (!asset || asset.status !== "ACTIVE") return null;
  const storage = getStorage();
  if (!storage) return null;
  try {
    return storage.signedUrl(asset);
  } catch {
    return null;
  }
}

export async function getAnalysisStatus(
  db: PrismaClient,
  userId: string,
  analysisId: string,
): Promise<AnalysisStatusView> {
  const a = await findOwnedAnalysis(db, userId, analysisId);
  if (!a) throw Errors.notFound("Analysis");

  if (a.status === "FAILED") {
    return {
      analysisId: a.id,
      domain: a.domain,
      status: "FAILED",
      errorCode: a.errorCode,
      error: a.errorMessage ?? "The analysis failed.",
    };
  }
  if (a.status === "COMPLETED") {
    const report = a.skinReport
      ? skinReportView(a.skinReport, signedImageUrl(a.skinReport.asset))
      : a.physicalReport
        ? physicalReportView(a.physicalReport, signedImageUrl(a.physicalReport.asset))
        : a.mentalReport
          ? mentalReportView(a.mentalReport)
          : a.combinedReport
            ? combinedReportView(a.combinedReport)
            : null;
    if (!report) {
      // A COMPLETED analysis without a report would violate the processor's transaction; surface it loudly.
      throw new Error(`Analysis ${a.id} is COMPLETED but has no report`);
    }
    return { analysisId: a.id, domain: a.domain, status: "COMPLETED", report };
  }
  if (a.status === "CANCELLED") return { analysisId: a.id, domain: a.domain, status: "CANCELLED" };
  return { analysisId: a.id, domain: a.domain, status: a.status, attempts: a.attempts };
}
