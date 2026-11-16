import type {
  CombinedWellnessReport,
  MentalWellnessReport,
  PhysicalReport,
  ReportMethod,
  SkinReport,
} from "@prisma/client";

/**
 * The shape the dashboard renders. Built on the server from stored rows only.
 * Rules: a value that was not measured is shown as "Not measured"; confidence is shown only when the
 * method actually produced one.
 */

export type DomainKey = "skin" | "physical" | "mental";

export interface ReportMetricView {
  label: string;
  value: string;
  detail: string;
}

/** One computer-vision measurement, formatted for display (contract v3). */
export interface MeasurementView {
  key: string;
  label: string;
  /** Formatted with its unit, or "Not measured". */
  value: string;
  raw: number | null;
  unit: string;
  higherIs: "more_pronounced" | "better" | "neutral";
  explanation: string;
  method: string;
  limitations: string[];
}

/** Structured detail from the CV engine. Null for questionnaire and pre-v3 reports. */
export interface AnalysisDetailView {
  engineVersion: string | null;
  imageQuality: { score: number; width: number; height: number } | null;
  measurements: MeasurementView[];
  observations: string[];
  interpretations: Array<{ text: string; caveat: string }>;
  limitations: string[];
  compositeFormula: string | null;
}

export interface ReportView {
  id: string;
  analysisId: string | null;
  domain: DomainKey;
  method: ReportMethod;
  methodLabel: string;
  title: string;
  subtitle: string;
  score: number;
  confidence: number | null;
  confidenceLabel: string;
  summary: string;
  findings: string[];
  recommendations: string[];
  activities: string[];
  metrics: ReportMetricView[];
  caution: string;
  imageUrl: string | null;
  createdAt: string;
  detail: AnalysisDetailView | null;
}

export interface CombinedReportView {
  id: string;
  analysisId: string | null;
  overallHealthScore: number | null;
  scoreExplanation: string;
  aiInsights: string;
  risks: string[];
  actionPlan: string[];
  model: string | null;
  generatedAt: string;
}

export const METHOD_LABEL: Record<ReportMethod, string> = {
  COMPUTER_VISION: "Computer-vision analysis of your photo",
  QUESTIONNAIRE_RULES: "Rule-based estimate from your answers",
  LLM_SYNTHESIS: "AI-written synthesis of your stored reports",
  LEGACY_UNVERIFIED: "Created before Saarthi's verification update — provenance unverified",
};

const NOT_MEASURED = "Not measured";
const pct = (v: number | null | undefined) => (v === null || v === undefined ? NOT_MEASURED : `${Math.round(v)}%`);
const num = (v: number | null | undefined, digits = 1, unit = "") =>
  v === null || v === undefined ? NOT_MEASURED : `${v.toFixed(digits).replace(/\.0$/, "")}${unit}`;

export function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  return [];
}

const UNIT_SUFFIX: Record<string, (v: number) => string> = {
  count: (v) => String(Math.round(v)),
  index_0_100: (v) => `${Math.round(v)}/100`,
  percent: (v) => `${v.toFixed(1).replace(/.0$/, "")}%`,
  degrees: (v) => `${v.toFixed(1).replace(/.0$/, "")}°`,
  ratio: (v) => v.toFixed(2),
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Reads the CV contract v3 fields stored in report.metrics. Defensive: legacy rows simply return null. */
export function analysisDetail(metrics: unknown, engineVersion: string | null = null): AnalysisDetailView | null {
  if (!isObj(metrics) || !Array.isArray(metrics.measurements)) return null;
  const measurements: MeasurementView[] = metrics.measurements.filter(isObj).map((m) => {
    const raw = typeof m.value === "number" && Number.isFinite(m.value) ? m.value : null;
    const unit = str(m.unit);
    const higherIs = m.higherIs === "better" || m.higherIs === "neutral" ? m.higherIs : "more_pronounced";
    return {
      key: str(m.key),
      label: str(m.label),
      value: raw === null ? NOT_MEASURED : (UNIT_SUFFIX[unit] ?? String)(raw),
      raw,
      unit,
      higherIs,
      explanation: str(m.explanation),
      method: str(m.method),
      limitations: toStringArray(m.limitations),
    };
  });
  const q = isObj(metrics.imageQuality) ? metrics.imageQuality : null;
  return {
    engineVersion,
    imageQuality:
      q && typeof q.score === "number" && typeof q.width === "number" && typeof q.height === "number"
        ? { score: q.score, width: q.width, height: q.height }
        : null,
    measurements,
    observations: Array.isArray(metrics.observations)
      ? metrics.observations.filter(isObj).map((o) => str(o.text)).filter(Boolean)
      : [],
    interpretations: Array.isArray(metrics.interpretations)
      ? metrics.interpretations
          .filter(isObj)
          .map((i) => ({ text: str(i.text), caveat: str(i.caveat) }))
          .filter((i) => i.text)
      : [],
    limitations: toStringArray(metrics.limitations),
    compositeFormula: str(metrics.compositeFormula) || null,
  };
}

function confidenceLabel(method: ReportMethod, confidence: number | null): string {
  if (confidence !== null) {
    return method === "COMPUTER_VISION"
      ? `${Math.round(confidence)}% model-reported detection confidence`
      : `${Math.round(confidence)}% confidence`;
  }
  if (method === "QUESTIONNAIRE_RULES") return "Rule-based estimate (no confidence score)";
  return "Confidence not measured";
}

const SKIN_CAUTION =
  "This report is supportive guidance, not a diagnosis. For a persistent rash, acne flare-ups, pain or changing pigment, see a board-certified dermatologist.";
const PHYSICAL_CAUTION =
  "This is a wellness plan, not medical advice. If you have pain, dizziness, extreme fatigue or rapid weight changes, consult a licensed clinician.";
const MENTAL_CAUTION =
  "This is supportive coaching, not a diagnosis. If you feel unsafe or think about self-harm, contact local emergency services or a crisis line immediately.";

export function skinReportView(r: SkinReport, imageUrl: string | null): ReportView {
  const m = (r.metrics ?? {}) as Record<string, number | null | undefined>;
  const isCv = r.method === "COMPUTER_VISION";
  const detail = isCv ? analysisDetail(r.metrics) : null;
  return {
    id: r.id,
    analysisId: r.analysisId,
    domain: "skin",
    method: r.method,
    methodLabel: METHOD_LABEL[r.method],
    title: "Skin Report",
    subtitle: METHOD_LABEL[r.method],
    score: r.skinScore,
    confidence: r.confidence,
    confidenceLabel: confidenceLabel(r.method, r.confidence),
    summary: r.summary,
    findings: toStringArray(r.detectedIssues),
    recommendations: toStringArray(r.recommendations),
    activities: [
      "Morning: gentle cleanser, moisturiser and SPF.",
      "Avoid harsh scrubs and physical exfoliators.",
      "Note any irritation for 7 days to spot triggers.",
    ],
    metrics: detail
      ? [
          { label: "Skin score", value: pct(r.skinScore), detail: "Composite of the measurements below" },
          ...detail.measurements.slice(0, 3).map((x) => ({ label: x.label, value: x.value, detail: x.explanation })),
        ]
      : isCv
      ? [
          {
            label: "Skin score",
            value: pct(r.skinScore),
            detail: "Composite of spot, redness, pigment and line measurements",
          },
          {
            label: "Texture hydration index",
            value: pct(r.hydrationScore),
            detail: "Derived from cheek texture variance",
          },
          {
            label: "Spot severity",
            value: r.acneSeverity === null ? NOT_MEASURED : `${r.acneSeverity}/100`,
            detail: `${m.acneCount ?? "–"} acne-like spots detected`,
          },
          {
            label: "Redness",
            value: pct(m.rednessScore),
            detail: "Share of red-hued pixels in cheek/forehead regions",
          },
        ]
      : [
          { label: "Skin score", value: pct(r.skinScore), detail: "Rule-based estimate from your answers" },
          {
            label: "Hydration (reported)",
            value: pct(r.hydrationScore),
            detail: "What you reported, not a measurement",
          },
          {
            label: "Sun exposure (reported)",
            value: m.sunExposure === undefined || m.sunExposure === null ? NOT_MEASURED : `${m.sunExposure}/10`,
            detail: "Lower means less photo-stress",
          },
          {
            label: "Sleep (reported)",
            value: num(m.sleepHours as number | null | undefined, 1, "h"),
            detail: "Sleep is the main repair window",
          },
        ],
    caution: SKIN_CAUTION,
    imageUrl: imageUrl ?? null,
    createdAt: r.createdAt.toISOString(),
    detail,
  };
}

export function physicalReportView(r: PhysicalReport, imageUrl: string | null): ReportView {
  const isCv = r.method === "COMPUTER_VISION";
  const detail = isCv ? analysisDetail(r.metrics) : null;
  return {
    id: r.id,
    analysisId: r.analysisId,
    domain: "physical",
    method: r.method,
    methodLabel: METHOD_LABEL[r.method],
    title: isCv ? "Posture Report" : "Physical Wellness Report",
    subtitle: r.goal ? `${r.goal} · ${METHOD_LABEL[r.method]}` : METHOD_LABEL[r.method],
    score: r.fitnessScore,
    confidence: r.confidence,
    confidenceLabel: confidenceLabel(r.method, r.confidence),
    summary: r.summary,
    findings: toStringArray(r.detectedIssues),
    recommendations: toStringArray(r.recommendations),
    activities: [
      "10-minute warm-up: shoulder rolls, hip circles, bodyweight squats.",
      "Take a short walk after your largest meal.",
      "Finish the day with a 5-minute stretch.",
    ],
    metrics: isCv
      ? [
          { label: "Posture score", value: pct(r.postureScore), detail: "From shoulder, hip and neck angles" },
          { label: "Balance score", value: pct(r.balanceScore), detail: "From spine deviation and head tilt" },
          { label: "Symmetry score", value: pct(r.symmetryScore), detail: "From shoulder and hip tilt" },
          {
            label: "Mobility",
            value: pct(r.mobilityScore),
            detail: "Requires movement capture; a single photo cannot measure it",
          },
        ]
      : [
          { label: "Physical score", value: pct(r.fitnessScore), detail: "Rule-based estimate from your answers" },
          {
            label: "Water (reported)",
            value: num(r.waterLiters, 1, " L"),
            detail: "Aim for ~2.5 L when training hard",
          },
          {
            label: "Workout (reported)",
            value: r.workoutMinutes === null ? NOT_MEASURED : `${r.workoutMinutes} min`,
            detail: "Consistency compounds",
          },
          { label: "BMI (calculated)", value: num(r.bmi), detail: "From the height and weight you entered" },
        ],
    caution: PHYSICAL_CAUTION,
    imageUrl: imageUrl ?? null,
    createdAt: r.createdAt.toISOString(),
    detail,
  };
}

export function mentalReportView(r: MentalWellnessReport): ReportView {
  const m = (r.metrics ?? {}) as Record<string, unknown>;
  return {
    id: r.id,
    analysisId: r.analysisId,
    domain: "mental",
    method: r.method,
    methodLabel: METHOD_LABEL[r.method],
    title: "Mental Wellness Check-in",
    subtitle: METHOD_LABEL[r.method],
    score: r.wellnessScore,
    confidence: r.confidence,
    confidenceLabel: confidenceLabel(r.method, r.confidence),
    summary: r.summary,
    findings: toStringArray(m.findings),
    recommendations: toStringArray(r.recommendations),
    activities: [
      "5-minute grounding walk with a slower exhale than inhale.",
      "10-line journal reset: what happened, what I feel, what I need.",
      "Send one supportive message to someone you trust.",
    ],
    metrics: [
      { label: "Wellness score", value: pct(r.wellnessScore), detail: "Rule-based estimate from your answers" },
      {
        label: "Mood (reported)",
        value: r.moodRating === null ? NOT_MEASURED : `${r.moodRating}/5`,
        detail: "Rest and routine move this",
      },
      {
        label: "Stress (reported)",
        value: r.stressLevel === null ? NOT_MEASURED : `${r.stressLevel}/100`,
        detail: "Lower through structure and pauses",
      },
      { label: "Sleep (reported)", value: num(r.sleepHours, 1, "h"), detail: "Sleep strongly affects mood regulation" },
    ],
    caution: MENTAL_CAUTION,
    imageUrl: null,
    createdAt: r.createdAt.toISOString(),
    detail: null,
  };
}

export function combinedReportView(r: CombinedWellnessReport): CombinedReportView {
  return {
    id: r.id,
    analysisId: r.analysisId,
    overallHealthScore: r.overallHealthScore,
    scoreExplanation:
      r.method === "LEGACY_UNVERIFIED"
        ? "Produced by an earlier AI version before Saarthi's verification update; not a calculated score."
        : r.overallHealthScore === null
          ? "No overall score: no verified domain reports were available."
          : "Average of your latest verified skin, physical and mental scores. Calculated by Saarthi, not by the AI model.",
    aiInsights: r.aiInsights,
    risks: toStringArray(r.risks),
    actionPlan: toStringArray(r.actionPlan),
    model: r.model,
    generatedAt: r.generatedAt.toISOString(),
  };
}
