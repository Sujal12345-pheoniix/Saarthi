import { describe, expect, it } from "vitest";
import type { PhysicalReport, SkinReport } from "@prisma/client";
import { bmiOf, scoreMental, scorePhysical, scoreSkin } from "@/features/wellness/rules";
import { mentalQuestionnaireSchema, physicalQuestionnaireSchema } from "@/features/wellness/schemas";
import { physicalReportView, skinReportView } from "@/features/reports/view-model";
import { computeStreak } from "@/server/services/dashboard";
import { SKIN_RESULT } from "../../helpers/fakes";

describe("questionnaire rules", () => {
  it("BMI = kg / m²", () => {
    expect(bmiOf(180, 81)).toBeCloseTo(25, 5);
    expect(bmiOf(undefined, 80)).toBeNull();
  });

  it("keeps the pre-Phase-1 skin formula (regression)", () => {
    // 58 + 68*0.45 + 7*2 - 1*4 - 3*5 = 83.6 → 84
    expect(
      scoreSkin({ skinType: "Balanced", concerns: ["Dullness"], hydration: 68, sunExposure: 3, sleepHours: 7 }).score,
    ).toBe(84);
  });

  it("keeps the pre-Phase-1 physical formula (regression)", () => {
    // 48 + 2.2*6 + 40*0.18 + 3*6 + 7.5*2 = 101.4 → clamped 98
    const out = scorePhysical({
      heightCm: 175,
      weightKg: 72,
      waterLiters: 2.2,
      workoutMinutes: 40,
      sleepHours: 7.5,
      activityLevel: 3,
      goal: "General fitness",
    });
    expect(out.score).toBe(98);
    expect(out.bmi).toBeCloseTo(23.51, 2);
  });

  it("keeps the pre-Phase-1 mental formula and flags support needs", () => {
    // 62 + 2*6 + 1*4 + 5*2 - 85*0.5 = 45.5 → 46
    const out = scoreMental({ mood: 2, stress: 85, sleepHours: 5, energy: 1, journal: "" });
    expect(out.score).toBe(46);
    expect(out.needsSupport).toBe(true);
  });

  it("does not produce a confidence value", () => {
    const out = scoreSkin({ skinType: "Dry", concerns: [], hydration: 50, sunExposure: 1, sleepHours: 8 });
    expect(out).not.toHaveProperty("confidence");
  });

  it("rejects out-of-range questionnaire input", () => {
    expect(mentalQuestionnaireSchema.safeParse({ mood: 9, stress: 10, sleepHours: 7, energy: 3 }).success).toBe(false);
    expect(
      physicalQuestionnaireSchema.safeParse({
        waterLiters: -1,
        workoutMinutes: 10,
        sleepHours: 7,
        activityLevel: 3,
        goal: "Endurance",
      }).success,
    ).toBe(false);
    expect(
      physicalQuestionnaireSchema.safeParse({
        waterLiters: 1,
        workoutMinutes: 10,
        sleepHours: 7,
        activityLevel: 3,
        goal: "Endurance",
        userId: "x",
      }).success,
    ).toBe(false);
  });
});

describe("report view-model honesty", () => {
  const base = {
    id: "r",
    userId: "u",
    analysisId: null,
    assetId: null,
    engineVersion: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
    imageUrl: null,
  };

  it("shows 'Not measured' instead of inventing values", () => {
    const view = physicalReportView(
      {
        ...base,
        method: "COMPUTER_VISION",
        fitnessScore: 78,
        postureScore: 80,
        balanceScore: 76,
        symmetryScore: 79,
        mobilityScore: null,
        bmi: null,
        sleepHours: null,
        waterLiters: null,
        workoutMinutes: null,
        activityLevel: null,
        goal: null,
        confidence: null,
        metrics: {},
        detectedIssues: [],
        recommendations: [],
        summary: "s",
      } as PhysicalReport,
      null,
    );
    expect(view.metrics.find((m) => m.label === "Mobility")?.value).toBe("Not measured");
    expect(view.confidence).toBeNull();
    expect(view.confidenceLabel).toBe("Confidence not measured");
  });

  it("labels questionnaire reports as rule-based with no confidence", () => {
    const view = skinReportView(
      {
        ...base,
        method: "QUESTIONNAIRE_RULES",
        skinScore: 70,
        hydrationScore: 60,
        acneSeverity: null,
        confidence: null,
        metrics: { sunExposure: 3, sleepHours: 7 },
        detectedIssues: [],
        recommendations: [],
        summary: "s",
      } as SkinReport,
      null,
    );
    expect(view.confidenceLabel).toMatch(/Rule-based/);
    expect(view.methodLabel).toMatch(/answers/);
    expect(view.detail).toBeNull();
  });

  it("exposes CV contract v3 measurements with units, and 'Not measured' for null values", () => {
    const view = skinReportView(
      {
        ...base,
        method: "COMPUTER_VISION",
        skinScore: 59,
        hydrationScore: null,
        acneSeverity: null,
        confidence: null,
        metrics: {
          ...SKIN_RESULT.metrics,
          contractVersion: SKIN_RESULT.contractVersion,
          imageQuality: SKIN_RESULT.imageQuality,
          measurements: SKIN_RESULT.measurements,
          observations: SKIN_RESULT.observations,
          interpretations: SKIN_RESULT.interpretations,
          limitations: SKIN_RESULT.limitations,
          compositeFormula: SKIN_RESULT.compositeFormula,
        },
        detectedIssues: [],
        recommendations: [],
        summary: "s",
      } as unknown as SkinReport,
      null,
    );
    expect(view.detail).not.toBeNull();
    expect(view.detail!.measurements).toHaveLength(SKIN_RESULT.measurements.length);
    for (const [i, m] of SKIN_RESULT.measurements.entries()) {
      const shown = view.detail!.measurements[i];
      expect(shown.label).toBe(m.label);
      if (m.value === null) expect(shown.value).toBe("Not measured");
      else if (m.unit === "index_0_100") expect(shown.value).toBe(`${Math.round(m.value)}/100`);
      else if (m.unit === "count") expect(shown.value).toBe(String(Math.round(m.value)));
    }
    expect(view.detail!.limitations).toEqual(SKIN_RESULT.limitations);
    expect(view.detail!.imageQuality?.score).toBe(SKIN_RESULT.imageQuality.score);
    // Tiles: the composite plus the first measurements — never the old "hydration" tile for v3 reports.
    expect(view.metrics[0].label).toBe("Skin score");
    expect(view.metrics.some((m) => /hydration/i.test(m.label))).toBe(false);
  });

  it("formats degrees and percents for posture measurements", () => {
    const view = physicalReportView(
      {
        ...base,
        method: "COMPUTER_VISION",
        fitnessScore: 60,
        postureScore: 47,
        balanceScore: 75,
        symmetryScore: 57,
        mobilityScore: null,
        confidence: null,
        goal: null,
        bmi: null,
        waterLiters: null,
        workoutMinutes: null,
        metrics: {
          measurements: [
            { key: "shoulderTiltDeg", label: "Shoulder line tilt", value: 6.54, unit: "degrees", higherIs: "more_pronounced", source: "s", method: "m", confidence: null, explanation: "e", limitations: [] },
            { key: "torsoSideLengthDiffPct", label: "Torso", value: 5.7, unit: "percent", higherIs: "more_pronounced", source: "s", method: "m", confidence: null, explanation: "e", limitations: [] },
          ],
        },
        detectedIssues: [],
        recommendations: [],
        summary: "s",
      } as unknown as PhysicalReport,
      null,
    );
    expect(view.detail!.measurements.map((m) => m.value)).toEqual(["6.5°", "5.7%"]);
  });
});

describe("streak", () => {
  it("counts consecutive UTC days ending today or yesterday", () => {
    const today = new Date("2026-11-13T12:00:00Z");
    const d = (s: string) => new Date(s);
    expect(
      computeStreak([d("2026-11-13T01:00:00Z"), d("2026-11-12T23:00:00Z"), d("2026-11-11T05:00:00Z")], today),
    ).toBe(3);
    expect(computeStreak([d("2026-11-12T10:00:00Z"), d("2026-11-11T10:00:00Z")], today)).toBe(2);
    expect(computeStreak([d("2026-11-10T10:00:00Z")], today)).toBe(0);
    expect(computeStreak([], today)).toBe(0);
  });
});
