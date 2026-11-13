import type { z } from "zod";

/**
 * Saarthi AI orchestration contracts.
 *
 * Provider adapters declare their capabilities explicitly. The orchestrator refuses to route a task to a model
 * that lacks a required capability — in particular, no image is ever sent to (or described as seen by) a model
 * whose adapter does not declare `vision`. As of Phase 2 no Saarthi feature sends images to a language model at
 * all: images are analysed only by the CV service.
 */

export type ProviderName = "anthropic" | "gemini" | "openai_compatible";

export interface ProviderCapabilities {
  text: true;
  /** Accepts image inputs. Declared per adapter; never assumed from the provider name. */
  vision: boolean;
  /** Emits incremental text. Non-streaming adapters yield the full text once. */
  streaming: boolean;
  /** "native": the API enforces the JSON schema. "prompted": JSON requested in the prompt, validated after. */
  structuredOutput: "native" | "prompted";
}

export interface ModelRef {
  provider: ProviderName;
  model: string;
}

export const modelRefId = (ref: ModelRef) => `${ref.provider}:${ref.model}`;

export interface TokenUsage {
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface StructuredRequest<T> {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  /** Plain-language JSON shape, used by "prompted" adapters only. */
  jsonShapeHint: string;
  maxOutputTokens: number;
  /** Relative reasoning depth where the provider supports it. */
  effort: "low" | "medium" | "high";
}

export interface ChatRequest {
  system: string;
  messages: ChatTurn[];
  maxOutputTokens: number;
  effort: "low" | "medium" | "high";
  signal?: AbortSignal;
}

export interface ChatResult {
  usage: TokenUsage;
  stopReason: "end_turn" | "max_tokens" | "refusal" | "other";
  /** The model that actually answered (server-side fallbacks can change it). */
  servedBy: string;
}

export interface AiProvider {
  readonly ref: ModelRef;
  readonly capabilities: ProviderCapabilities;
  generateStructured<T>(req: StructuredRequest<T>): Promise<{ data: T; usage: TokenUsage; servedBy: string }>;
  /** Yields text deltas; the generator's return value carries usage and stop reason. */
  streamChat(req: ChatRequest): AsyncGenerator<string, ChatResult, void>;
}

export interface TaskRequirements {
  vision?: boolean;
  streaming?: boolean;
}
