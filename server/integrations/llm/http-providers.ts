import { AnalysisFailure } from "@/server/services/analysis-errors";
import { synthesisSchema, type LlmClient, type SynthesisOutput } from "./types";

/**
 * Non-Anthropic providers kept for compatibility with deployments configured before Phase 1
 * (GEMINI_API_KEY or an OpenAI-compatible endpoint). Keys are sent in headers, never in URLs.
 */

const JSON_INSTRUCTION =
  'Respond with ONLY a JSON object of the form {"insights": string, "risks": string[], "actionPlan": string[]}. No markdown.';

function extractJson(text: string): unknown {
  let t = text;
  if (t.includes("</think>")) t = t.split("</think>").pop() ?? t;
  t = t
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first === -1 || last <= first) throw new Error("no JSON object in response");
  return JSON.parse(t.slice(first, last + 1));
}

function validate(value: unknown): SynthesisOutput {
  const parsed = synthesisSchema.safeParse(value);
  if (!parsed.success) {
    throw new AnalysisFailure("LLM_INVALID_OUTPUT", "The AI response did not match the expected format.", true);
  }
  return parsed.data;
}

async function post(url: string, headers: Record<string, string>, body: unknown, timeoutMs: number) {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new AnalysisFailure(
      "LLM_UNAVAILABLE",
      "The AI provider is temporarily unavailable. We will retry.",
      true,
      error,
    );
  }
  if (res.status === 401 || res.status === 403) {
    throw new AnalysisFailure("LLM_AUTH_FAILED", "The AI provider rejected our credentials.", false);
  }
  if (!res.ok) {
    const retryable = res.status === 429 || res.status >= 500;
    throw new AnalysisFailure(
      retryable ? "LLM_UNAVAILABLE" : "LLM_BAD_REQUEST",
      retryable
        ? "The AI provider is temporarily unavailable. We will retry."
        : "The AI provider rejected the request.",
      retryable,
    );
  }
  return res.json() as Promise<unknown>;
}

export function createGeminiClient(cfg: { apiKey: string; model: string; timeoutMs: number }): LlmClient {
  return {
    id: `gemini:${cfg.model}`,
    async synthesize({ system, user }) {
      const data = (await post(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`,
        { "x-goog-api-key": cfg.apiKey },
        {
          systemInstruction: { parts: [{ text: `${system}\n\n${JSON_INSTRUCTION}` }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
        },
        cfg.timeoutMs,
      )) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      try {
        return validate(extractJson(text));
      } catch (error) {
        if (error instanceof AnalysisFailure) throw error;
        throw new AnalysisFailure(
          "LLM_INVALID_OUTPUT",
          "The AI response did not match the expected format.",
          true,
          error,
        );
      }
    },
  };
}

export function createOpenAiCompatibleClient(cfg: {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
}): LlmClient {
  return {
    id: `openai_compatible:${cfg.model}`,
    async synthesize({ system, user }) {
      const data = (await post(
        `${cfg.baseUrl}/chat/completions`,
        { authorization: `Bearer ${cfg.apiKey}` },
        {
          model: cfg.model,
          messages: [
            { role: "system", content: `${system}\n\n${JSON_INSTRUCTION}` },
            { role: "user", content: user },
          ],
          temperature: 0.2,
          max_tokens: 2000,
        },
        cfg.timeoutMs,
      )) as { choices?: Array<{ message?: { content?: string } }> };
      const text = data.choices?.[0]?.message?.content ?? "";
      try {
        return validate(extractJson(text));
      } catch (error) {
        if (error instanceof AnalysisFailure) throw error;
        throw new AnalysisFailure(
          "LLM_INVALID_OUTPUT",
          "The AI response did not match the expected format.",
          true,
          error,
        );
      }
    },
  };
}
