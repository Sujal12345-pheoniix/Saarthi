import { generateStructuredAIResponse } from '../gemini';
import { SYSTEM_PROMPT_MENTAL } from '../prompts';
import { MentalHealthAnalysisSchema } from '../../validations/ai';
import { z } from 'zod';

type MentalHealthAnalysisResult = z.infer<typeof MentalHealthAnalysisSchema>;

export class MentalHealthAgent {
  static async analyze(
    moodData: Record<string, any>,
    journalEntries: string[]
  ): Promise<MentalHealthAnalysisResult> {
    const prompt = `
User Mood Data: ${JSON.stringify(moodData)}
Journal Entries: ${JSON.stringify(journalEntries)}

Analyze the user's mental health and emotional patterns, and provide a comprehensive report based on the provided information.
    `;

    return generateStructuredAIResponse<MentalHealthAnalysisResult>(
      SYSTEM_PROMPT_MENTAL,
      prompt,
      MentalHealthAnalysisSchema
    );
  }
}
