import { generateStructuredAIResponse } from '../gemini';
import { SYSTEM_PROMPT_RECOMMENDATION } from '../prompts';
import { RecommendationSchema } from '../../validations/ai';
import { z } from 'zod';

type RecommendationResult = z.infer<typeof RecommendationSchema>;

export class RecommendationAgent {
  static async analyze(
    skinReport: any,
    mentalReport: any,
    physicalReport: any
  ): Promise<RecommendationResult> {
    const prompt = `
Skin Report: ${JSON.stringify(skinReport)}
Mental Health Report: ${JSON.stringify(mentalReport)}
Physical Health Report: ${JSON.stringify(physicalReport)}

Analyze the cross-domain patterns across these reports and generate a holistic personalized action plan.
    `;

    return generateStructuredAIResponse<RecommendationResult>(
      SYSTEM_PROMPT_RECOMMENDATION,
      prompt,
      RecommendationSchema
    );
  }
}
