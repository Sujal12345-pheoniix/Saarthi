import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateStructuredAIResponse<T>(
  systemInstruction: string,
  prompt: string,
  schema: z.ZodType<T>
): Promise<T> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      // We'll let the model output JSON and then we validate with Zod locally
    },
  });

  if (!response.text) {
    throw new Error('No text generated from Gemini');
  }

  const parsed = JSON.parse(response.text);
  return schema.parse(parsed);
}
