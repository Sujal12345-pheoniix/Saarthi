export type WellnessDomain = "skin" | "physical" | "mental";

export type ReportMetric = {
  label: string;
  value: string;
  detail: string;
};

export type WellnessReport = {
  domain: WellnessDomain;
  title: string;
  subtitle: string;
  score: number;
  confidence: number;
  summary: string;
  findings: string[];
  recommendations: string[];
  activities: string[];
  metrics: ReportMetric[];
  caution: string;
  imageUrl?: string | null;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number) => Math.round(value);
const formatNumber = (value: number) => value.toFixed(1).replace(/\.0$/, "");

export function generateSkinReport(input: {
  skinType: string;
  concerns: string[];
  hydration: number;
  sunExposure: number;
  sleepHours: number;
  imageUrl?: string | null;
}): WellnessReport {
  const concernPenalty = input.concerns.length * 4;
  const hydrationBonus = input.hydration * 0.45;
  const sunPenalty = input.sunExposure * 5;
  const sleepBonus = clamp(input.sleepHours, 0, 9) * 2;
  const score = clamp(round(58 + hydrationBonus + sleepBonus - concernPenalty - sunPenalty), 35, 97);

  return {
    domain: "skin",
    title: "Dermatology-style Skin Report",
    subtitle: `${input.skinType || "Balanced"} skin tuned for barrier support and glow recovery`,
    score,
    confidence: clamp(84 + hydrationBonus / 2 - concernPenalty, 72, 98),
    summary:
      score >= 80
        ? "Your skin barrier looks relatively stable. The fastest gains will come from hydration, sun protection, and consistent night repair."
        : "Your skin needs a calmer routine with more hydration support and stricter UV protection to reduce irritation and dullness.",
    findings: [
      `Primary skin type: ${input.skinType || "balanced"}.`,
      `Hydration signal is ${formatNumber(input.hydration)}% and can be improved with barrier-first care.`,
      input.concerns.length ? `Detected concerns: ${input.concerns.join(", ")}.` : "No major concern flags were selected today.",
      input.imageUrl ? "A photo was uploaded for longitudinal tracking in Cloudinary." : "No image was uploaded, so this read is based on your self-reporting.",
    ],
    recommendations: [
      "AM: use a gentle cleanser, niacinamide serum, and SPF 50 before stepping outside.",
      input.hydration < 70 ? "Add a hydrating layer with hyaluronic acid or glycerin after cleansing." : "Keep your barrier steady with a lightweight ceramide moisturizer.",
      input.sunExposure > 4 ? "Reapply sunscreen every 2-3 hours and add a cap or wide-brim hat outdoors." : "Keep daily SPF as a non-negotiable even on cloudy days.",
      "PM: double cleanse if you wore sunscreen, then finish with a barrier-repair moisturizer.",
    ],
    activities: [
      "60-second skin check in natural light before bed.",
      "2-minute face massage while applying moisturizer to support circulation.",
      "Drink one glass of water before each main meal today.",
    ],
    metrics: [
      { label: "Skin score", value: `${score}%`, detail: "Higher means a calmer, better protected barrier" },
      { label: "Hydration", value: `${round(input.hydration)}%`, detail: "Aim for a steady upward trend over time" },
      { label: "Sun exposure", value: `${input.sunExposure}/10`, detail: "Lower scores here mean less photo-stress" },
      { label: "Recovery", value: `${clamp(round(input.sleepHours * 11), 45, 99)}%`, detail: "Sleep is your main repair window" },
    ],
    caution:
      "This report is supportive guidance, not a diagnosis. If you have persistent rash, acne flare-ups, pain, or pigment changes, a board-certified dermatologist should assess it.",
    imageUrl: input.imageUrl ?? null,
  };
}

export function generatePhysicalReport(input: {
  heightCm?: number;
  weightKg?: number;
  waterLiters: number;
  workoutMinutes: number;
  sleepHours: number;
  activityLevel: number;
  goal: string;
  imageUrl?: string | null;
}): WellnessReport {
  const bmi = input.heightCm && input.weightKg
    ? input.weightKg / Math.pow(input.heightCm / 100, 2)
    : undefined;

  const dietFocus = bmi && bmi >= 25
    ? ["Protein-forward breakfast", "Fiber-rich lunch", "Lighter dinner with vegetables and lean protein"]
    : ["Balanced protein at each meal", "Complex carbs around workouts", "One recovery snack after exercise"];

  const workoutMinutes = clamp(input.workoutMinutes, 0, 180);
  const activityScore = clamp(round(48 + input.waterLiters * 6 + workoutMinutes * 0.18 + input.activityLevel * 6 + input.sleepHours * 2), 35, 98);

  return {
    domain: "physical",
    title: "Physical Performance Report",
    subtitle: `${input.goal || "Strength and energy"} plan with diet, workout, and recovery guidance`,
    score: activityScore,
    confidence: clamp(80 + input.activityLevel * 3, 72, 97),
    summary:
      bmi && bmi > 25
        ? "Your current profile suggests the best lever is a clean, high-protein diet paired with a consistent training rhythm and better recovery."
        : "Your physical baseline looks workable. The biggest gains will come from consistency in meals, movement, and hydration.",
    findings: [
      bmi ? `BMI estimate: ${formatNumber(bmi)}.` : "BMI could not be calculated because height or weight is missing.",
      `Water intake today: ${formatNumber(input.waterLiters)} L.`,
      `Workout duration target: ${workoutMinutes} minutes.`,
      input.imageUrl ? "Progress photo uploaded for body-composition trend tracking." : "No progress photo uploaded yet, so the review is based on logs only.",
    ],
    recommendations: [
      `Diet plan: ${dietFocus.join(" | ")}.`,
      "Daily target: 1 palm of protein, 1 fist of vegetables, and 1 cupped-hand portion of smart carbs per meal.",
      workoutMinutes >= 45
        ? "Workout schedule: 3 strength sessions, 2 mobility/zone-2 sessions, and 1 active recovery day each week."
        : "Workout schedule: start with 25-35 minutes of brisk walking or strength circuits and add 5 minutes every 3 days.",
      "Add electrolytes after sweaty sessions and keep sleep between 7 and 9 hours for recovery.",
    ],
    activities: [
      "10-minute warm-up: marching, hip circles, shoulder rolls, and bodyweight squats.",
      "12-minute conditioning block: squats, push-ups, rows, and planks on repeat.",
      "5-minute evening stretch to lower stiffness and improve sleep quality.",
    ],
    metrics: [
      { label: "Physical score", value: `${activityScore}%`, detail: "A higher score reflects stronger habits" },
      { label: "Hydration", value: `${formatNumber(input.waterLiters)}L`, detail: "Try to push toward 2.5L if training hard" },
      { label: "Workout", value: `${workoutMinutes} min`, detail: "Regular movement compounds quickly" },
      { label: "Recovery", value: `${round(clamp(input.sleepHours * 11, 45, 99))}%`, detail: "Sleep is your main performance multiplier" },
    ],
    caution:
      "This is a wellness plan, not medical advice. If you have pain, dizziness, extreme fatigue, or rapid weight changes, get a licensed clinician involved.",
    imageUrl: input.imageUrl ?? null,
  };
}

export function generateMentalReport(input: {
  mood: number;
  stress: number;
  sleepHours: number;
  energy: number;
  journal: string;
}): WellnessReport {
  const score = clamp(round(62 + input.mood * 6 + input.energy * 4 + input.sleepHours * 2 - input.stress * 0.5), 30, 98);
  const needsSupport = input.stress >= 70 || input.mood <= 3;

  return {
    domain: "mental",
    title: "Psychology-style Mental Health Report",
    subtitle: "Mood, stress, and recovery guidance built for a calmer day",
    score,
    confidence: clamp(82 + (10 - Math.abs(input.mood - 5)) * 2, 72, 98),
    summary:
      needsSupport
        ? "Your stress load is elevated. The fastest wins are to reduce stimulation, restore sleep rhythm, and create short grounding breaks between tasks."
        : "Your mental state looks fairly steady. Keep your routines tight so a good day does not drift into a scattered one.",
    findings: [
      `Mood level: ${input.mood}/5.`,
      `Stress level: ${input.stress}/100.`,
      `Sleep last night: ${formatNumber(input.sleepHours)} hours.`,
      input.journal.trim()
        ? "Journal entry received for pattern-aware reflection."
        : "No journal entry added today, so the feedback is based on your mood and recovery inputs.",
    ],
    recommendations: [
      "Practice 4-7-8 breathing for two rounds before starting focused work.",
      "Protect one 15-minute no-screen window in the afternoon to reset your nervous system.",
      "Write down one problem, one controllable action, and one thing that is already okay.",
      needsSupport
        ? "If these feelings persist or intensify, reach out to a mental health professional or trusted person today."
        : "Keep your sleep schedule and morning light exposure consistent to preserve stability.",
    ],
    activities: [
      "5-minute grounding walk with slower exhale than inhale.",
      "10-line journal reset: what happened, what I feel, what I need.",
      "One supportive message to a friend, family member, or teammate.",
    ],
    metrics: [
      { label: "Mental score", value: `${score}%`, detail: "Higher means more emotional steadiness" },
      { label: "Mood", value: `${input.mood}/5`, detail: "Try to move this with rest and routine" },
      { label: "Stress", value: `${input.stress}%`, detail: "Lower through structure and pauses" },
      { label: "Sleep", value: `${formatNumber(input.sleepHours)}h`, detail: "Sleep quality strongly affects mood regulation" },
    ],
    caution:
      "This is supportive coaching, not a diagnosis. If you feel unsafe or think about self-harm, contact local emergency services or a crisis hotline immediately.",
  };
}
