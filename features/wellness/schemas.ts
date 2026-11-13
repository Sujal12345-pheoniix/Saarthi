import { z } from "zod";

/**
 * Questionnaire input schemas. Shared by API validation and the UI.
 * Bounds are physiological sanity limits, wider than the UI sliders, so legitimate values are never rejected.
 */

export const SKIN_TYPES = ["Balanced", "Dry", "Oily", "Combination", "Sensitive"] as const;
export const SKIN_CONCERNS = [
  "Dry patches",
  "Acne marks",
  "Dullness",
  "Redness",
  "Oiliness",
  "Uneven texture",
] as const;
export const FITNESS_GOALS = ["Fat loss + strength", "Muscle gain", "Endurance", "General fitness"] as const;

export const skinQuestionnaireSchema = z
  .object({
    skinType: z.enum(SKIN_TYPES),
    concerns: z.array(z.enum(SKIN_CONCERNS)).max(SKIN_CONCERNS.length).default([]),
    hydration: z.number().min(0).max(100),
    sunExposure: z.number().min(0).max(10),
    sleepHours: z.number().min(0).max(24),
  })
  .strict();

export const physicalQuestionnaireSchema = z
  .object({
    heightCm: z.number().min(50).max(272).optional(),
    weightKg: z.number().min(20).max(400).optional(),
    waterLiters: z.number().min(0).max(15),
    workoutMinutes: z.number().int().min(0).max(600),
    sleepHours: z.number().min(0).max(24),
    activityLevel: z.number().int().min(1).max(5),
    goal: z.enum(FITNESS_GOALS),
  })
  .strict();

export const mentalQuestionnaireSchema = z
  .object({
    mood: z.number().int().min(1).max(5),
    stress: z.number().min(0).max(100),
    sleepHours: z.number().min(0).max(24),
    energy: z.number().int().min(1).max(5),
    journal: z.string().max(5000).default(""),
  })
  .strict();

export type SkinQuestionnaire = z.infer<typeof skinQuestionnaireSchema>;
export type PhysicalQuestionnaire = z.infer<typeof physicalQuestionnaireSchema>;
export type MentalQuestionnaire = z.infer<typeof mentalQuestionnaireSchema>;

/** Client-generated idempotency key (UUID or similar). */
export const idempotencyKeySchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{8,100}$/, "must be 8-100 characters of letters, digits, '-' or '_'")
  .optional();

export const assetIdSchema = z.string().regex(/^[a-z0-9]{20,40}$/, "must be an asset id returned by /api/upload");

export const skinAnalysisRequestSchema = z
  .object({
    assetId: assetIdSchema,
    questionnaire: skinQuestionnaireSchema.optional(),
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

export const physicalAnalysisRequestSchema = z
  .object({
    assetId: assetIdSchema,
    questionnaire: physicalQuestionnaireSchema.optional(),
    idempotencyKey: idempotencyKeySchema,
  })
  .strict();

export const combinedReportRequestSchema = z.object({ idempotencyKey: idempotencyKeySchema }).strict();
