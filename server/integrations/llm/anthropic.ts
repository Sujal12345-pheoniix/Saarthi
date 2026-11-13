import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { AnalysisFailure } from "@/server/services/analysis-errors";
import { synthesisSchema, type LlmClient, type SynthesisOutput } from "./types";

/**
 * Claude provider (official SDK, structured outputs).
 * - `messages.parse` + `zodOutputFormat` constrains the response to the synthesis schema.
 * - Thinking is adaptive by default on Claude Opus 5.5; effort is set explicitly.
 * - A refusal or unparseable output fails the job instead of being replaced by defaults.
 */
export function createAnthropicClient(cfg: { apiKey: string; model: string; timeoutMs: number }): LlmClient {
  const client = new Anthropic({ apiKey: cfg.apiKey, timeout: cfg.timeoutMs, maxRetries: 2 });
  return {
    id: `anthropic:${cfg.model}`,
    async synthesize({ system, user }): Promise<SynthesisOutput> {
      let response;
      try {
        response = await client.messages.parse({
          model: cfg.model,
          max_tokens: 16000,
          system,
          messages: [{ role: "user", content: user }],
          output_config: { effort: "medium", format: zodOutputFormat(synthesisSchema) },
        });
      } catch (error) {
        if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
          throw new AnalysisFailure("LLM_AUTH_FAILED", "The AI provider rejected our credentials.", false, error);
        }
        if (error instanceof Anthropic.BadRequestError || error instanceof Anthropic.NotFoundError) {
          throw new AnalysisFailure("LLM_BAD_REQUEST", "The AI provider rejected the request.", false, error);
        }
        if (error instanceof Anthropic.RateLimitError || error instanceof Anthropic.APIError) {
          throw new AnalysisFailure(
            "LLM_UNAVAILABLE",
            "The AI provider is temporarily unavailable. We will retry.",
            true,
            error,
          );
        }
        throw new AnalysisFailure(
          "LLM_UNAVAILABLE",
          "The AI provider is temporarily unavailable. We will retry.",
          true,
          error,
        );
      }

      if (response.stop_reason === "refusal") {
        throw new AnalysisFailure("LLM_REFUSED", "The AI model declined to produce this report.", false);
      }
      if (response.stop_reason === "max_tokens") {
        throw new AnalysisFailure("LLM_TRUNCATED", "The AI response was incomplete. We will retry.", true);
      }
      const parsed = synthesisSchema.safeParse(response.parsed_output);
      if (!parsed.success) {
        throw new AnalysisFailure("LLM_INVALID_OUTPUT", "The AI response did not match the expected format.", true);
      }
      return parsed.data;
    },
  };
}
