import { z } from "zod";

/**
 * Response contract of the Saarthi CV service (ai-service, POST /v1/analyze/{skin|fitness}), contract version 3.
 * Mirrors ai-service/app/schemas/analysis.py. Any deviation fails the analysis — values are never defaulted.
 * `null` means "not measured by this engine", and is displayed as such.
 */

const score = z.number().int().min(0).max(100);
const nullableScore = score.nullable();
const text = z.string().min(1).max(500);
const longText = z.string().min(1).max(2000);

export const imageQualitySchema = z.object({
  passed: z.boolean(),
  score,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  blurScore: z.number(),
  brightness: z.number(),
  highlightClipPct: z.number().min(0).max(100),
  shadowClipPct: z.number().min(0).max(100),
  subjectAreaPct: z.number().min(0).max(100).nullable(),
  limitations: z.array(longText).max(20),
});

export const measurementSchema = z.object({
  key: z.string().min(1).max(80),
  label: text,
  value: z.number().nullable(),
  unit: z.enum(["count", "index_0_100", "percent", "degrees", "ratio"]),
  higherIs: z.enum(["more_pronounced", "better", "neutral"]),
  source: text,
  method: longText,
  /** No calibrated confidence exists for any CV measurement yet; the contract requires null. */
  confidence: z.null(),
  explanation: longText,
  limitations: z.array(longText).max(20),
});

export const observationSchema = z.object({
  key: z.string().min(1).max(80),
  text: longText,
  measurementKeys: z.array(z.string().max(80)).max(20),
});

export const interpretationSchema = z.object({
  text: longText,
  measurementKeys: z.array(z.string().max(80)).max(20),
  caveat: longText,
});

const structured = {
  contractVersion: z.literal("3"),
  imageQuality: imageQualitySchema,
  measurements: z.array(measurementSchema).max(40),
  observations: z.array(observationSchema).max(40),
  interpretations: z.array(interpretationSchema).max(40),
  limitations: z.array(longText).max(30),
  compositeFormula: longText,
};

export const skinCvResultSchema = z.object({
  engine: z.literal("saarthi-cv"),
  engineVersion: z.string().min(1).max(50),
  skinScore: score,
  /** Always null from skin-cv@3: a photograph cannot measure hydration. */
  hydrationScore: nullableScore,
  /** Always null from skin-cv@3: acne is not labelled from photos. */
  acneSeverity: nullableScore,
  confidence: z.number().min(0).max(100).nullable(),
  metrics: z.object({
    acneCount: z.number().int().min(0),
    rednessScore: score,
    pigmentationScore: score,
    wrinkleScore: nullableScore,
    drynessScore: nullableScore,
    oilinessScore: nullableScore,
    skinUniformityScore: nullableScore,
  }),
  findings: z.array(longText).max(40),
  recommendations: z.array(longText).max(20),
  summary: z.string().min(1).max(2000),
  quality: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    blurScore: z.number(),
    brightness: z.number(),
  }),
  ...structured,
});

export const fitnessCvResultSchema = z.object({
  engine: z.literal("saarthi-cv"),
  engineVersion: z.string().min(1).max(50),
  view: z.enum(["frontal", "side"]),
  /** Mean of the posture sub-scores available for the detected view (see compositeFormula). */
  fitnessScore: score,
  postureScore: nullableScore,
  balanceScore: nullableScore,
  symmetryScore: nullableScore,
  /** Always null: mobility cannot be measured from one photo. */
  mobilityScore: nullableScore,
  /** Mean MediaPipe landmark visibility ×100 — model-reported, NOT a calibrated accuracy. */
  confidence: z.number().min(0).max(100).nullable(),
  metrics: z.object({
    view: z.enum(["frontal", "side"]),
    shoulderTiltDeg: z.number().nullable(),
    hipTiltDeg: z.number().nullable(),
    headTiltDeg: z.number().nullable(),
    headLateralOffsetDeg: z.number().nullable(),
    trunkLateralLeanDeg: z.number().nullable(),
    torsoSideLengthDiffPct: z.number().nullable(),
    headForwardAngleDeg: z.number().nullable(),
    trunkSagittalLeanDeg: z.number().nullable(),
    neckAngleDeg: z.number().nullable(),
    spineAngleDeg: z.number().nullable(),
  }),
  findings: z.array(longText).max(40),
  recommendations: z.array(longText).max(20),
  summary: z.string().min(1).max(2000),
  quality: z.object({ width: z.number().int().positive(), height: z.number().int().positive() }),
  ...structured,
});

export type SkinCvResult = z.infer<typeof skinCvResultSchema>;
export type FitnessCvResult = z.infer<typeof fitnessCvResultSchema>;
