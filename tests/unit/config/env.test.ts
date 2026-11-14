import { describe, expect, it } from "vitest";
import { ConfigError, parseEnv } from "@/lib/config/env";

const PROD_BASE = {
  NODE_ENV: "production",
  APP_ENV: "production",
  APP_URL: "https://saarthi.example",
  DATABASE_URL: "postgresql://u:p@db.example:5432/saarthi",
  CLERK_SECRET_KEY: "sk_live_x",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_x",
  REDIS_URL: "rediss://default:x@redis.example:6379",
  CLOUDINARY_CLOUD_NAME: "c",
  CLOUDINARY_API_KEY: "k",
  CLOUDINARY_API_SECRET: "s",
  AI_SERVICE_URL: "https://ai.example",
  AI_SERVICE_TOKEN: "x".repeat(40),
  FIELD_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
};

function issuesOf(fn: () => unknown): string[] {
  try {
    fn();
  } catch (e) {
    if (e instanceof ConfigError) return e.issues;
    throw e;
  }
  return [];
}

describe("environment validation", () => {
  it("accepts a complete production configuration", () => {
    const env = parseEnv(PROD_BASE);
    expect(env.appEnv).toBe("production");
    expect(env.devAuthBypass).toBe(false);
    expect(env.aiService?.url).toBe("https://ai.example");
    expect(env.fieldEncryptionKey?.length).toBe(32);
  });

  it("requires a field encryption key in production", () => {
    const { FIELD_ENCRYPTION_KEY: _omit, ...rest } = PROD_BASE;
    void _omit;
    expect(issuesOf(() => parseEnv(rest)).join("\n")).toMatch(/FIELD_ENCRYPTION_KEY/);
  });

  it("rejects a field encryption key that is not 32 bytes", () => {
    expect(issuesOf(() => parseEnv({ ...PROD_BASE, FIELD_ENCRYPTION_KEY: "c2hvcnQ=" })).join("\n")).toMatch(
      /exactly 32 bytes/,
    );
  });

  it("refuses inline analysis execution in production", () => {
    expect(issuesOf(() => parseEnv({ ...PROD_BASE, ANALYSIS_EXECUTION_MODE: "inline" })).join("\n")).toMatch(
      /ANALYSIS_EXECUTION_MODE/,
    );
  });

  it("validates fallback providers and the price table", () => {
    const issues = issuesOf(() =>
      parseEnv({ ...PROD_BASE, LLM_FALLBACK_PROVIDERS: "gemini,bogus", LLM_PRICE_TABLE: "{not json" }),
    ).join("\n");
    expect(issues).toMatch(/unknown provider "bogus"/);
    expect(issues).toMatch(/GEMINI_API_KEY: required when gemini is a fallback provider/);
    expect(issues).toMatch(/LLM_PRICE_TABLE: must be valid JSON/);
  });

  it("lists every missing production variable by name", () => {
    const issues = issuesOf(() => parseEnv({ NODE_ENV: "production" }));
    for (const name of [
      "DATABASE_URL",
      "CLERK_SECRET_KEY",
      "APP_URL",
      "CLOUDINARY_CLOUD_NAME",
      "AI_SERVICE_URL",
      "AI_SERVICE_TOKEN",
      "REDIS_URL",
    ]) {
      expect(issues.some((i) => i.startsWith(name))).toBe(true);
    }
  });

  it("never echoes secret values in error messages", () => {
    const issues = issuesOf(() => parseEnv({ ...PROD_BASE, AI_SERVICE_TOKEN: "short-secret-value" }));
    expect(issues.join(" ")).not.toContain("short-secret-value");
    expect(issues.some((i) => i.startsWith("AI_SERVICE_TOKEN"))).toBe(true);
  });

  it.each([
    ["production", "production"],
    ["production", "staging"],
    ["development", "staging"],
    ["test", "test"],
  ])("refuses DEV_ALLOW_ANON with NODE_ENV=%s APP_ENV=%s", (nodeEnv, appEnv) => {
    const issues = issuesOf(() =>
      parseEnv({ ...PROD_BASE, NODE_ENV: nodeEnv, APP_ENV: appEnv, DEV_ALLOW_ANON: "true" }),
    );
    expect(issues.some((i) => i.startsWith("DEV_ALLOW_ANON"))).toBe(true);
  });

  it("enables the bypass only for local development", () => {
    expect(parseEnv({ NODE_ENV: "development", APP_ENV: "development", DEV_ALLOW_ANON: "true" }).devAuthBypass).toBe(
      true,
    );
    expect(parseEnv({ NODE_ENV: "development", APP_ENV: "development" }).devAuthBypass).toBe(false);
  });

  it("requires https for the AI service outside development", () => {
    const issues = issuesOf(() => parseEnv({ ...PROD_BASE, AI_SERVICE_URL: "http://ai.example" }));
    expect(issues.some((i) => i.startsWith("AI_SERVICE_URL"))).toBe(true);
  });

  it("derives a TLS Redis URL from the legacy Upstash variables", () => {
    const env = parseEnv({
      NODE_ENV: "development",
      UPSTASH_REDIS_REST_URL: "https://eu1-x.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "tok",
    });
    expect(env.redisUrl).toBe("rediss://default:tok@eu1-x.upstash.io:6379");
  });

  it("selects the LLM provider explicitly or from the single configured key", () => {
    expect(parseEnv({ NODE_ENV: "development" }).llm.provider).toBe("none");
    expect(parseEnv({ NODE_ENV: "development", ANTHROPIC_API_KEY: "k" }).llm.provider).toBe("anthropic");
    expect(parseEnv({ NODE_ENV: "development", ANTHROPIC_API_KEY: "k" }).llm.anthropic?.model).toBe("claude-opus-5-5");
    expect(parseEnv({ NODE_ENV: "development", GEMINI_API_KEY: "k" }).llm.provider).toBe("gemini");
    const issues = issuesOf(() => parseEnv({ NODE_ENV: "development", LLM_PROVIDER: "anthropic" }));
    expect(issues.some((i) => i.startsWith("ANTHROPIC_API_KEY"))).toBe(true);
  });

  it("requires Cloudinary variables as a complete set", () => {
    const issues = issuesOf(() => parseEnv({ NODE_ENV: "development", CLOUDINARY_CLOUD_NAME: "c" }));
    expect(issues.some((i) => i.startsWith("CLOUDINARY_"))).toBe(true);
  });
});
