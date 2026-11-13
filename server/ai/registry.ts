import { getEnv, type LlmProviderName } from "@/lib/config/env";
import { createAnthropicProvider } from "./providers/anthropic";
import { createGeminiProvider, createOpenAiCompatibleProvider } from "./providers/http";
import type { AiProvider } from "./types";

/**
 * Builds the configured provider chain: the primary (LLM_PROVIDER) followed by LLM_FALLBACK_PROVIDERS.
 * A provider appears only when its credentials are configured — a missing key is never assumed to exist.
 */

function build(name: Exclude<LlmProviderName, "none">): AiProvider | null {
  const { llm } = getEnv();
  switch (name) {
    case "anthropic":
      return llm.anthropic ? createAnthropicProvider({ ...llm.anthropic, timeoutMs: llm.timeoutMs }) : null;
    case "gemini":
      return llm.gemini ? createGeminiProvider({ ...llm.gemini, timeoutMs: llm.timeoutMs }) : null;
    case "openai_compatible":
      return llm.openaiCompatible
        ? createOpenAiCompatibleProvider({ ...llm.openaiCompatible, timeoutMs: llm.timeoutMs })
        : null;
  }
}

let override: AiProvider[] | undefined;

/** Tests inject fake providers. */
export function setProvidersForTesting(providers: AiProvider[] | undefined) {
  override = providers;
}

export function getProviderChain(): AiProvider[] {
  if (override) return override;
  const { llm } = getEnv();
  const names = [...(llm.provider === "none" ? [] : [llm.provider]), ...llm.fallbackProviders];
  return names.map(build).filter((p): p is AiProvider => p !== null);
}
