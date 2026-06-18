import { Worker } from 'bullmq';
import { prisma } from '../prisma';
import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
});

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

declare global {
  var reportWorker: Worker | undefined;
}

const createReportWorker = () => new Worker(
  'analysis-queue',
  async (job) => {
    const { userId, analysisId, imageUrl, questionnaire } = job.data;
    const type = job.name; // 'skin-analysis' or 'fitness-analysis'

    console.log(`[worker] Processing job ${job.id} for type: ${type}, analysisId: ${analysisId}`);

    try {
      // 1. Update Analysis status to PROCESSING
      await prisma.analysis.update({
        where: { id: analysisId },
        data: { status: 'PROCESSING' },
      });

      // 2. Call FastAPI AI Service
      const endpoint = type === 'skin-analysis' ? '/analyze-skin' : '/analyze-fitness';
      const response = await fetch(`${AI_SERVICE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl, questionnaire }),
      });

      const responseText = await response.text();
      let result: any;
      try {
        result = JSON.parse(responseText);
      } catch {
        throw new Error(`AI service returned non-JSON response: ${responseText.slice(0, 300)}`);
      }

      if (!response.ok || !result.success) {
        throw new Error(result.error || `AI service call failed with status ${response.status}`);
      }

      // 3. Save report and progress to database
      let resultId = '';
      if (type === 'skin-analysis') {
        const report = await prisma.skinReport.create({
          data: {
            userId,
            imageUrl,
            skinScore: result.skinScore,
            hydrationScore: result.hydrationScore,
            acneSeverity: result.acneSeverity,
            confidence: result.confidence,
            detectedIssues: result.detectedIssues,
            recommendations: result.recommendations,
            aiSummary: result.aiSummary,
          },
        });
        resultId = report.id;

        // Save progress history
        await prisma.progressHistory.create({
          data: {
            userId,
            metricType: 'skin',
            score: result.skinScore,
          },
        });

        // Trigger an achievement for first skin report
        const totalSkinReports = await prisma.skinReport.count({ where: { userId } });
        if (totalSkinReports === 1) {
          await prisma.achievement.create({
            data: {
              userId,
              title: "Skin Pioneer",
              description: "Completed your first professional AI skin scan!",
            },
          });
        }
      } else {
        const report = await prisma.fitnessReport.create({
          data: {
            userId,
            imageUrl,
            fitnessScore: result.fitnessScore,
            postureScore: result.postureScore,
            mobilityScore: result.mobilityScore,
            confidence: result.confidence,
            detectedIssues: result.detectedIssues,
            recommendations: result.recommendations,
            aiSummary: result.aiSummary,
          },
        });
        resultId = report.id;

        // Save progress history
        await prisma.progressHistory.create({
          data: {
            userId,
            metricType: 'fitness',
            score: result.fitnessScore,
          },
        });

        // Trigger an achievement for first fitness report
        const totalFitnessReports = await prisma.fitnessReport.count({ where: { userId } });
        if (totalFitnessReports === 1) {
          await prisma.achievement.create({
            data: {
              userId,
              title: "Fitness Explorer",
              description: "Analyzed your posture and physical baseline with AI pose tracking!",
            },
          });
        }
      }

      // 4. Update Analysis status to COMPLETED
      await prisma.analysis.update({
        where: { id: analysisId },
        data: {
          status: 'COMPLETED',
          resultId,
        },
      });

      console.log(`[worker] Successfully completed job ${job.id} for analysisId: ${analysisId}`);
      return { success: true, resultId };
    } catch (error: any) {
      console.error(`[worker] Error processing job ${job.id}:`, error);
      
      // Update Analysis status to FAILED with error message
      await prisma.analysis.update({
        where: { id: analysisId },
        data: {
          status: 'FAILED',
          error: error.message || 'Unknown processing error',
        },
      });

      throw error;
    }
  },
  { connection }
);

export const reportWorker = globalThis.reportWorker ?? createReportWorker();

if (process.env.NODE_ENV !== 'production') {
  globalThis.reportWorker = reportWorker;
}
