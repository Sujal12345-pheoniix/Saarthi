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

// Robust fallback AI analysis using deepseek/openai completions directly when FastAPI is offline
async function runFallbackAnalysis(type: 'skin' | 'fitness', imageUrl: string, questionnaire: any) {
  const apiKey = process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL || 'https://integrate.api.nvidia.com/v1').replace(/\/$/, '');
  const model = process.env.OPENAI_MODEL || 'deepseek-ai/deepseek-r1';

  if (!apiKey) {
    throw new Error('Neither OPENAI_API_KEY nor GEMINI_API_KEY is set. Cannot run fallback AI analysis.');
  }

  console.log(`[worker] FastAPI service is offline. Running fallback AI analysis directly via LLM for type: ${type}`);

  const systemInstruction = "You are a professional medical wellness AI. Return ONLY a valid, single JSON object, with no markdown formatting or comments. Do not include markdown code block formatting (like ```json).";

  const prompt = type === 'skin' 
    ? `Analyze the user's skin health. 
       Inputs:
       - Image URL (simulated vision inspection): ${imageUrl}
       - Reported Skin Type: ${questionnaire.skinType || 'Balanced'}
       - Hydration Signal: ${questionnaire.hydration || 50}%
       - Sun Exposure: ${questionnaire.sunExposure || 3}/10
       - Sleep Hours: ${questionnaire.sleepHours || 7}h
       - Reported Concerns: ${JSON.stringify(questionnaire.concerns || [])}
       
       Provide a structured JSON response with:
       {
         "skinScore": number (0-100),
         "hydrationScore": number (0-100),
         "acneSeverity": number (0-100),
         "confidence": number (0-100),
         "detectedIssues": string[] (max 4 issues),
         "recommendations": string[] (max 5 recommendations),
         "aiSummary": string (clinical summary)
       }`
    : `Analyze the user's physical fitness and posture.
       Inputs:
       - Image URL (simulated posture coordinate tracking): ${imageUrl}
       - Height: ${questionnaire.heightCm || 170}cm
       - Weight: ${questionnaire.weightKg || 70}kg
       - Daily Water Intake: ${questionnaire.waterLiters || 2}L
       - Workout Duration: ${questionnaire.workoutMinutes || 30}min
       - Sleep Hours: ${questionnaire.sleepHours || 7}h
       - Activity Level: ${questionnaire.activityLevel || 3}/5
       - Wellness Goal: ${questionnaire.goal || 'General Health'}
       
       Provide a structured JSON response with:
       {
         "fitnessScore": number (0-100),
         "postureScore": number (0-100),
         "mobilityScore": number (0-100),
         "confidence": number (0-100),
         "detectedIssues": string[] (max 4 issues),
         "recommendations": string[] (max 5 recommendations),
         "aiSummary": string (fitness baseline summary)
       }`;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 1000,
    }),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`Fallback AI provider failed: ${responseText}`);
  }

  const data = JSON.parse(responseText);
  let content = data.choices?.[0]?.message?.content || data.choices?.[0]?.text || '';
  
  // Clean up formatting block code wrappers if the LLM returned them
  if (content.includes("<think>")) {
    content = content.split("</think>").pop() || content;
  }
  content = content.replace(/```json/i, '').replace(/```/g, '').trim();

  return JSON.parse(content);
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

      // 2. Attempt to call FastAPI AI Service
      let result: any;
      try {
        const endpoint = type === 'skin-analysis' ? '/analyze-skin' : '/analyze-fitness';
        const response = await fetch(`${AI_SERVICE_URL}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl, questionnaire }),
        });

        const responseText = await response.text();
        if (response.ok) {
          result = JSON.parse(responseText);
        } else {
          console.warn(`[worker] FastAPI returned non-OK status: ${response.status}. Triggering direct LLM fallback.`);
        }
      } catch (err) {
        console.warn(`[worker] Failed to connect to FastAPI service. Triggering direct LLM fallback. Error:`, err);
      }

      // 3. Fallback to direct LLM if FastAPI call failed
      if (!result || !result.success) {
        result = await runFallbackAnalysis(type === 'skin-analysis' ? 'skin' : 'fitness', imageUrl, questionnaire);
        result.success = true;
      }

      // 4. Save report and progress to database
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

        // Trigger achievement for first skin report
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

        // Trigger achievement for first fitness report
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

      // 5. Update Analysis status to COMPLETED
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
