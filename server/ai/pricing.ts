import type { TokenUsage } from "./types";

/**
 * Estimated cost per call, for budgeting dashboards only — never billed to users.
 *
 * Built-in prices are Anthropic first-party list prices (USD per million tokens) as published for the models
 * below. Any model not listed has NO built-in price: its cost is recorded as null rather than guessed. Operators
 * can add or override prices with LLM_PRICE_TABLE, e.g.
 *   LLM_PRICE_TABLE='{"gemini-2.5-flash":{"inputPerMTok":0.3,"outputPerMTok":2.5}}'
 */
export interface ModelPrice {
  inputPerMTok: number;
  outputPerMTok: number;
}

export const BUILT_IN_PRICES: Record<string, ModelPrice> = {
  "claude-opus-5-5": { inputPerMTok: 4, outputPerMTok: 20 },
  "claude-sonnet-5-5": { inputPerMTok: 2, outputPerMTok: 10 },
  "claude-haiku-5-5": { inputPerMTok: 0.1, outputPerMTok: 0.5 },
};

export function estimateCostUsd(
  model: string,
  usage: TokenUsage,
  overrides: Record<string, ModelPrice> = {},
): number | null {
  const price = overrides[model] ?? BUILT_IN_PRICES[model];
  if (!price || usage.inputTokens === null || usage.outputTokens === null) return null;
  const cost = (usage.inputTokens * price.inputPerMTok + usage.outputTokens * price.outputPerMTok) / 1_000_000;
  return Math.round(cost * 1e6) / 1e6;
}
