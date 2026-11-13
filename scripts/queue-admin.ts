/**
 * Failed-job management for the analysis queue (the "dead-letter" set).
 *
 *   npm run queue:admin -- list            # show failed jobs (kept 14 days)
 *   npm run queue:admin -- counts          # job counts per state
 *   npm run queue:admin -- retry <jobId>   # re-run one failed job (also resets the analysis to QUEUED)
 */
import "dotenv/config";
import { getPrisma, disconnectPrisma } from "@/lib/database/prisma";
import { closeAnalysisQueue, getAnalysisQueue } from "@/lib/queue/analysis-queue";
import { closeProducerConnection } from "@/lib/queue/connection";

async function main() {
  const [command, arg] = process.argv.slice(2);
  const queue = getAnalysisQueue();
  try {
    if (command === "counts") {
      console.log(await queue.getJobCounts("waiting", "active", "delayed", "completed", "failed"));
    } else if (command === "list") {
      const jobs = await queue.getFailed(0, 99);
      for (const j of jobs) {
        console.log(
          `${j.id}\tattempts=${j.attemptsMade}\tfailedAt=${j.finishedOn ? new Date(j.finishedOn).toISOString() : "-"}\t${j.failedReason}`,
        );
      }
      if (!jobs.length) console.log("No failed jobs.");
    } else if (command === "retry" && arg) {
      const job = await queue.getJob(arg);
      if (!job) throw new Error(`Job ${arg} not found`);
      await getPrisma().analysis.updateMany({
        where: { id: job.data.analysisId, status: "FAILED" },
        data: { status: "QUEUED", errorCode: null, errorMessage: null, completedAt: null },
      });
      await job.retry("failed");
      console.log(`Retried ${arg}`);
    } else {
      console.log("Usage: queue:admin -- list | counts | retry <jobId>");
      process.exitCode = 1;
    }
  } finally {
    await closeAnalysisQueue();
    await closeProducerConnection();
    await disconnectPrisma();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
