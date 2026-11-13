import type { AiFeature, PrismaClient } from "@prisma/client";
import { getEnv } from "@/lib/config/env";
import type { Logger } from "@/lib/logging/logger";
import { AnalysisFailure, classifyUnknown } from "@/server/services/analysis-errors";
import { estimateCostUsd } from "./pricing";
import { getProviderChain } from "./registry";
import {
  modelRefId,
  type AiProvider,
  type ChatRequest,
  type ChatResult,
  type StructuredRequest,
  type TaskRequirements,
  type TokenUsage,
} from "./types";

/**
 * The single entry point for language-model calls.
 *
 * - Selection: walks the configured provider chain and skips any provider lacking a required capability.
 * - Fallback: on a retryable failure the next provider is tried. A non-retryable failure (bad credentials,
 *   invalid request, refusal) stops immediately — a refusal is not laundered through another provider.
 * - Accounting: every attempt writes an AiUsageEvent (latency, tokens, estimated cost, success). Prompt and
 *   response text are never recorded there.
 * - Provenance: callers receive the provider/model that actually answered and the prompt version.
 */

export interface CallContext {
  db: PrismaClient;
  log: Logger;
  feature: AiFeature;
  promptVersion: string;
  userId?: string | null;
}

export interface Provenance {
  provider: string;
  model: string;
  /** "provider:model" that actually answered (server-side fallback may differ from the configured model). */
  servedBy: string;
  promptVersion: string;
  fallbackFrom: string | null;
}

export interface CallStats {
  usage: TokenUsage;
  latencyMs: number;
  estimatedCostUsd: number | null;
}

function eligible(requirements: TaskRequirements): AiProvider[] {
  return getProviderChain().filter(
    (p) => (!requirements.vision || p.capabilities.vision) && (!requirements.streaming || p.capabilities.streaming),
  );
}

async function recordUsage(
  ctx: CallContext,
  provider: AiProvider,
  args: { success: boolean; errorCode?: string; latencyMs: number; usage: TokenUsage; cost: number | null; fallbackFrom: string | null },
) {
  try {
    await ctx.db.aiUsageEvent.create({
      data: {
        userId: ctx.userId ?? null,
        feature: ctx.feature,
        provider: provider.ref.provider,
        model: provider.ref.model,
        promptVersion: ctx.promptVersion,
        success: args.success,
        errorCode: args.errorCode ?? null,
        latencyMs: args.latencyMs,
        inputTokens: args.usage.inputTokens,
        outputTokens: args.usage.outputTokens,
        estimatedCostUsd: args.cost,
        fallbackFrom: args.fallbackFrom,
      },
    });
  } catch (error) {
    // Accounting must never break the user-facing call.
    ctx.log.warn("ai.usage_record_failed", { error });
  }
}

const NO_USAGE: TokenUsage = { inputTokens: null, outputTokens: null };

export function notConfigured(): AnalysisFailure {
  return new AnalysisFailure("LLM_NOT_CONFIGURED", "AI features are not configured on this deployment.", false);
}

export async function generateStructured<T>(
  ctx: CallContext,
  req: StructuredRequest<T>,
  requirements: TaskRequirements = {},
): Promise<{ data: T; provenance: Provenance; stats: CallStats }> {
  const chain = eligible(requirements);
  if (chain.length === 0) throw notConfigured();
  const { priceTable } = getEnv().llm;

  let lastError: AnalysisFailure | undefined;
  let fallbackFrom: string | null = null;
  for (const provider of chain) {
    const started = Date.now();
    try {
      const { data, usage, servedBy } = await provider.generateStructured(req);
      const latencyMs = Date.now() - started;
      const cost = estimateCostUsd(provider.ref.model, usage, priceTable);
      await recordUsage(ctx, provider, { success: true, latencyMs, usage, cost, fallbackFrom });
      return {
        data,
        provenance: {
          provider: provider.ref.provider,
          model: provider.ref.model,
          servedBy,
          promptVersion: ctx.promptVersion,
          fallbackFrom,
        },
        stats: { usage, latencyMs, estimatedCostUsd: cost },
      };
    } catch (error) {
      const failure = classifyUnknown(error);
      await recordUsage(ctx, provider, {
        success: false,
        errorCode: failure.code,
        latencyMs: Date.now() - started,
        usage: NO_USAGE,
        cost: null,
        fallbackFrom,
      });
      ctx.log.warn("ai.provider_failed", { provider: modelRefId(provider.ref), code: failure.code, retryable: failure.retryable });
      lastError = failure;
      if (!failure.retryable) throw failure;
      fallbackFrom = modelRefId(provider.ref);
    }
  }
  throw lastError ?? notConfigured();
}

export interface StreamOutcome extends ChatResult {
  provenance: Provenance;
  stats: CallStats;
}

/**
 * Streams a chat answer. Fallback to the next provider happens only if the failure occurs before the first
 * token was emitted — a partially delivered answer is never silently continued by a different model.
 */
export async function* streamChat(
  ctx: CallContext,
  req: ChatRequest,
): AsyncGenerator<string, StreamOutcome, void> {
  const chain = eligible({});
  if (chain.length === 0) throw notConfigured();
  const { priceTable } = getEnv().llm;

  let fallbackFrom: string | null = null;
  let lastError: AnalysisFailure | undefined;
  for (const provider of chain) {
    const started = Date.now();
    let emitted = false;
    try {
      const gen = provider.streamChat(req);
      for (;;) {
        const next = await gen.next();
        if (next.done) {
          const result = next.value;
          const latencyMs = Date.now() - started;
          const cost = estimateCostUsd(provider.ref.model, result.usage, priceTable);
          await recordUsage(ctx, provider, {
            success: result.stopReason !== "refusal",
            errorCode: result.stopReason === "refusal" ? "LLM_REFUSED" : undefined,
            latencyMs,
            usage: result.usage,
            cost,
            fallbackFrom,
          });
          return {
            ...result,
            provenance: {
              provider: provider.ref.provider,
              model: provider.ref.model,
              servedBy: result.servedBy,
              promptVersion: ctx.promptVersion,
              fallbackFrom,
            },
            stats: { usage: result.usage, latencyMs, estimatedCostUsd: cost },
          };
        }
        emitted = true;
        yield next.value;
      }
    } catch (error) {
      const failure = classifyUnknown(error);
      await recordUsage(ctx, provider, {
        success: false,
        errorCode: failure.code,
        latencyMs: Date.now() - started,
        usage: NO_USAGE,
        cost: null,
        fallbackFrom,
      });
      ctx.log.warn("ai.provider_failed", { provider: modelRefId(provider.ref), code: failure.code, emitted });
      lastError = failure;
      if (emitted || !failure.retryable) throw failure;
      fallbackFrom = modelRefId(provider.ref);
    }
  }
  throw lastError ?? notConfigured();
}
