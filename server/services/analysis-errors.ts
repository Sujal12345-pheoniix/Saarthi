/**
 * A classified analysis failure.
 * - `code` is stored on Analysis.errorCode.
 * - `userMessage` is stored on Analysis.errorMessage and shown to the user — it must never contain
 *   provider responses, stack traces or internal hostnames.
 * - `retryable` decides whether the queue retries (with backoff) or fails permanently.
 */
export class AnalysisFailure extends Error {
  constructor(
    public readonly code: string,
    public readonly userMessage: string,
    public readonly retryable: boolean,
    cause?: unknown,
  ) {
    super(`${code}: ${userMessage}`, cause !== undefined ? { cause } : undefined);
    this.name = "AnalysisFailure";
  }
}

export function classifyUnknown(error: unknown): AnalysisFailure {
  if (error instanceof AnalysisFailure) return error;
  return new AnalysisFailure("INTERNAL_ERROR", "Something went wrong while processing your analysis.", true, error);
}
