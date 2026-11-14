/**
 * Runs once per server instance: validates configuration and reports problems (variable names only).
 *
 * This hook must never throw. In Next.js a throwing `register()` fails EVERY request — including the public
 * landing and sign-in pages — with a bare "Internal Server Error". Instead:
 *  - unconfigured services are logged as warnings and the affected features answer 503 NOT_CONFIGURED;
 *  - unsafe misconfiguration (ConfigError) is logged here and makes every API route fail closed with 503
 *    (lib/api/handler.ts), so nothing runs in an unsafe state while public pages stay up.
 *
 * The analysis worker is NOT started here — it runs as its own process (`npm run worker`), and its own
 * startup check does exit on invalid configuration.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  try {
    const { getEnv } = await import("./lib/config/env");
    const { logger } = await import("./lib/logging/logger");
    const env = getEnv();
    for (const warning of env.warnings) logger.warn("config.not_configured", { detail: warning });
    logger.info("server.startup", {
      appEnv: env.appEnv,
      analysisExecutionMode: env.analysisExecutionMode,
      llmProvider: env.llm.provider,
      storageConfigured: Boolean(env.cloudinary),
      aiServiceConfigured: Boolean(env.aiService),
      unconfiguredServices: env.warnings.length,
    });
  } catch (error) {
    // ConfigError messages list variable names only, never values.
    console.error(
      `[config] web server startup: ${error instanceof Error ? error.message : String(error)}\n` +
        "API routes will answer 503 until this is fixed; public pages remain available.",
    );
  }
}
