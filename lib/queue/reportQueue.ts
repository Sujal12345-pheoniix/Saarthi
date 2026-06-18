import Redis from 'ioredis';
import { Queue } from 'bullmq';

let analysisQueue: Queue | null = null;

function getAnalysisQueue() {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  if (!analysisQueue) {
    const connection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
    });

    analysisQueue = new Queue('analysis-queue', {
      connection,
    });
  }

  return analysisQueue;
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
  const queue = getAnalysisQueue();
  if (!queue) {
    return { id: `local-${Date.now()}` };
  }
  return await queue.add('report-generation', jobData, {
    removeOnComplete: true,
    removeOnFail: false,
  });
}

export async function enqueueAnalysis(
  type: 'skin' | 'fitness',
  jobData: {
    userId: string;
    analysisId: string;
    imageUrl: string;
    questionnaire?: Record<string, any>;
  }
) {
  const queue = getAnalysisQueue();
  if (!queue) {
    throw new Error("Redis connection is offline");
  }
  return await queue.add(
    type === 'skin' ? 'skin-analysis' : 'fitness-analysis',
    jobData,
    {
      removeOnComplete: true,
      removeOnFail: false,
    }
  );
}
