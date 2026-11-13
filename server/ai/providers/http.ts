import { AnalysisFailure } from "@/server/services/analysis-errors";
import type { AiProvider, ChatRequest, ChatResult, StructuredRequest, TokenUsage } from "../types";

/**
 * Non-Anthropic adapters kept for deployments configured before Phase 1 (GEMINI_API_KEY or an OpenAI-compatible
 * endpoint). Raw HTTP, keys in headers only.
 *
 * Capabilities are declared conservatively: these adapters are text-only in Saarthi (no image is ever sent),
 * structured output is "prompted" (JSON requested in the prompt, then validated with Zod), and streaming is not
 * implemented — chat answers are delivered as a single chunk.
 */

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

function stripThinking(text: string): string {
  return text.includes("</think>") ? (text.split("</think>").pop() ?? text).trim() : text.trim();
}

async function post(url: string, headers: Record<string, string>, body: unknown, timeoutMs: number, signal?: AbortSignal) {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
      redirect: "error",
    });
  } catch (error) {
    throw new AnalysisFailure("LLM_UNAVAILABLE", "The AI provider is temporarily unavailable.", true, error);
  }
  if (res.status === 401 || res.status === 403) {
    throw new AnalysisFailure("LLM_AUTH_FAILED", "The AI provider rejected our credentials.", false);
  }
  if (!res.ok) {
    const retryable = res.status === 429 || res.status >= 500;
    throw new AnalysisFailure(
      retryable ? "LLM_UNAVAILABLE" : "LLM_BAD_REQUEST",
      retryable ? "The AI provider is temporarily unavailable." : "The AI provider rejected the request.",
      retryable,
    );
  }
  return res.json() as Promise<unknown>;
}

function validated<T>(req: StructuredRequest<T>, text: string): T {
  let value: unknown;
  try {
    value = extractJson(text);
  } catch (error) {
    throw new AnalysisFailure("LLM_INVALID_OUTPUT", "The AI response did not match the expected format.", true, error);
  }
  const parsed = req.schema.safeParse(value);
  if (!parsed.success) {
    throw new AnalysisFailure("LLM_INVALID_OUTPUT", "The AI response did not match the expected format.", true);
  }
  return parsed.data;
}

const TEXT_ONLY = { text: true, vision: false, streaming: false, structuredOutput: "prompted" } as const;

export function createGeminiProvider(cfg: { apiKey: string; model: string; timeoutMs: number }): AiProvider {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`;
  type GeminiResponse = {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const usageOf = (d: GeminiResponse): TokenUsage => ({
    inputTokens: d.usageMetadata?.promptTokenCount ?? null,
    outputTokens: d.usageMetadata?.candidatesTokenCount ?? null,
  });
  const textOf = (d: GeminiResponse) => d.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";

  return {
    ref: { provider: "gemini", model: cfg.model },
    capabilities: TEXT_ONLY,
    async generateStructured<T>(req: StructuredRequest<T>) {
      const data = (await post(
        url,
        { "x-goog-api-key": cfg.apiKey },
        {
          systemInstruction: { parts: [{ text: `${req.system}\n\nRespond with ONLY a JSON object: ${req.jsonShapeHint}` }] },
          contents: [{ role: "user", parts: [{ text: req.user }] }],
          generationConfig: { responseMimeType: "application/json", maxOutputTokens: req.maxOutputTokens },
        },
        cfg.timeoutMs,
      )) as GeminiResponse;
      return { data: validated(req, textOf(data)), usage: usageOf(data), servedBy: `gemini:${cfg.model}` };
    },
    async *streamChat(req: ChatRequest): AsyncGenerator<string, ChatResult, void> {
      const data = (await post(
        url,
        { "x-goog-api-key": cfg.apiKey },
        {
          systemInstruction: { parts: [{ text: req.system }] },
          contents: req.messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
          generationConfig: { maxOutputTokens: req.maxOutputTokens },
        },
        cfg.timeoutMs,
        req.signal,
      )) as GeminiResponse;
      const finish = data.candidates?.[0]?.finishReason;
      if (finish === "SAFETY") return { usage: usageOf(data), stopReason: "refusal", servedBy: `gemini:${cfg.model}` };
      yield stripThinking(textOf(data));
      return {
        usage: usageOf(data),
        stopReason: finish === "MAX_TOKENS" ? "max_tokens" : "end_turn",
        servedBy: `gemini:${cfg.model}`,
      };
    },
  };
}

export function createOpenAiCompatibleProvider(cfg: {
  apiKey: string;
  baseUrl: string;
  model: string;
  timeoutMs: number;
}): AiProvider {
  type ChatResponse = {
    choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const usageOf = (d: ChatResponse): TokenUsage => ({
    inputTokens: d.usage?.prompt_tokens ?? null,
    outputTokens: d.usage?.completion_tokens ?? null,
  });

  return {
    ref: { provider: "openai_compatible", model: cfg.model },
    capabilities: TEXT_ONLY,
    async generateStructured<T>(req: StructuredRequest<T>) {
      const data = (await post(
        `${cfg.baseUrl}/chat/completions`,
        { authorization: `Bearer ${cfg.apiKey}` },
        {
          model: cfg.model,
          messages: [
            { role: "system", content: `${req.system}\n\nRespond with ONLY a JSON object: ${req.jsonShapeHint}` },
            { role: "user", content: req.user },
          ],
          max_tokens: req.maxOutputTokens,
        },
        cfg.timeoutMs,
      )) as ChatResponse;
      const text = data.choices?.[0]?.message?.content ?? "";
      return { data: validated(req, text), usage: usageOf(data), servedBy: `openai_compatible:${cfg.model}` };
    },
    async *streamChat(req: ChatRequest): AsyncGenerator<string, ChatResult, void> {
      const data = (await post(
        `${cfg.baseUrl}/chat/completions`,
        { authorization: `Bearer ${cfg.apiKey}` },
        {
          model: cfg.model,
          messages: [{ role: "system", content: req.system }, ...req.messages],
          max_tokens: req.maxOutputTokens,
        },
        cfg.timeoutMs,
        req.signal,
      )) as ChatResponse;
      const finish = data.choices?.[0]?.finish_reason;
      if (finish === "content_filter") {
        return { usage: usageOf(data), stopReason: "refusal", servedBy: `openai_compatible:${cfg.model}` };
      }
      yield stripThinking(data.choices?.[0]?.message?.content ?? "");
      return {
        usage: usageOf(data),
        stopReason: finish === "length" ? "max_tokens" : "end_turn",
        servedBy: `openai_compatible:${cfg.model}`,
      };
    },
  };
}
