import { Queue, type JobsOptions } from "bullmq";
import { getProducerConnection } from "./connection";

/**
 * Analysis queue contract.
 *
 * - Job data carries only the analysis id. Inputs, image locations and user data stay in PostgreSQL.
 * - jobId = analysisId: BullMQ ignores a second add with the same id, so enqueueing is idempotent.
 * - Failed jobs are retained for 14 days (the dead-letter set); `npm run queue:failed` lists/retries them.
 */

export const ANALYSIS_QUEUE_NAME = "saarthi-analysis";
export const ANALYSIS_JOB_NAME = "process-analysis";
export const ANALYSIS_MAX_ATTEMPTS = 3;

export interface AnalysisJobData {
  analysisId: string;
}

export const ANALYSIS_JOB_OPTIONS: JobsOptions = {
  attempts: ANALYSIS_MAX_ATTEMPTS,
  backoff: { type: "exponential", delay: 5_000 },
  removeOnComplete: { age: 24 * 3600, count: 1000 },
  removeOnFail: { age: 14 * 24 * 3600 },
};

const ENQUEUE_TIMEOUT_MS = 5_000;

const g = globalThis as typeof globalThis & { __saarthiAnalysisQueue?: Queue<AnalysisJobData> };

export function getAnalysisQueue(): Queue<AnalysisJobData> {
  if (!g.__saarthiAnalysisQueue) {
    g.__saarthiAnalysisQueue = new Queue<AnalysisJobData>(ANALYSIS_QUEUE_NAME, { connection: getProducerConnection() });
    g.__saarthiAnalysisQueue.on("error", () => undefined);
  }
  return g.__saarthiAnalysisQueue;
}

export class QueueUnavailableError extends Error {
  constructor(cause?: unknown) {
    super("Analysis queue is unavailable", cause !== undefined ? { cause } : undefined);
    this.name = "QueueUnavailableError";
  }
}

export async function enqueueAnalysisJob(analysisId: string, queue: Queue<AnalysisJobData> = getAnalysisQueue()) {
  let timer: NodeJS.Timeout | undefined;
  try {
    const job = await Promise.race([
      queue.add(ANALYSIS_JOB_NAME, { analysisId }, { ...ANALYSIS_JOB_OPTIONS, jobId: analysisId }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("enqueue timed out")), ENQUEUE_TIMEOUT_MS);
      }),
    ]);
    return job;
  } catch (error) {
    throw new QueueUnavailableError(error);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function closeAnalysisQueue(): Promise<void> {
  const q = g.__saarthiAnalysisQueue;
  g.__saarthiAnalysisQueue = undefined;
  if (q) await q.close().catch(() => undefined);
}
