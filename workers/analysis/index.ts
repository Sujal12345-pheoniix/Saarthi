/**
 * Saarthi analysis worker — a standalone process, independent of the Next.js server.
 *
 *   npm run worker          (production)
 *   npm run worker:dev      (watch mode)
 *
 * Responsibilities: consume the analysis queue, process jobs with bounded concurrency, retry transient
 * failures with exponential backoff, fail permanently on non-retryable errors, recover stale analyses,
 * and shut down gracefully on SIGTERM/SIGINT.
 */
import "dotenv/config";
import { UnrecoverableError, Worker, type Job } from "bullmq";
import { assertEnvAtStartup } from "@/lib/config/env";
import { disconnectPrisma, getPrisma } from "@/lib/database/prisma";
import { logger } from "@/lib/logging/logger";
import {
  ANALYSIS_MAX_ATTEMPTS,
  ANALYSIS_QUEUE_NAME,
  closeAnalysisQueue,
  getAnalysisQueue,
  type AnalysisJobData,
} from "@/lib/queue/analysis-queue";
import { closeProducerConnection, createWorkerConnection } from "@/lib/queue/connection";
import {
  defaultProcessorDeps,
  markAnalysisFailed,
  processAnalysis,
  type ProcessorDeps,
} from "@/server/services/analysis-processor";
import { recoverStaleAnalyses } from "@/server/services/recovery";

const RECOVERY_INTERVAL_MS = 5 * 60 * 1000;
const workerLogger = logger.child({ service: "saarthi-worker" });

/**
 * Maps processor outcomes onto BullMQ semantics:
 *   retry  → throw Error             (BullMQ retries with exponential backoff)
 *   failed → throw UnrecoverableError (no further attempts; job lands in the failed set)
 */
export function createJobHandler(depsFactory: () => ProcessorDeps = defaultProcessorDeps) {
  return async (job: Job<AnalysisJobData>) => {
    const deps = depsFactory();
    const outcome = await processAnalysis(
      job.data.analysisId,
      { ...deps, log: deps.log.child({ jobId: job.id }) },
      {
        attempt: job.attemptsMade + 1,
        maxAttempts: job.opts.attempts ?? ANALYSIS_MAX_ATTEMPTS,
      },
    );
    if (outcome.status === "retry") throw new Error(`retryable failure: ${outcome.code}`);
    if (outcome.status === "failed") throw new UnrecoverableError(outcome.code);
    return outcome;
  };
}

const workerDeps = (): ProcessorDeps => ({ ...defaultProcessorDeps(), log: workerLogger });

async function main() {
  const env = assertEnvAtStartup("worker startup");
  if (!env.redisUrl) throw new Error("REDIS_URL is required to run the worker.");
  const db = getPrisma();
  const log = workerLogger.child({ component: "analysis-worker" });

  const worker = new Worker<AnalysisJobData>(ANALYSIS_QUEUE_NAME, createJobHandler(workerDeps), {
    connection: createWorkerConnection(),
    concurrency: env.workerConcurrency,
    lockDuration: 120_000,
    maxStalledCount: 1,
  });

  worker.on("ready", () =>
    log.info("worker.ready", { queue: ANALYSIS_QUEUE_NAME, concurrency: env.workerConcurrency }),
  );
  worker.on("completed", (job) => log.info("job.completed", { jobId: job.id }));
  worker.on("failed", async (job, error) => {
    if (!job) return;
    const exhausted =
      error instanceof UnrecoverableError || job.attemptsMade >= (job.opts.attempts ?? ANALYSIS_MAX_ATTEMPTS);
    log.warn("job.failed", { jobId: job.id, attemptsMade: job.attemptsMade, exhausted, reason: error.message });
    if (exhausted) {
      // The processor already recorded the classified failure; this only covers crashes outside it.
      await markAnalysisFailed(
        db,
        job.data.analysisId,
        "JOB_FAILED",
        "The analysis could not be completed. Please try again.",
      );
    }
  });
  worker.on("error", (error) => log.error("worker.error", { error }));

  const queue = getAnalysisQueue();
  const runRecovery = () =>
    recoverStaleAnalyses(db, queue, log).catch((error) => log.error("recovery.failed", { error }));
  await runRecovery();
  const timer = setInterval(runRecovery, RECOVERY_INTERVAL_MS);

  const shutdown = async (signal: string) => {
    log.info("worker.shutdown", { signal });
    clearInterval(timer);
    await worker.close();
    await closeAnalysisQueue();
    await closeProducerConnection();
    await disconnectPrisma();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

if (process.env.VITEST === undefined) {
  main().catch((error) => {
    workerLogger.error("worker.fatal", { error });
    process.exit(1);
  });
}
