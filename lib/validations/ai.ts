import { z } from "zod";

export const SkinAnalysisSchema = z.object({
  skinScore: z.number().min(0).max(100),
  detectedIssues: z.array(z.string()),
  confidence: z.number().min(0).max(100),
  severity: z.string(),
  aiSummary: z.string(),
  skincareRoutine: z.array(z.string()),
  hydrationRecommendation: z.string(),
  dietSuggestions: z.array(z.string()),
});

export const MentalHealthAnalysisSchema = z.object({
  moodScore: z.number().min(0).max(100),
  stressLevel: z.number().min(0).max(100),
  anxietyRisk: z.number().min(0).max(100),
  burnoutRisk: z.number().min(0).max(100),
  emotionalSummary: z.string(),
  meditationSuggestions: z.array(z.string()),
  lifestyleRecommendations: z.array(z.string()),
});

export const PhysicalHealthAnalysisSchema = z.object({
  bmi: z.number(),
  fitnessScore: z.number().min(0).max(100),
  healthRisks: z.array(z.string()),
  calorieEstimate: z.number(),
  exerciseRecommendations: z.array(z.string()),
  nutritionSuggestions: z.array(z.string()),
  recoveryAdvice: z.array(z.string()),
});

export const RecommendationSchema = z.object({
  topPriorities: z.array(z.string()),
  dailyGoals: z.array(z.string()),
  weeklyPlan: z.array(z.string()),
  emergencyWarnings: z.array(z.string()),
  habitSuggestions: z.array(z.string()),
});
