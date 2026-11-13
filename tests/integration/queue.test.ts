import { afterAll, describe, expect, it } from "vitest";
import { QueueEvents, Worker } from "bullmq";
import IORedis from "ioredis";
import { getPrisma } from "@/lib/database/prisma";
import { resetEnvForTesting } from "@/lib/config/env";
import { verifyImage } from "@/lib/security/image-validation";
import {
  ANALYSIS_JOB_OPTIONS,
  ANALYSIS_QUEUE_NAME,
  closeAnalysisQueue,
  enqueueAnalysisJob,
  getAnalysisQueue,
  type AnalysisJobData,
} from "@/lib/queue/analysis-queue";
import { closeProducerConnection } from "@/lib/queue/connection";
import { createImageAnalysis } from "@/server/services/analysis-service";
import { recoverStaleAnalyses } from "@/server/services/recovery";
import { AnalysisFailure } from "@/server/services/analysis-errors";
import { createJobHandler } from "@/workers/analysis/index";
import { fakeCv, MemoryStorage, quietLog } from "../helpers/fakes";
import { makePng } from "../helpers/images";

const db = () => getPrisma();
const storage = new MemoryStorage();
let seq = 0;

async function userWithAsset() {
  seq += 1;
  const user = await db().user.create({ data: { clerkId: `clerk_queue_${seq}_${Date.now()}` } });
  const bytes = makePng(480, 480, 500 + seq);
  const v = verifyImage(bytes);
  const stored = await storage.upload({ bytes, userId: user.id, purpose: "SKIN_SCAN", format: v.format });
  const asset = await db().uploadedAsset.create({
    data: {
      userId: user.id,
      purpose: "SKIN_SCAN",
      storageKey: stored.storageKey,
      mimeType: v.mimeType,
      format: v.format,
      sizeBytes: v.sizeBytes,
      width: v.width,
      height: v.height,
      sha256: v.sha256,
    },
  });
  return { user, asset };
}

afterAll(async () => {
  await closeAnalysisQueue();
  await closeProducerConnection();
});

describe("queue behaviour (real Redis)", () => {
  it("enqueues with jobId = analysisId and the documented retry policy; duplicates are ignored", async () => {
    const id = `dup-${Date.now()}`;
    await enqueueAnalysisJob(id);
    await enqueueAnalysisJob(id);
    const queue = getAnalysisQueue();
    const job = await queue.getJob(id);
    expect(job?.data).toEqual({ analysisId: id }); // only the id — no user data in Redis
    expect(job?.opts).toMatchObject({ attempts: 3, backoff: { type: "exponential", delay: 5000 } });
    const waiting = await queue.getJobs(["waiting", "delayed", "prioritized"]);
    expect(waiting.filter((j) => j.id === id)).toHaveLength(1);
    await job?.remove();
  });

  it("processes a job end-to-end through a real BullMQ worker", async () => {
    const { user, asset } = await userWithAsset();
    const cv = fakeCv();
    const worker = new Worker<AnalysisJobData>(
      ANALYSIS_QUEUE_NAME,
      createJobHandler(() => ({
        db: db(),
        storage,
        cv: cv.client,
        llm: () => null,
        log: quietLog,
        now: () => new Date(),
      })),
      { connection: new IORedis(process.env.TEST_REDIS_URL!, { maxRetriesPerRequest: null }), autorun: true },
    );
    const events = new QueueEvents(ANALYSIS_QUEUE_NAME, {
      connection: new IORedis(process.env.TEST_REDIS_URL!, { maxRetriesPerRequest: null }),
    });
    await events.waitUntilReady();
    try {
      const s = await createImageAnalysis(db(), {
        userId: user.id,
        domain: "SKIN",
        assetId: asset.id,
        requestId: "t",
        log: quietLog,
      });
      expect(s.status).toBe("QUEUED");
      const job = await getAnalysisQueue().getJob(s.analysisId);
      await job!.waitUntilFinished(events, 20_000);
      const a = await db().analysis.findUniqueOrThrow({ where: { id: s.analysisId }, include: { skinReport: true } });
      expect(a.status).toBe("COMPLETED");
      expect(a.skinReport?.method).toBe("COMPUTER_VISION");
    } finally {
      await worker.close();
      await events.close();
    }
  });

  it("a non-retryable failure goes straight to the failed set (dead letter) without retries", async () => {
    const { user, asset } = await userWithAsset();
    const cv = fakeCv({ skin: new AnalysisFailure("IMAGE_REJECTED", "Image too blurry.", false) });
    const worker = new Worker<AnalysisJobData>(
      ANALYSIS_QUEUE_NAME,
      createJobHandler(() => ({
        db: db(),
        storage,
        cv: cv.client,
        llm: () => null,
        log: quietLog,
        now: () => new Date(),
      })),
      { connection: new IORedis(process.env.TEST_REDIS_URL!, { maxRetriesPerRequest: null }) },
    );
    const events = new QueueEvents(ANALYSIS_QUEUE_NAME, {
      connection: new IORedis(process.env.TEST_REDIS_URL!, { maxRetriesPerRequest: null }),
    });
    await events.waitUntilReady();
    try {
      const s = await createImageAnalysis(db(), {
        userId: user.id,
        domain: "SKIN",
        assetId: asset.id,
        requestId: "t",
        log: quietLog,
      });
      const job = await getAnalysisQueue().getJob(s.analysisId);
      await expect(job!.waitUntilFinished(events, 20_000)).rejects.toThrow(/IMAGE_REJECTED/);
      const failed = await getAnalysisQueue().getJob(s.analysisId);
      expect(await failed!.getState()).toBe("failed");
      expect(failed!.attemptsMade).toBe(1);
      expect(cv.calls).toHaveLength(1);
      expect((await db().analysis.findUniqueOrThrow({ where: { id: s.analysisId } })).status).toBe("FAILED");
    } finally {
      await worker.close();
      await events.close();
    }
  });

  it("when Redis is unreachable the request fails with 503 and the analysis is marked FAILED (no silent fallback)", async () => {
    const { user, asset } = await userWithAsset();
    const realRedis = process.env.REDIS_URL;
    await closeAnalysisQueue();
    await closeProducerConnection();
    process.env.REDIS_URL = "redis://127.0.0.1:1";
    resetEnvForTesting();
    try {
      await expect(
        createImageAnalysis(db(), {
          userId: user.id,
          domain: "SKIN",
          assetId: asset.id,
          requestId: "t",
          log: quietLog,
        }),
      ).rejects.toMatchObject({ status: 503, code: "QUEUE_UNAVAILABLE" });
      const a = await db().analysis.findFirstOrThrow({ where: { userId: user.id } });
      expect(a).toMatchObject({ status: "FAILED", errorCode: "QUEUE_UNAVAILABLE" });
      expect(await db().skinReport.count({ where: { userId: user.id } })).toBe(0);
    } finally {
      await closeAnalysisQueue();
      await closeProducerConnection();
      process.env.REDIS_URL = realRedis;
      resetEnvForTesting();
    }
  });

  it("recovery re-enqueues stale analyses that have no job", async () => {
    const { user, asset } = await userWithAsset();
    const old = new Date(Date.now() - 60 * 60 * 1000);
    const analysis = await db().analysis.create({
      data: { userId: user.id, domain: "SKIN", status: "QUEUED", inputAssetId: asset.id },
    });
    await db().$executeRaw`UPDATE "Analysis" SET "updatedAt" = ${old} WHERE id = ${analysis.id}`;
    const queue = getAnalysisQueue();
    expect(await queue.getJob(analysis.id)).toBeUndefined();

    const summary = await recoverStaleAnalyses(db(), queue, quietLog);
    expect(summary.reEnqueued).toBeGreaterThanOrEqual(1);
    const job = await queue.getJob(analysis.id);
    expect(job?.opts.attempts).toBe(ANALYSIS_JOB_OPTIONS.attempts);
    await job?.remove();
  });
});
