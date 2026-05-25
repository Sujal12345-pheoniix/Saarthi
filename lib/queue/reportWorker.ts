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
      const skin = result.skinAnalysis as any;
      await prisma.skinAnalysis.create({
        data: {
          userId,
          acneScore: typeof skin.skinScore === 'number' ? Math.round(skin.skinScore) : Math.round(skin.acneScore ?? 0),
          drynessScore: typeof skin.drynessScore === 'number' ? Math.round(skin.drynessScore) : Math.max(0, 100 - (skin.hydration ?? 50)),
          oilinessScore: typeof skin.oilinessScore === 'number' ? Math.round(skin.oilinessScore) : Math.round(skin.oiliness ?? 0),
          pigmentationScore: typeof skin.pigmentationScore === 'number' ? Math.round(skin.pigmentationScore) : Math.round(skin.pigmentation ?? 0),
          confidence: typeof skin.confidence === 'number' ? Math.round(skin.confidence) : 75,
          aiSummary: skin.aiSummary ?? null,
          recommendations: (skin.recommendations ?? skin.skincareRoutine ?? []) as Prisma.InputJsonValue,
          imageUrl: skin.imageUrl ?? data.imageUrl ?? null,
        },
      });
    }

    // 3. Save combined report
    if (result.recommendations) {
      const rec = result.recommendations as any;
      const scores: number[] = [];
      if (result.skinAnalysis && typeof (result.skinAnalysis as any).skinScore === 'number') scores.push((result.skinAnalysis as any).skinScore);
      if (result.mentalAnalysis && typeof (result.mentalAnalysis as any).moodScore === 'number') scores.push((result.mentalAnalysis as any).moodScore);
      if (result.physicalAnalysis && typeof (result.physicalAnalysis as any).fitnessScore === 'number') scores.push((result.physicalAnalysis as any).fitnessScore);

      const overallHealthScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

      await prisma.combinedWellnessReport.create({
        data: {
          userId,
          overallHealthScore,
          aiInsights: rec?.summary ?? JSON.stringify(rec ?? {}),
          risks: (rec?.emergencyWarnings ?? []) as Prisma.InputJsonValue,
          actionPlan: (rec ?? {}) as Prisma.InputJsonValue,
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
