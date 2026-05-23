import { z } from 'zod';

type OpenAICompatibleMessage = {
  role: 'system' | 'user';
  content: string;
};

function extractJsonPayload(text: string) {
  const trimmed = text.trim();

  if (trimmed.startsWith('```')) {
    const stripped = trimmed
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```$/i, '')
      .trim();

    if (stripped) {
      return stripped;
    }
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');

  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

export async function generateStructuredAIResponse<T>(
  systemInstruction: string,
  prompt: string,
  schema: z.ZodType<T>
): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY || process.env.NVIDIA_API_KEY || process.env.GEMINI_API_KEY;
  const baseUrl = (process.env.OPENAI_BASE_URL || 'https://integrate.api.nvidia.com/v1').replace(/\/$/, '');
  const model = process.env.OPENAI_MODEL || 'deepseek-ai/deepseek-r1';

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemInstruction },
        { role: 'user', content: prompt },
      ] satisfies OpenAICompatibleMessage[],
      temperature: 0.2,
      max_tokens: 1200,
    }),
  });

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`NVIDIA DeepSeek request failed (${response.status}): ${responseText}`);
  }

  const payload = JSON.parse(responseText) as {
    choices?: Array<{ message?: { content?: string }; text?: string }>;
  };

  const content = payload.choices?.[0]?.message?.content || payload.choices?.[0]?.text || '';

  if (!content) {
    throw new Error('No text generated from NVIDIA DeepSeek');
  }

  const parsed = JSON.parse(extractJsonPayload(content));
  return schema.parse(parsed);
}
