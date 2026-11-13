import type { ErrorCode } from "./errors";

/**
 * API response contract (version 1). Shared by server handlers and the browser client.
 *
 * Success: { success: true,  data: T,                                   requestId }
 * Failure: { success: false, error: { code, message, details? },        requestId }
 *
 * Every response carries `x-request-id` and `x-api-version` headers.
 * Versioning strategy: docs/api/API_CONVENTIONS.md.
 */
export const API_VERSION = "1";

export interface ApiSuccess<T> {
  success: true;
  data: T;
  requestId: string;
}

export interface ApiFailure {
  success: false;
  error: { code: ErrorCode; message: string; details?: unknown };
  requestId: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;
