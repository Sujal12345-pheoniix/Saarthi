/**
 * Structured JSON logger.
 *
 * Conventions (docs/ARCHITECTURE.md § Logging):
 * - One JSON object per line: { level, time, msg, ...context }.
 * - Always include `requestId` (web) or `jobId`/`analysisId` (worker) via child loggers.
 * - Never log request bodies, questionnaire answers, journal text, image bytes or URLs with signatures.
 * - Keys that look like secrets or personal data are redacted automatically.
 */

type Level = "debug" | "info" | "warn" | "error";
const LEVELS: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const REDACT_KEY =
  /(authorization|cookie|token|secret|password|passwd|api[-_]?key|apikey|signature|email|journal|questionnaire|content|database_url|redis_url)/i;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return "[depth]";
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      ...(value.stack ? { stack: value.stack.split("\n").slice(0, 6).join("\n") } : {}),
    };
  }
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => redact(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = REDACT_KEY.test(k) ? "[redacted]" : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

export interface Logger {
  debug(msg: string, ctx?: Record<string, unknown>): void;
  info(msg: string, ctx?: Record<string, unknown>): void;
  warn(msg: string, ctx?: Record<string, unknown>): void;
  error(msg: string, ctx?: Record<string, unknown>): void;
  child(bindings: Record<string, unknown>): Logger;
}

function minLevel(): number {
  const configured =
    (process.env.LOG_LEVEL as Level | undefined) ?? (process.env.NODE_ENV === "test" ? "warn" : "info");
  return LEVELS[configured] ?? LEVELS.info;
}

function createLogger(bindings: Record<string, unknown>): Logger {
  const write = (level: Level, msg: string, ctx?: Record<string, unknown>) => {
    if (LEVELS[level] < minLevel()) return;
    const line = JSON.stringify({
      level,
      time: new Date().toISOString(),
      msg,
      ...(redact(bindings) as Record<string, unknown>),
      ...(ctx ? (redact(ctx) as Record<string, unknown>) : {}),
    });
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  };
  return {
    debug: (m, c) => write("debug", m, c),
    info: (m, c) => write("info", m, c),
    warn: (m, c) => write("warn", m, c),
    error: (m, c) => write("error", m, c),
    child: (b) => createLogger({ ...bindings, ...b }),
  };
}

export const logger: Logger = createLogger({ service: process.env.SAARTHI_SERVICE_NAME ?? "saarthi-web" });
