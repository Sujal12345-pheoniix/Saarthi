/**
 * Shared error types. Only AppError instances with `expose: true` have their message shown to clients;
 * everything else becomes INTERNAL_ERROR (see lib/api/handler.ts).
 */

export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "PAYLOAD_TOO_LARGE"
  | "LENGTH_REQUIRED"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "BAD_ORIGIN"
  | "RATE_LIMITED"
  | "CONFLICT"
  | "QUEUE_UNAVAILABLE"
  | "SERVICE_UNAVAILABLE"
  | "NOT_CONFIGURED"
  | "INTERNAL_ERROR";

export interface ValidationIssue {
  path: string;
  message: string;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly expose: boolean;
  readonly details?: unknown;
  readonly headers?: Record<string, string>;

  constructor(
    code: ErrorCode,
    message: string,
    status: number,
    options: { expose?: boolean; details?: unknown; cause?: unknown; headers?: Record<string, string> } = {},
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.expose = options.expose ?? status < 500;
    this.details = options.details;
    this.headers = options.headers;
  }
}

export const Errors = {
  unauthenticated: () => new AppError("UNAUTHENTICATED", "Sign in to continue.", 401),
  forbidden: (message = "You do not have access to this resource.") => new AppError("FORBIDDEN", message, 403),
  /** Used for missing *and* not-owned resources so existence is never revealed across users. */
  notFound: (resource = "Resource") => new AppError("NOT_FOUND", `${resource} not found.`, 404),
  validation: (issues: ValidationIssue[], message = "The request is invalid.") =>
    new AppError("VALIDATION_ERROR", message, 400, { details: { issues } }),
  badRequest: (message: string) => new AppError("VALIDATION_ERROR", message, 400),
  payloadTooLarge: (maxBytes: number) =>
    new AppError("PAYLOAD_TOO_LARGE", `Request body exceeds ${Math.floor(maxBytes / 1024)} KB.`, 413),
  lengthRequired: () => new AppError("LENGTH_REQUIRED", "Content-Length header is required.", 411),
  unsupportedMediaType: (message = "Unsupported content type.") => new AppError("UNSUPPORTED_MEDIA_TYPE", message, 415),
  badOrigin: () => new AppError("BAD_ORIGIN", "Cross-origin request rejected.", 403),
  rateLimited: (retryAfterSeconds: number) =>
    new AppError("RATE_LIMITED", "Too many requests. Please slow down.", 429, {
      headers: { "Retry-After": String(retryAfterSeconds) },
    }),
  conflict: (message: string) => new AppError("CONFLICT", message, 409),
  queueUnavailable: () =>
    new AppError("QUEUE_UNAVAILABLE", "Analysis service is temporarily unavailable. Please try again shortly.", 503, {
      expose: true,
    }),
  serviceUnavailable: (message: string) => new AppError("SERVICE_UNAVAILABLE", message, 503, { expose: true }),
  notConfigured: (feature: string) =>
    new AppError("NOT_CONFIGURED", `${feature} is not configured on this deployment.`, 503, { expose: true }),
};

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
