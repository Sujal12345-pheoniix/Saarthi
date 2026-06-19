import { Worker } from 'bullmq';
import { prisma } from '../prisma';
import { connection } from './redis';

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

async function generateCombinedWellnessReport(userId: string, jobData: any) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
  const isGeminiNative = !!process.env.GEMINI_API_KEY;
  
  let baseUrl = (process.env.OPENAI_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(/\/$/, "");
  let model = process.env.OPENAI_MODEL || "deepseek-ai/deepseek-r1";

  if (isGeminiNative) {
    baseUrl = "https://generativelanguage.googleapis.com/v1beta";
    model = "gemini-2.5-flash";
  }

  if (!apiKey) {
    throw new Error('Missing API Key. Please configure GEMINI_API_KEY or OPENAI_API_KEY in your environment variables.');
  }

  console.log(`[worker] Generating comprehensive combined wellness report for user: ${userId}`);

  let skinInfo = "";
  if (jobData && jobData.skinQuestionnaire && Object.keys(jobData.skinQuestionnaire).length) {
    skinInfo = JSON.stringify(jobData.skinQuestionnaire);
  } else {
    const latestSkin = await prisma.skinReport.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    skinInfo = latestSkin ? `Score: ${latestSkin.skinScore}%, Hydration: ${latestSkin.hydrationScore}%, Acne Severity: ${latestSkin.acneSeverity}%, Issues: ${JSON.stringify(latestSkin.detectedIssues)}, Summary: ${latestSkin.aiSummary}` : "No skin analysis report available yet.";
  }

  let physicalInfo = "";
  if (jobData && jobData.physicalData && Object.keys(jobData.physicalData).length) {
    physicalInfo = JSON.stringify(jobData.physicalData);
  } else {
    const latestFitness = await prisma.fitnessReport.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    physicalInfo = latestFitness ? `Score: ${latestFitness.fitnessScore}%, Posture: ${latestFitness.postureScore}%, Mobility: ${latestFitness.mobilityScore}%, Issues: ${JSON.stringify(latestFitness.detectedIssues)}, Summary: ${latestFitness.aiSummary}` : "No posture/fitness analysis report available yet.";
  }

  let moodInfo = "";
  if (jobData && jobData.moodData && Object.keys(jobData.moodData).length) {
    moodInfo = JSON.stringify(jobData.moodData);
  } else {
    const latestMental = await prisma.mentalHealthAnalysis.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    moodInfo = latestMental ? `Mood Score: ${latestMental.moodScore}%, Stress Level: ${latestMental.stressLevel}%, Anxiety: ${latestMental.anxietyLevel}%, Burnout Risk: ${latestMental.burnoutRisk}%, Summary: ${latestMental.aiSummary}` : "No mental health analysis report available yet.";
  }

  let journals = "";
  if (jobData && jobData.journalEntries && jobData.journalEntries.length) {
    journals = jobData.journalEntries.join("\n");
  } else {
    journals = "No journal entries logged recently.";
  }

  const promptText = `Analyze the user's holistic wellness metrics and generate a combined wellness report.
Inputs:
- Skin Questionnaire/Data: ${skinInfo}
- Physical Fitness/Body Data: ${physicalInfo}
- Mental Health/Mood Data: ${moodInfo}
- Recent Journal Entries: ${journals}

Act as an expert holistic health & wellness advisor. Synthesize these data points to find correlations, risks, and a clear daily action plan.
Return ONLY a single valid JSON object matching this schema (no markdown formatting, code block markers, or comments):
{
  "overallHealthScore": number (0-100),
  "aiInsights": "2-3 paragraphs synthesizing their physical, skin, and mental wellness, highlighting potential connections (e.g., how stress/sleep affects skin or energy levels)",
  "risks": string[],
  "actionPlan": string[]
}`;

  let result: any = null;

  if (isGeminiNative) {
    const geminiUrl = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: promptText }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });
    
    const data = await res.json();
    if (!res.ok) {
      throw new Error(`Gemini API failed: ${JSON.stringify(data)}`);
    }
    const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    result = JSON.parse(jsonText.trim());
  } else {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You are a professional holistic wellness AI. Return ONLY a single JSON object." },
          { role: "user", content: promptText },
        ],
        temperature: 0.2,
        max_tokens: 1200,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(`AI API failed: ${JSON.stringify(data)}`);
    }

    let content = data.choices?.[0]?.message?.content || "";
    if (content.includes("<think>")) {
      content = content.split("</think>").pop() || content;
    }
    content = content.replace(/```json/i, "").replace(/```/g, "").trim();
    result = JSON.parse(content);
  }

  const report = await prisma.combinedWellnessReport.create({
    data: {
      userId,
      overallHealthScore: result.overallHealthScore ?? 70,
      aiInsights: result.aiInsights ?? "Comprehensive wellness analysis completed.",
      risks: result.risks ?? [],
      actionPlan: result.actionPlan ?? [],
    },
  });

  return report.id;
}

const createReportWorker = () => new Worker(
  'analysis-queue',
  async (job) => {
    const type = job.name; // 'skin-analysis' or 'fitness-analysis' or 'report-generation'
    console.log(`[worker] Processing job ${job.id} for type: ${type}`);
    let analysisId: string | undefined = undefined;

    try {
      if (type === 'report-generation') {
        const { userId, data: jobData } = job.data;
        const reportId = await generateCombinedWellnessReport(userId, jobData);
        console.log(`[worker] Successfully completed job ${job.id} for report-generation, reportId: ${reportId}`);
        return { success: true, resultId: reportId };
      }

      const { userId, imageUrl, questionnaire } = job.data;
      analysisId = job.data.analysisId;
      console.log(`[worker] Processing analysis job ${job.id} for analysisId: ${analysisId}`);

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
      if (analysisId) {
        await prisma.analysis.update({
          where: { id: analysisId },
          data: {
            status: 'FAILED',
            error: error.message || 'Unknown processing error',
          },
        });
      }
      throw error;
    }
  },
  { connection }
);

export const reportWorker = globalThis.reportWorker ?? createReportWorker();

if (process.env.NODE_ENV !== 'production') {
  globalThis.reportWorker = reportWorker;
}
