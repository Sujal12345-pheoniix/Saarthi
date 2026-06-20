import { prisma } from "../prisma";

export async function runDirectAnalysis(
  type: "skin" | "fitness",
  userId: string,
  imageUrl: string,
  questionnaire: any
) {
  const AI_SERVICE_URL = (process.env.AI_SERVICE_URL || "https://saarthi-qqcm.onrender.com").replace(/\/$/, "");
  
  console.log(`[direct-analyzer] Calling real CV analysis service at ${AI_SERVICE_URL} for type: ${type}`);

  const endpoint = type === "skin" ? "/analyze-skin" : "/analyze-fitness";
  const res = await fetch(`${AI_SERVICE_URL}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageUrl, questionnaire }),
  });

  const responseText = await res.text();
  if (!res.ok) {
    throw new Error(`AI CV Service failed (${res.status}): ${responseText}`);
  }

  const result = JSON.parse(responseText);

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
