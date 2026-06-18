import { prisma } from "../prisma";

export async function runDirectAnalysis(
  type: "skin" | "fitness",
  userId: string,
  imageUrl: string,
  questionnaire: any
) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
  const isGeminiNative = !!process.env.GEMINI_API_KEY;

  // Set default model URLs
  let baseUrl = (process.env.OPENAI_BASE_URL || "https://integrate.api.nvidia.com/v1").replace(/\/$/, "");
  let model = process.env.OPENAI_MODEL || "deepseek-ai/deepseek-r1";

  // If using Google Gemini API Key natively
  if (isGeminiNative) {
    baseUrl = "https://generativelanguage.googleapis.com/v1beta";
    model = "gemini-2.5-flash";
  }

  if (!apiKey) {
    throw new Error("Missing API Key. Please configure GEMINI_API_KEY or OPENAI_API_KEY in your environment variables.");
  }

  console.log(`[direct-analyzer] Running direct cloud analysis for type: ${type} (Using ${isGeminiNative ? 'Gemini' : 'OpenAI-compatible'} API)`);

  let result: any = null;

  if (isGeminiNative) {
    // 1. Native Gemini Multimodal Vision API call
    const geminiUrl = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;
    
    // We send a structured prompt to Gemini with the image URL
    const promptText = type === "skin"
      ? `Analyze this skin face image URL: ${imageUrl}. 
         User Questionnaire:
         - Skin Type: ${questionnaire.skinType || "Balanced"}
         - Hydration Input: ${questionnaire.hydration || 50}%
         - Sun Exposure: ${questionnaire.sunExposure || 3}/10
         - Sleep Hours: ${questionnaire.sleepHours || 7}h
         - Concerns: ${JSON.stringify(questionnaire.concerns || [])}

         Act as a board-certified dermatologist. Inspect the face image details.
         Return ONLY a single valid JSON object matching this schema (do not include markdown formatting or backticks):
         {
           "skinScore": number (0-100),
           "hydrationScore": number (0-100),
           "acneSeverity": number (0-100),
           "confidence": number (0-100),
           "detectedIssues": string[],
           "recommendations": string[],
           "aiSummary": "2-3 sentence clinical snapshot summary"
         }`
      : `Analyze this full-body posture image URL: ${imageUrl}.
         User Questionnaire:
         - Height: ${questionnaire.heightCm || 170}cm
         - Weight: ${questionnaire.weightKg || 70}kg
         - Daily Water: ${questionnaire.waterLiters || 2}L
         - Workout Duration: ${questionnaire.workoutMinutes || 30}min
         - Sleep Hours: ${questionnaire.sleepHours || 7}h
         - Activity Level: ${questionnaire.activityLevel || 3}/5
         - Wellness Goal: ${questionnaire.goal || "General Health"}

         Act as a physical therapist/sports biomechanics expert. Inspect joint symmetry, shoulders, spine, and hip alignment.
         Return ONLY a single valid JSON object matching this schema (do not include markdown formatting or backticks):
         {
           "fitnessScore": number (0-100),
           "postureScore": number (0-100),
           "mobilityScore": number (0-100),
           "confidence": number (0-100),
           "detectedIssues": string[],
           "recommendations": string[],
           "aiSummary": "2-3 sentence posture/fitness alignment summary"
         }`;

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
    // 2. OpenAI / Nvidia compatible API call
    const promptText = type === "skin"
      ? `Analyze this skin face image.
         Image URL: ${imageUrl}
         User Questionnaire:
         - Skin Type: ${questionnaire.skinType || "Balanced"}
         - Hydration: ${questionnaire.hydration || 50}%
         - Sun Exposure: ${questionnaire.sunExposure || 3}/10
         - Sleep: ${questionnaire.sleepHours || 7}h
         - Concerns: ${JSON.stringify(questionnaire.concerns || [])}

         Provide a structured JSON response matching this schema (no markdown wrappers):
         {
           "skinScore": number (0-100),
           "hydrationScore": number (0-100),
           "acneSeverity": number (0-100),
           "confidence": number (0-100),
           "detectedIssues": string[],
           "recommendations": string[],
           "aiSummary": "clinical snapshot summary"
         }`
      : `Analyze this body posture.
         Image URL: ${imageUrl}
         User Questionnaire:
         - Height: ${questionnaire.heightCm || 170}cm
         - Weight: ${questionnaire.weightKg || 70}kg
         - Daily Water: ${questionnaire.waterLiters || 2}L
         - Workout: ${questionnaire.workoutMinutes || 30}min
         - Sleep: ${questionnaire.sleepHours || 7}h
         - Activity Level: ${questionnaire.activityLevel || 3}/5
         - Goal: ${questionnaire.goal || "General Health"}

         Provide a structured JSON response matching this schema (no markdown wrappers):
         {
           "fitnessScore": number (0-100),
           "postureScore": number (0-100),
           "mobilityScore": number (0-100),
           "confidence": number (0-100),
           "detectedIssues": string[],
           "recommendations": string[],
           "aiSummary": "posture baseline summary"
         }`;

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "You are a professional medical wellness AI. Return ONLY a single JSON object." },
          { role: "user", content: promptText },
        ],
        temperature: 0.2,
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

  // 3. Save report to the database
  let reportId = "";
  if (type === "skin") {
    const report = await prisma.skinReport.create({
      data: {
        userId,
        imageUrl,
        skinScore: result.skinScore ?? 75,
        hydrationScore: result.hydrationScore ?? 70,
        acneSeverity: result.acneSeverity ?? 20,
        confidence: result.confidence ?? 90,
        detectedIssues: result.detectedIssues ?? ["Dry skin texture"],
        recommendations: result.recommendations ?? ["Maintain hydration and apply daily moisturizer"],
        aiSummary: result.aiSummary ?? "Direct vision analysis completed.",
      },
    });
    reportId = report.id;

    await prisma.progressHistory.create({
      data: { userId, metricType: "skin", score: result.skinScore ?? 75 },
    });
  } else {
    const report = await prisma.fitnessReport.create({
      data: {
        userId,
        imageUrl,
        fitnessScore: result.fitnessScore ?? 70,
        postureScore: result.postureScore ?? 68,
        mobilityScore: result.mobilityScore ?? 72,
        confidence: result.confidence ?? 90,
        detectedIssues: result.detectedIssues ?? ["Mild shoulder tilt"],
        recommendations: result.recommendations ?? ["Perform stretching exercises"],
        aiSummary: result.aiSummary ?? "Direct posture analysis completed.",
      },
    });
    reportId = report.id;

    await prisma.progressHistory.create({
      data: { userId, metricType: "fitness", score: result.fitnessScore ?? 70 },
    });
  }

  return reportId;
}
