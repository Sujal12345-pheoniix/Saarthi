import { Worker } from 'bullmq';
import { connection } from './redis';
import { AIOrchestrator } from '../ai/orchestrator';
import { prisma } from '../prisma';

export const reportWorker = new Worker(
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
          acneScore: result.skinAnalysis.skinScore, // Map it correctly or expand schema
          drynessScore: 0,
          oilinessScore: 0,
          pigmentationScore: 0,
          confidence: result.skinAnalysis.confidence,
          aiSummary: result.skinAnalysis.aiSummary,
          recommendations: result.skinAnalysis.skincareRoutine as any,
        },
      });
    }

    // 3. Save combined report
    if (result.recommendations) {
      await prisma.combinedWellnessReport.create({
        data: {
          userId,
          overallHealthScore: 85, // Typically calculated from sub-scores
          aiInsights: "Combined insights processed",
          risks: result.recommendations.emergencyWarnings as any,
          actionPlan: result.recommendations as any,
        },
      });
    }

    return { success: true };
  },
  { connection }
);
