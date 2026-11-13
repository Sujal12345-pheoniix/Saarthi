import type { PrismaClient } from "@prisma/client";
import type { Queue } from "bullmq";
import type { Logger } from "@/lib/logging/logger";
import { ANALYSIS_JOB_NAME, ANALYSIS_JOB_OPTIONS, type AnalysisJobData } from "@/lib/queue/analysis-queue";
import { markAnalysisFailed, STALE_PROCESSING_MS } from "./analysis-processor";

/**
 * Job recovery, run when a worker starts (and on an interval).
 *
 * Finds analyses that the database says are QUEUED/PROCESSING but have not moved for a while, and reconciles
 * them with the queue:
 *  - no job in Redis (lost enqueue, Redis flushed)  → re-enqueue with the same jobId
 *  - job is in the failed set                        → mark FAILED in the database
 *  - job waiting/active/delayed                      → leave it alone
 */
export async function recoverStaleAnalyses(
  db: PrismaClient,
  queue: Queue<AnalysisJobData>,
  log: Logger,
  opts: { queuedOlderThanMs?: number; processingOlderThanMs?: number; now?: Date } = {},
) {
  const now = opts.now ?? new Date();
  const queuedCutoff = new Date(now.getTime() - (opts.queuedOlderThanMs ?? 2 * 60 * 1000));
  const processingCutoff = new Date(now.getTime() - (opts.processingOlderThanMs ?? STALE_PROCESSING_MS));

  const stale = await db.analysis.findMany({
    where: {
      domain: { in: ["SKIN", "PHYSICAL", "COMBINED"] },
      OR: [
        { status: "QUEUED", updatedAt: { lt: queuedCutoff } },
        { status: "PROCESSING", updatedAt: { lt: processingCutoff } },
      ],
    },
    select: { id: true, status: true },
    take: 200,
  });

  const summary = { inspected: stale.length, reEnqueued: 0, markedFailed: 0, inFlight: 0 };
  for (const a of stale) {
    const job = await queue.getJob(a.id);
    if (!job) {
      await queue.add(ANALYSIS_JOB_NAME, { analysisId: a.id }, { ...ANALYSIS_JOB_OPTIONS, jobId: a.id });
      summary.reEnqueued += 1;
      continue;
    }
    const state = await job.getState();
    if (state === "failed") {
      await markAnalysisFailed(db, a.id, "JOB_FAILED", "The analysis could not be completed. Please try again.");
      summary.markedFailed += 1;
    } else if (state === "completed") {
      // Completed job but DB not updated (crash between commit and ack is impossible since the DB commit is
      // the last step; treat as a lost update and fail visibly rather than guessing).
      await markAnalysisFailed(db, a.id, "STATE_MISMATCH", "The analysis could not be completed. Please try again.");
      summary.markedFailed += 1;
    } else {
      summary.inFlight += 1;
    }
  }
  if (summary.inspected) log.info("recovery.completed", summary);
  return summary;
}
