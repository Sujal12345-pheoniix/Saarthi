import { generateStructuredAIResponse } from '../gemini';
import { SYSTEM_PROMPT_SKIN } from '../prompts';
import { SkinAnalysisSchema } from '../../validations/ai';
import { z } from 'zod';

type SkinAnalysisResult = z.infer<typeof SkinAnalysisSchema>;

export class SkinAgent {
  static async analyze(
    imageUrl: string,
    questionnaire: Record<string, any>
  ): Promise<SkinAnalysisResult> {
    const prompt = `
User Skin Image URL (for reference/vision if supported): ${imageUrl}
User Questionnaire Data: ${JSON.stringify(questionnaire)}

Analyze the user's skin health and provide a comprehensive report based on the provided information.
    `;

    // In a real implementation with Gemini Vision, we could pass the image directly.
    // For now, we pass the URL and questionnaire text.
    return generateStructuredAIResponse<SkinAnalysisResult>(
      SYSTEM_PROMPT_SKIN,
      prompt,
      SkinAnalysisSchema
    );
  }
}
