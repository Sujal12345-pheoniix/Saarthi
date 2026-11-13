/**
 * Runs once per server instance. Phase 1: validate configuration at startup so a misconfigured deployment
 * fails immediately with a list of missing/invalid variables (names only).
 *
 * The analysis worker is NOT started here any more — it runs as its own process (`npm run worker`).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { assertEnvAtStartup } = await import("./lib/config/env");
  const env = assertEnvAtStartup("web server startup");
  const { logger } = await import("./lib/logging/logger");
  logger.info("server.startup", {
    appEnv: env.appEnv,
    analysisExecutionMode: env.analysisExecutionMode,
    llmProvider: env.llm.provider,
    storageConfigured: Boolean(env.cloudinary),
    aiServiceConfigured: Boolean(env.aiService),
  });
}
