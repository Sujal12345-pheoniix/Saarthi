import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { AnalysisFailure } from "@/server/services/analysis-errors";
import type { AiProvider, ChatRequest, ChatResult, StructuredRequest, TokenUsage } from "../types";

/**
 * Claude adapter (official SDK).
 * - Structured output: `beta.messages.parse` + `betaZodOutputFormat` — the API constrains the response to the schema,
 *   and the result is validated again with Zod.
 * - Streaming chat: `beta.messages.stream`, text deltas forwarded as they arrive.
 * - Server-side refusal fallback (`fallbacks: "default"`) is enabled: if a safety classifier declines, Anthropic
 *   re-runs the request on a fallback model inside the same call. The model that actually answered is recorded.
 * - Thinking is adaptive (the default on Claude Opus 5.5); depth is set with `effort`.
 * - Vision: the Messages API accepts images, but Saarthi sends none (images go to the CV service only).
 */

const FALLBACK_BETA = "server-side-fallback-2026-07-01";

function usageOf(u: { input_tokens?: number | null; output_tokens?: number | null } | undefined): TokenUsage {
  return { inputTokens: u?.input_tokens ?? null, outputTokens: u?.output_tokens ?? null };
}

export function mapAnthropicError(error: unknown): AnalysisFailure {
  if (error instanceof AnalysisFailure) return error;
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new AnalysisFailure("LLM_AUTH_FAILED", "The AI provider rejected our credentials.", false, error);
  }
  if (error instanceof Anthropic.BadRequestError || error instanceof Anthropic.NotFoundError) {
    return new AnalysisFailure("LLM_BAD_REQUEST", "The AI provider rejected the request.", false, error);
  }
  if (error instanceof Anthropic.RateLimitError) {
    return new AnalysisFailure("LLM_RATE_LIMITED", "The AI provider is busy. Please try again shortly.", true, error);
  }
  if (error instanceof Anthropic.APIUserAbortError) {
    return new AnalysisFailure("LLM_ABORTED", "The request was cancelled.", false, error);
  }
  return new AnalysisFailure("LLM_UNAVAILABLE", "The AI provider is temporarily unavailable.", true, error);
}

export function createAnthropicProvider(cfg: { apiKey: string; model: string; timeoutMs: number }): AiProvider {
  const client = new Anthropic({ apiKey: cfg.apiKey, timeout: cfg.timeoutMs, maxRetries: 2 });

  return {
    ref: { provider: "anthropic", model: cfg.model },
    capabilities: { text: true, vision: true, streaming: true, structuredOutput: "native" },

    async generateStructured<T>(req: StructuredRequest<T>) {
      let response;
      try {
        response = await client.beta.messages.parse({
          model: cfg.model,
          max_tokens: req.maxOutputTokens,
          betas: [FALLBACK_BETA],
          fallbacks: "default",
          system: req.system,
          messages: [{ role: "user", content: req.user }],
          output_config: { effort: req.effort, format: betaZodOutputFormat(req.schema) },
        });
      } catch (error) {
        throw mapAnthropicError(error);
      }
      if (response.stop_reason === "refusal") {
        throw new AnalysisFailure("LLM_REFUSED", "The AI model declined to produce this output.", false);
      }
      if (response.stop_reason === "max_tokens") {
        throw new AnalysisFailure("LLM_TRUNCATED", "The AI response was incomplete.", true);
      }
      const parsed = req.schema.safeParse(response.parsed_output);
      if (!parsed.success) {
        throw new AnalysisFailure("LLM_INVALID_OUTPUT", "The AI response did not match the expected format.", true);
      }
      return { data: parsed.data, usage: usageOf(response.usage), servedBy: `anthropic:${response.model}` };
    },

    async *streamChat(req: ChatRequest): AsyncGenerator<string, ChatResult, void> {
      const stream = client.beta.messages.stream(
        {
          model: cfg.model,
          max_tokens: req.maxOutputTokens,
          betas: [FALLBACK_BETA],
          fallbacks: "default",
          system: req.system,
          messages: req.messages,
          output_config: { effort: req.effort },
        },
        { signal: req.signal },
      );
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            yield event.delta.text;
          }
        }
        const final = await stream.finalMessage();
        const stopReason =
          final.stop_reason === "end_turn" || final.stop_reason === "max_tokens" || final.stop_reason === "refusal"
            ? final.stop_reason
            : "other";
        return { usage: usageOf(final.usage), stopReason, servedBy: `anthropic:${final.model}` };
      } catch (error) {
        throw mapAnthropicError(error);
      }
    },
  };
}
