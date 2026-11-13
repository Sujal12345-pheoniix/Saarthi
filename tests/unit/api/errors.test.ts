import { describe, expect, it } from "vitest";
import { AppError, Errors } from "@/lib/api/errors";
import { jsonError } from "@/lib/api/handler";

describe("error responses", () => {
  it("hides the message of non-exposed (5xx) errors", async () => {
    const err = new AppError("INTERNAL_ERROR", "connect ECONNREFUSED 10.0.0.12:5432 password=hunter2", 500, {
      expose: false,
    });
    const res = jsonError(err, "req-12345678");
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body).toEqual({
      success: false,
      error: { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." },
      requestId: "req-12345678",
    });
    expect(JSON.stringify(body)).not.toMatch(/hunter2|10\.0\.0\.12/);
    expect(res.headers.get("x-request-id")).toBe("req-12345678");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("returns exposed client errors with their code and details", async () => {
    const res = jsonError(Errors.validation([{ path: "mood", message: "Too big" }]), "req-abcdefgh");
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      error: { code: "VALIDATION_ERROR", details: { issues: [{ path: "mood", message: "Too big" }] } },
    });
  });

  it("adds Retry-After to rate-limit errors", () => {
    expect(jsonError(Errors.rateLimited(42), "req-abcdefgh").headers.get("retry-after")).toBe("42");
  });

  it("uses 404 (not 403) for missing or foreign resources", () => {
    expect(Errors.notFound("Analysis").status).toBe(404);
  });
});
