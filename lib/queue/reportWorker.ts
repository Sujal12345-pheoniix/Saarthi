import { Worker } from 'bullmq';
import type { Prisma } from '@prisma/client';
import { connection } from './redis';
import { AIOrchestrator } from '../ai/orchestrator';
import { prisma } from '../prisma';

declare global {
  var reportWorker: Worker | undefined;
}

const createReportWorker = () => new Worker(
  'report-generation',
  async (job) => {
    const { userId, data } = job.data;

    // 1. Run the AI full analysis via orchestrator
    const result = await AIOrchestrator.runFullAnalysis(data);

    // 2. Save domain reports to the DB
    if (result.skinAnalysis) {
      await prisma.skinAnalysis.create({
        data: {
          userId,
          acneScore: result.skinAnalysis.skinScore,
          drynessScore: 0,
          oilinessScore: 0,
          pigmentationScore: 0,
          confidence: result.skinAnalysis.confidence,
          aiSummary: result.skinAnalysis.aiSummary,
          recommendations: result.skinAnalysis.skincareRoutine as Prisma.InputJsonValue,
        },
      });
    }

    // 3. Save combined report
    if (result.recommendations) {
      await prisma.combinedWellnessReport.create({
        data: {
          userId,
          overallHealthScore: 85,
          aiInsights: "Combined insights processed",
          risks: result.recommendations.emergencyWarnings as Prisma.InputJsonValue,
          actionPlan: result.recommendations as Prisma.InputJsonValue,
        },
      });
    }

    return { success: true };
  },
  { connection }
);

export const reportWorker = globalThis.reportWorker ?? createReportWorker();

if (process.env.NODE_ENV !== 'production') {
  globalThis.reportWorker = reportWorker;
}
