import { generateStructuredAIResponse } from '../gemini';
import { SYSTEM_PROMPT_PHYSICAL } from '../prompts';
import { PhysicalHealthAnalysisSchema } from '../../validations/ai';
import { z } from 'zod';

type PhysicalHealthAnalysisResult = z.infer<typeof PhysicalHealthAnalysisSchema>;

export class PhysicalHealthAgent {
  static async analyze(
    physicalData: Record<string, any>
  ): Promise<PhysicalHealthAnalysisResult> {
    const prompt = `
User Physical Health Data: ${JSON.stringify(physicalData)}

Analyze the user's physical wellness and provide a comprehensive report based on the provided metrics (BMI, sleep, exercise, hydration, etc).
    `;

    return generateStructuredAIResponse<PhysicalHealthAnalysisResult>(
      SYSTEM_PROMPT_PHYSICAL,
      prompt,
      PhysicalHealthAnalysisSchema
    );
  }
}
