import type { PrismaClient } from "@prisma/client";
import type { MentalQuestionnaire, PhysicalQuestionnaire, SkinQuestionnaire } from "@/features/wellness/schemas";
import { RULES_ENGINE_VERSION, scoreMental, scorePhysical, scoreSkin } from "@/features/wellness/rules";
import { mentalReportView, physicalReportView, skinReportView, type ReportView } from "@/features/reports/view-model";
import { audit } from "./audit";

/**
 * Synchronous questionnaire reports. Each one still creates an Analysis (COMPLETED) so every report has a
 * job record, an input record and a raw-output record — the same lifecycle as image analyses.
 * Journal text is used for the response only and is never persisted (only whether one was provided).
 */

type Common = { userId: string; requestId: string };

export async function createSkinQuestionnaireReport(
  db: PrismaClient,
  input: SkinQuestionnaire,
  ctx: Common,
): Promise<ReportView> {
  const out = scoreSkin(input);
  const now = new Date();
  const report = await db.$transaction(async (tx) => {
    const analysis = await tx.analysis.create({
      data: {
        userId: ctx.userId,
        domain: "SKIN",
        status: "COMPLETED",
        attempts: 1,
        startedAt: now,
        completedAt: now,
        input: { create: { questionnaire: input } },
        result: { create: { engine: "saarthi-rules", engineVersion: RULES_ENGINE_VERSION, rawOutput: { ...out } } },
      },
    });
    const r = await tx.skinReport.create({
      data: {
        userId: ctx.userId,
        analysisId: analysis.id,
        method: "QUESTIONNAIRE_RULES",
        engineVersion: RULES_ENGINE_VERSION,
        skinScore: out.score,
        hydrationScore: Math.round(input.hydration),
        confidence: null,
        metrics: {
          skinType: input.skinType,
          concerns: input.concerns,
          sunExposure: input.sunExposure,
          sleepHours: input.sleepHours,
        },
        detectedIssues: out.findings,
        recommendations: out.recommendations,
        summary: out.summary,
      },
    });
    await tx.progressHistory.create({
      data: { userId: ctx.userId, domain: "SKIN", metric: "skinScore", value: out.score, sourceReportId: r.id },
    });
    return r;
  });
  await audit(db, {
    actorUserId: ctx.userId,
    action: "report.questionnaire.create",
    resourceType: "SkinReport",
    resourceId: report.id,
    requestId: ctx.requestId,
  });
  return skinReportView(report, null);
}

export async function createPhysicalQuestionnaireReport(
  db: PrismaClient,
  input: PhysicalQuestionnaire,
  ctx: Common,
): Promise<ReportView> {
  const out = scorePhysical(input);
  const now = new Date();
  const report = await db.$transaction(async (tx) => {
    const analysis = await tx.analysis.create({
      data: {
        userId: ctx.userId,
        domain: "PHYSICAL",
        status: "COMPLETED",
        attempts: 1,
        startedAt: now,
        completedAt: now,
        input: { create: { questionnaire: input } },
        result: { create: { engine: "saarthi-rules", engineVersion: RULES_ENGINE_VERSION, rawOutput: { ...out } } },
      },
    });
    const r = await tx.physicalReport.create({
      data: {
        userId: ctx.userId,
        analysisId: analysis.id,
        method: "QUESTIONNAIRE_RULES",
        engineVersion: RULES_ENGINE_VERSION,
        fitnessScore: out.score,
        bmi: out.bmi,
        sleepHours: input.sleepHours,
        waterLiters: input.waterLiters,
        workoutMinutes: input.workoutMinutes,
        activityLevel: String(input.activityLevel),
        goal: input.goal,
        confidence: null,
        metrics: { heightCm: input.heightCm ?? null, weightKg: input.weightKg ?? null },
        detectedIssues: out.findings,
        recommendations: out.recommendations,
        summary: out.summary,
      },
    });
    await tx.progressHistory.create({
      data: { userId: ctx.userId, domain: "PHYSICAL", metric: "physicalScore", value: out.score, sourceReportId: r.id },
    });
    return r;
  });
  await audit(db, {
    actorUserId: ctx.userId,
    action: "report.questionnaire.create",
    resourceType: "PhysicalReport",
    resourceId: report.id,
    requestId: ctx.requestId,
  });
  return physicalReportView(report, null);
}

export async function createMentalQuestionnaireReport(
  db: PrismaClient,
  input: MentalQuestionnaire,
  ctx: Common,
): Promise<ReportView> {
  const out = scoreMental(input);
  const now = new Date();
  const { journal, ...withoutJournal } = input;
  const storedInput = { ...withoutJournal, journalProvided: journal.trim().length > 0 };
  const report = await db.$transaction(async (tx) => {
    const analysis = await tx.analysis.create({
      data: {
        userId: ctx.userId,
        domain: "MENTAL",
        status: "COMPLETED",
        attempts: 1,
        startedAt: now,
        completedAt: now,
        input: { create: { questionnaire: storedInput } },
        result: { create: { engine: "saarthi-rules", engineVersion: RULES_ENGINE_VERSION, rawOutput: { ...out } } },
      },
    });
    const r = await tx.mentalWellnessReport.create({
      data: {
        userId: ctx.userId,
        analysisId: analysis.id,
        method: "QUESTIONNAIRE_RULES",
        engineVersion: RULES_ENGINE_VERSION,
        wellnessScore: out.score,
        moodRating: input.mood,
        stressLevel: Math.round(input.stress),
        energyRating: input.energy,
        sleepHours: input.sleepHours,
        confidence: null,
        metrics: { findings: out.findings, needsSupport: out.needsSupport },
        recommendations: out.recommendations,
        summary: out.summary,
      },
    });
    await tx.progressHistory.create({
      data: { userId: ctx.userId, domain: "MENTAL", metric: "wellnessScore", value: out.score, sourceReportId: r.id },
    });
    return r;
  });
  await audit(db, {
    actorUserId: ctx.userId,
    action: "report.questionnaire.create",
    resourceType: "MentalWellnessReport",
    resourceId: report.id,
    requestId: ctx.requestId,
  });
  return mentalReportView(report);
}
