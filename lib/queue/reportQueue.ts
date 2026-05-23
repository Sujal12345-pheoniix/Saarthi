import Redis from 'ioredis';
import { Queue } from 'bullmq';

let reportQueue: Queue | null = null;

function getReportQueue() {
  if (!process.env.REDIS_URL) {
    return null;
  }

  if (!reportQueue) {
    const connection = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });

    reportQueue = new Queue('report-generation', {
      connection,
    });
  }

  return reportQueue;
}

export type ReportJobData = {
  userId: string;
  data: {
    imageUrl?: string;
    skinQuestionnaire?: Record<string, unknown>;
    moodData?: Record<string, unknown>;
    journalEntries?: string[];
    physicalData?: Record<string, unknown>;
  };
};

export async function enqueueReportGeneration(jobData: ReportJobData) {
  const queue = getReportQueue();

  if (!queue) {
    return { id: `local-${Date.now()}` };
  }

  return await queue.add('generate-report', jobData, {
    removeOnComplete: true,
    removeOnFail: false,
  });
}
