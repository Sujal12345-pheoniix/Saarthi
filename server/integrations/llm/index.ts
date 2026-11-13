import { getEnv } from "@/lib/config/env";
import { createAnthropicClient } from "./anthropic";
import { createGeminiClient, createOpenAiCompatibleClient } from "./http-providers";
import type { LlmClient } from "./types";

export type { LlmClient, SynthesisOutput } from "./types";

/** Returns the configured LLM client, or null when LLM_PROVIDER resolves to "none". */
export function getLlmClient(): LlmClient | null {
  const { llm } = getEnv();
  switch (llm.provider) {
    case "anthropic":
      return llm.anthropic ? createAnthropicClient({ ...llm.anthropic, timeoutMs: llm.timeoutMs }) : null;
    case "gemini":
      return llm.gemini ? createGeminiClient({ ...llm.gemini, timeoutMs: llm.timeoutMs }) : null;
    case "openai_compatible":
      return llm.openaiCompatible
        ? createOpenAiCompatibleClient({ ...llm.openaiCompatible, timeoutMs: llm.timeoutMs })
        : null;
    default:
      return null;
  }
}
