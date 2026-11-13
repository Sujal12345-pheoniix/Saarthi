import type { MentalQuestionnaire, PhysicalQuestionnaire, SkinQuestionnaire } from "./schemas";

/**
 * Deterministic questionnaire scoring ("QUESTIONNAIRE_RULES").
 *
 * These formulas are carried over unchanged from the pre-Phase-1 `lib/wellness-report.ts` so existing
 * scores remain comparable. They are transparent heuristics over self-reported answers — not clinical
 * instruments — and Phase 2 reviews them against published references (docs/audit/TECHNICAL_DEBT.md TD-10).
 *
 * What changed in Phase 1: the old functions also returned a "confidence" computed from the same answers.
 * That number had no statistical meaning, so it is no longer produced. Confidence is null for rule-based reports.
 */

export const RULES_ENGINE_VERSION = "questionnaire-rules@1";

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const fmt = (v: number) => v.toFixed(1).replace(/\.0$/, "");

export interface RuleOutput {
  score: number;
  summary: string;
  findings: string[];
  recommendations: string[];
}

export function scoreSkin(input: SkinQuestionnaire): RuleOutput {
  const concernPenalty = input.concerns.length * 4;
  const hydrationBonus = input.hydration * 0.45;
  const sunPenalty = input.sunExposure * 5;
  const sleepBonus = clamp(input.sleepHours, 0, 9) * 2;
  const score = clamp(Math.round(58 + hydrationBonus + sleepBonus - concernPenalty - sunPenalty), 35, 97);

  return {
    score,
    summary:
      score >= 80
        ? "Based on your answers, your skin routine looks relatively stable. The biggest gains usually come from hydration, sun protection and consistent night care."
        : "Based on your answers, a calmer routine with more hydration support and stricter UV protection is likely to help most.",
    findings: [
      `Self-reported skin type: ${input.skinType.toLowerCase()}.`,
      `Self-reported hydration: ${fmt(input.hydration)}%.`,
      input.concerns.length ? `Concerns you selected: ${input.concerns.join(", ")}.` : "No concerns selected.",
      "This estimate is based on your answers only; no image was analysed.",
    ],
    recommendations: [
      "AM: gentle cleanser, a niacinamide serum, and SPF 50 before going outside.",
      input.hydration < 70
        ? "Add a hydrating layer (hyaluronic acid or glycerin) after cleansing."
        : "Keep your barrier steady with a lightweight ceramide moisturiser.",
      input.sunExposure > 4
        ? "Reapply sunscreen every 2–3 hours outdoors and add a hat."
        : "Keep daily SPF as a habit even on cloudy days.",
      "PM: double-cleanse if you wore sunscreen, then a barrier-repair moisturiser.",
    ],
  };
}

export function bmiOf(heightCm?: number, weightKg?: number): number | null {
  if (!heightCm || !weightKg) return null;
  return weightKg / Math.pow(heightCm / 100, 2);
}

export function scorePhysical(input: PhysicalQuestionnaire): RuleOutput & { bmi: number | null } {
  const bmi = bmiOf(input.heightCm, input.weightKg);
  const workoutMinutes = clamp(input.workoutMinutes, 0, 180);
  const score = clamp(
    Math.round(48 + input.waterLiters * 6 + workoutMinutes * 0.18 + input.activityLevel * 6 + input.sleepHours * 2),
    35,
    98,
  );
  const dietFocus =
    bmi !== null && bmi >= 25
      ? ["Protein-forward breakfast", "Fibre-rich lunch", "Lighter dinner with vegetables and lean protein"]
      : ["Balanced protein at each meal", "Complex carbs around workouts", "One recovery snack after exercise"];

  return {
    score,
    bmi,
    summary:
      bmi !== null && bmi > 25
        ? "Based on your answers, the strongest levers are a high-protein diet, a consistent training rhythm and better recovery."
        : "Based on your answers, your baseline looks workable. Consistency in meals, movement and hydration will matter most.",
    findings: [
      bmi !== null
        ? `BMI (from your height and weight): ${fmt(bmi)}.`
        : "BMI not calculated (height or weight not provided).",
      `Water intake: ${fmt(input.waterLiters)} L/day.`,
      `Workout duration: ${input.workoutMinutes} min.`,
      `Sleep: ${fmt(input.sleepHours)} h. Activity level: ${input.activityLevel}/5.`,
    ],
    recommendations: [
      `Diet plan: ${dietFocus.join(" | ")}.`,
      "Per meal: a palm of protein, a fist of vegetables and a cupped hand of complex carbs.",
      workoutMinutes >= 45
        ? "Weekly: 3 strength sessions, 2 mobility/zone-2 sessions and 1 active recovery day."
        : "Start with 25–35 minutes of brisk walking or strength circuits and add 5 minutes every 3 days.",
      "Add electrolytes after sweaty sessions and aim for 7–9 hours of sleep.",
    ],
  };
}

export function scoreMental(input: MentalQuestionnaire): RuleOutput & { needsSupport: boolean } {
  const score = clamp(
    Math.round(62 + input.mood * 6 + input.energy * 4 + input.sleepHours * 2 - input.stress * 0.5),
    30,
    98,
  );
  const needsSupport = input.stress >= 70 || input.mood <= 3;
  return {
    score,
    needsSupport,
    summary: needsSupport
      ? "Your answers suggest an elevated stress load. Reducing stimulation, restoring sleep rhythm and short grounding breaks usually help fastest."
      : "Your answers suggest a fairly steady state. Keeping routines consistent helps a good day stay that way.",
    findings: [
      `Mood: ${input.mood}/5.`,
      `Stress: ${Math.round(input.stress)}/100.`,
      `Sleep last night: ${fmt(input.sleepHours)} h. Energy: ${input.energy}/5.`,
      input.journal.trim()
        ? "Journal note received (used for this check-in only; not stored)."
        : "No journal note added.",
    ],
    recommendations: [
      "Try two rounds of 4-7-8 breathing before focused work.",
      "Protect one 15-minute no-screen window in the afternoon.",
      "Write down one problem, one action you control, and one thing that is already okay.",
      needsSupport
        ? "If these feelings persist or intensify, reach out to a mental-health professional or someone you trust today."
        : "Keep your sleep schedule and morning light exposure consistent.",
    ],
  };
}
