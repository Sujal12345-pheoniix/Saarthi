import { z } from "zod";

/**
 * Response contract of the Saarthi CV service (ai-service, POST /v1/analyze/{skin|fitness}).
 * Mirrors ai-service/app/schemas/analysis.py. Any deviation fails the analysis — values are never defaulted.
 * `null` means "not measured by this engine", and is displayed as such.
 */

const score = z.number().int().min(0).max(100);
const nullableScore = score.nullable();
const text = z.string().min(1).max(500);

export const skinCvResultSchema = z.object({
  engine: z.literal("saarthi-cv"),
  engineVersion: z.string().min(1).max(50),
  skinScore: score,
  hydrationScore: nullableScore,
  acneSeverity: score,
  confidence: z.number().min(0).max(100).nullable(),
  metrics: z.object({
    acneCount: z.number().int().min(0),
    rednessScore: score,
    pigmentationScore: score,
    wrinkleScore: score,
    drynessScore: nullableScore,
    oilinessScore: score,
    skinUniformityScore: nullableScore,
  }),
  findings: z.array(text).max(20),
  recommendations: z.array(text).max(20),
  summary: z.string().min(1).max(2000),
  quality: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    blurScore: z.number(),
    brightness: z.number(),
  }),
});

export const fitnessCvResultSchema = z.object({
  engine: z.literal("saarthi-cv"),
  engineVersion: z.string().min(1).max(50),
  fitnessScore: score,
  postureScore: score,
  balanceScore: score,
  symmetryScore: score,
  mobilityScore: nullableScore,
  /** Mean MediaPipe visibility of the landmarks used (model-reported), 0-100. */
  confidence: z.number().min(0).max(100).nullable(),
  metrics: z.object({
    shoulderTiltDeg: z.number(),
    hipTiltDeg: z.number(),
    headTiltDeg: z.number(),
    neckAngleDeg: z.number(),
    spineAngleDeg: z.number(),
  }),
  findings: z.array(text).max(20),
  recommendations: z.array(text).max(20),
  summary: z.string().min(1).max(2000),
  quality: z.object({ width: z.number().int().positive(), height: z.number().int().positive() }),
});

export type SkinCvResult = z.infer<typeof skinCvResultSchema>;
export type FitnessCvResult = z.infer<typeof fitnessCvResultSchema>;
