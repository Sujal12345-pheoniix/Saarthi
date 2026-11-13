import { z } from "zod";

/**
 * Validated server configuration.
 *
 * - Parsed lazily (first call to getEnv) so `next build` never needs runtime secrets.
 * - Error messages name variables only, never their values.
 * - Stricter rules apply when APP_ENV is "staging" or "production".
 *
 * Documented in docs/deployment/ENVIRONMENT_CONFIGURATION.md.
 */

const boolFlag = z
  .enum(["true", "false", "1", "0", ""])
  .optional()
  .transform((v) => v === "true" || v === "1");

const csv = z
  .string()
  .optional()
  .transform((v) =>
    (v ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );

const optionalString = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

const optionalUrl = optionalString.pipe(z.string().url().optional());

const rawSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.enum(["development", "test", "staging", "production"]).optional(),
  APP_URL: optionalUrl,
  ALLOWED_ORIGINS: csv,
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  DATABASE_URL: optionalString,

  CLERK_SECRET_KEY: optionalString,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: optionalString,
  DEV_ALLOW_ANON: boolFlag,

  REDIS_URL: optionalString,
  UPSTASH_REDIS_REST_URL: optionalString,
  UPSTASH_REDIS_REST_TOKEN: optionalString,
  ANALYSIS_EXECUTION_MODE: z.enum(["queue", "inline"]).default("queue"),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(32).default(2),
  RATE_LIMIT_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),

  CLOUDINARY_CLOUD_NAME: optionalString,
  CLOUDINARY_API_KEY: optionalString,
  CLOUDINARY_API_SECRET: optionalString,
  STORAGE_ALLOWED_HOSTS: csv,

  AI_SERVICE_URL: optionalUrl,
  AI_SERVICE_TOKEN: optionalString,
  AI_SERVICE_TIMEOUT_MS: z.coerce.number().int().min(1000).max(300_000).default(60_000),

  LLM_PROVIDER: z.enum(["anthropic", "gemini", "openai_compatible", "none"]).optional(),
  LLM_TIMEOUT_MS: z.coerce.number().int().min(1000).max(600_000).default(120_000),
  ANTHROPIC_API_KEY: optionalString,
  ANTHROPIC_MODEL: z.string().default("claude-opus-5-5"),
  GEMINI_API_KEY: optionalString,
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  OPENAI_API_KEY: optionalString,
  OPENAI_BASE_URL: optionalUrl,
  OPENAI_MODEL: optionalString,
  /** Ordered fallback providers tried when the primary fails with a retryable error, e.g. "gemini". */
  LLM_FALLBACK_PROVIDERS: csv,
  /** Optional JSON price overrides: {"model":{"inputPerMTok":n,"outputPerMTok":n}}. */
  LLM_PRICE_TABLE: optionalString,

  /** base64 of 32 random bytes. Encrypts journal entries and companion messages at the application layer. */
  FIELD_ENCRYPTION_KEY: optionalString,
  /** Port for the worker's /health and /ready endpoints. Unset = no health server. */
  WORKER_HEALTH_PORT: z.coerce.number().int().min(1).max(65535).optional(),
});

export type AppEnvName = "development" | "test" | "staging" | "production";
export type LlmProviderName = "anthropic" | "gemini" | "openai_compatible" | "none";

export interface ServerEnv {
  nodeEnv: "development" | "test" | "production";
  appEnv: AppEnvName;
  appUrl?: string;
  allowedOrigins: string[];
  logLevel: "debug" | "info" | "warn" | "error";
  databaseUrl?: string;
  clerk: { secretKey?: string; publishableKey?: string };
  /** True only when every development-only condition holds (see isDevAuthBypassAllowed). */
  devAuthBypass: boolean;
  redisUrl?: string;
  analysisExecutionMode: "queue" | "inline";
  workerConcurrency: number;
  rateLimitEnabled: boolean;
  cloudinary?: { cloudName: string; apiKey: string; apiSecret: string };
  storageAllowedHosts: string[];
  aiService?: { url: string; token?: string; timeoutMs: number };
  llm: {
    provider: LlmProviderName;
    timeoutMs: number;
    anthropic?: { apiKey: string; model: string };
    gemini?: { apiKey: string; model: string };
    openaiCompatible?: { apiKey: string; baseUrl: string; model: string };
    /** Tried in order when the primary fails with a retryable error. Never includes the primary. */
    fallbackProviders: Exclude<LlmProviderName, "none">[];
    priceTable: Record<string, { inputPerMTok: number; outputPerMTok: number }>;
  };
  /** 32-byte AES-256-GCM key, or undefined when field encryption is not configured. */
  fieldEncryptionKey?: Buffer;
  workerHealthPort?: number;
}

export class ConfigError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Invalid server configuration:\n  - ${issues.join("\n  - ")}`);
    this.name = "ConfigError";
  }
}

/** Derive a Redis URL. Supports the Upstash REST variables the project used before Phase 1. */
function resolveRedisUrl(raw: z.infer<typeof rawSchema>): string | undefined {
  if (raw.REDIS_URL) return raw.REDIS_URL;
  if (raw.UPSTASH_REDIS_REST_URL && raw.UPSTASH_REDIS_REST_TOKEN) {
    try {
      const host = new URL(raw.UPSTASH_REDIS_REST_URL).hostname;
      return `rediss://default:${encodeURIComponent(raw.UPSTASH_REDIS_REST_TOKEN)}@${host}:6379`;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** If LLM_PROVIDER is unset, infer it from the single configured key (documented behaviour). */
function resolveLlmProvider(raw: z.infer<typeof rawSchema>): LlmProviderName {
  if (raw.LLM_PROVIDER) return raw.LLM_PROVIDER;
  if (raw.ANTHROPIC_API_KEY) return "anthropic";
  if (raw.GEMINI_API_KEY) return "gemini";
  if (raw.OPENAI_API_KEY && raw.OPENAI_BASE_URL && raw.OPENAI_MODEL) return "openai_compatible";
  return "none";
}

export function parseEnv(source: Record<string, string | undefined>): ServerEnv {
  const parsed = rawSchema.safeParse(source);
  if (!parsed.success) {
    throw new ConfigError(parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`));
  }
  const raw = parsed.data;
  const appEnv: AppEnvName = raw.APP_ENV ?? (raw.NODE_ENV === "production" ? "production" : raw.NODE_ENV);
  const strict = appEnv === "production" || appEnv === "staging";
  const issues: string[] = [];

  const redisUrl = resolveRedisUrl(raw);
  const provider = resolveLlmProvider(raw);

  // ── Rules that apply everywhere ──
  if (raw.DEV_ALLOW_ANON && (raw.NODE_ENV !== "development" || appEnv !== "development")) {
    issues.push(
      "DEV_ALLOW_ANON: must not be enabled outside local development (NODE_ENV=development and APP_ENV=development)",
    );
  }
  if (raw.AI_SERVICE_TOKEN && raw.AI_SERVICE_TOKEN.length < 32) {
    issues.push("AI_SERVICE_TOKEN: must be at least 32 characters");
  }
  const cloudinaryParts = [raw.CLOUDINARY_CLOUD_NAME, raw.CLOUDINARY_API_KEY, raw.CLOUDINARY_API_SECRET];
  if (cloudinaryParts.some(Boolean) && !cloudinaryParts.every(Boolean)) {
    issues.push("CLOUDINARY_*: CLOUD_NAME, API_KEY and API_SECRET must be set together");
  }
  if (provider === "anthropic" && !raw.ANTHROPIC_API_KEY)
    issues.push("ANTHROPIC_API_KEY: required when LLM_PROVIDER=anthropic");
  if (provider === "gemini" && !raw.GEMINI_API_KEY) issues.push("GEMINI_API_KEY: required when LLM_PROVIDER=gemini");
  if (provider === "openai_compatible" && !(raw.OPENAI_API_KEY && raw.OPENAI_BASE_URL && raw.OPENAI_MODEL)) {
    issues.push("OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL: all required when LLM_PROVIDER=openai_compatible");
  }

  const fallbackProviders: Exclude<LlmProviderName, "none">[] = [];
  for (const name of raw.LLM_FALLBACK_PROVIDERS) {
    if (name !== "anthropic" && name !== "gemini" && name !== "openai_compatible") {
      issues.push(`LLM_FALLBACK_PROVIDERS: unknown provider "${name}"`);
    } else if (name !== provider && !fallbackProviders.includes(name)) {
      fallbackProviders.push(name);
    }
  }
  if (fallbackProviders.includes("anthropic") && !raw.ANTHROPIC_API_KEY)
    issues.push("ANTHROPIC_API_KEY: required when anthropic is a fallback provider");
  if (fallbackProviders.includes("gemini") && !raw.GEMINI_API_KEY)
    issues.push("GEMINI_API_KEY: required when gemini is a fallback provider");
  if (
    fallbackProviders.includes("openai_compatible") &&
    !(raw.OPENAI_API_KEY && raw.OPENAI_BASE_URL && raw.OPENAI_MODEL)
  )
    issues.push("OPENAI_API_KEY, OPENAI_BASE_URL, OPENAI_MODEL: required when openai_compatible is a fallback provider");

  const priceTableSchema = z.record(
    z.string(),
    z.object({ inputPerMTok: z.number().nonnegative(), outputPerMTok: z.number().nonnegative() }).strict(),
  );
  let priceTable: Record<string, { inputPerMTok: number; outputPerMTok: number }> = {};
  if (raw.LLM_PRICE_TABLE) {
    try {
      const parsedTable = priceTableSchema.safeParse(JSON.parse(raw.LLM_PRICE_TABLE));
      if (parsedTable.success) priceTable = parsedTable.data;
      else issues.push('LLM_PRICE_TABLE: must be {"<model>":{"inputPerMTok":n,"outputPerMTok":n}}');
    } catch {
      issues.push("LLM_PRICE_TABLE: must be valid JSON");
    }
  }

  let fieldEncryptionKey: Buffer | undefined;
  if (raw.FIELD_ENCRYPTION_KEY) {
    const key = Buffer.from(raw.FIELD_ENCRYPTION_KEY, "base64");
    if (key.length !== 32) issues.push("FIELD_ENCRYPTION_KEY: must be base64 of exactly 32 bytes");
    else fieldEncryptionKey = key;
  }

  // ── Staging / production rules ──
  if (strict) {
    const required: Array<[string, unknown]> = [
      ["DATABASE_URL", raw.DATABASE_URL],
      ["CLERK_SECRET_KEY", raw.CLERK_SECRET_KEY],
      ["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY", raw.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY],
      ["APP_URL", raw.APP_URL],
      ["CLOUDINARY_CLOUD_NAME", raw.CLOUDINARY_CLOUD_NAME],
      ["AI_SERVICE_URL", raw.AI_SERVICE_URL],
      ["AI_SERVICE_TOKEN", raw.AI_SERVICE_TOKEN],
      ["FIELD_ENCRYPTION_KEY", raw.FIELD_ENCRYPTION_KEY],
    ];
    for (const [name, value] of required) {
      if (!value) issues.push(`${name}: required when APP_ENV=${appEnv}`);
    }
    if (raw.ANALYSIS_EXECUTION_MODE === "inline") {
      // Expensive inference must not run inside serverless request handlers in deployed environments.
      issues.push(
        `ANALYSIS_EXECUTION_MODE: "inline" is not allowed when APP_ENV=${appEnv}; deploy the worker and use "queue"`,
      );
    }
    if (raw.ANALYSIS_EXECUTION_MODE === "queue" && !redisUrl) {
      issues.push(`REDIS_URL: required when APP_ENV=${appEnv} and ANALYSIS_EXECUTION_MODE=queue`);
    }
    if (raw.AI_SERVICE_URL && !raw.AI_SERVICE_URL.startsWith("https://")) {
      issues.push("AI_SERVICE_URL: must use https in staging/production");
    }
  }

  if (issues.length) throw new ConfigError(issues);

  const devAuthBypass = raw.DEV_ALLOW_ANON === true && raw.NODE_ENV === "development" && appEnv === "development";

  return {
    nodeEnv: raw.NODE_ENV,
    appEnv,
    appUrl: raw.APP_URL,
    allowedOrigins: raw.ALLOWED_ORIGINS,
    logLevel: raw.LOG_LEVEL,
    databaseUrl: raw.DATABASE_URL,
    clerk: { secretKey: raw.CLERK_SECRET_KEY, publishableKey: raw.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY },
    devAuthBypass,
    redisUrl,
    analysisExecutionMode: raw.ANALYSIS_EXECUTION_MODE,
    workerConcurrency: raw.WORKER_CONCURRENCY,
    rateLimitEnabled: raw.RATE_LIMIT_ENABLED,
    cloudinary:
      raw.CLOUDINARY_CLOUD_NAME && raw.CLOUDINARY_API_KEY && raw.CLOUDINARY_API_SECRET
        ? { cloudName: raw.CLOUDINARY_CLOUD_NAME, apiKey: raw.CLOUDINARY_API_KEY, apiSecret: raw.CLOUDINARY_API_SECRET }
        : undefined,
    storageAllowedHosts: raw.STORAGE_ALLOWED_HOSTS.length
      ? raw.STORAGE_ALLOWED_HOSTS.map((h) => h.toLowerCase())
      : ["res.cloudinary.com", "api.cloudinary.com"],
    aiService: raw.AI_SERVICE_URL
      ? {
          url: raw.AI_SERVICE_URL.replace(/\/+$/, ""),
          token: raw.AI_SERVICE_TOKEN,
          timeoutMs: raw.AI_SERVICE_TIMEOUT_MS,
        }
      : undefined,
    llm: {
      provider,
      timeoutMs: raw.LLM_TIMEOUT_MS,
      anthropic: raw.ANTHROPIC_API_KEY ? { apiKey: raw.ANTHROPIC_API_KEY, model: raw.ANTHROPIC_MODEL } : undefined,
      gemini: raw.GEMINI_API_KEY ? { apiKey: raw.GEMINI_API_KEY, model: raw.GEMINI_MODEL } : undefined,
      openaiCompatible:
        raw.OPENAI_API_KEY && raw.OPENAI_BASE_URL && raw.OPENAI_MODEL
          ? { apiKey: raw.OPENAI_API_KEY, baseUrl: raw.OPENAI_BASE_URL.replace(/\/+$/, ""), model: raw.OPENAI_MODEL }
          : undefined,
      fallbackProviders,
      priceTable,
    },
    fieldEncryptionKey,
    workerHealthPort: raw.WORKER_HEALTH_PORT,
  };
}

let cached: ServerEnv | undefined;

export function getEnv(): ServerEnv {
  if (!cached) cached = parseEnv(process.env);
  return cached;
}

/** Test helper. */
export function resetEnvForTesting(): void {
  cached = undefined;
}

/** Fail fast with a readable message. Used by instrumentation.ts and the worker entrypoint. */
export function assertEnvAtStartup(context: string): ServerEnv {
  try {
    return getEnv();
  } catch (error) {
    if (error instanceof ConfigError) {
      // Only variable names are printed, never values.
      console.error(`[config] ${context}: ${error.message}`);
    }
    throw error;
  }
}
