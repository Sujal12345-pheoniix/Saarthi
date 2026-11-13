import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AppError } from "@/lib/api/errors";
import { readJson } from "@/lib/api/body";
import { assertSameOrigin } from "@/lib/security/origin";

const schema = z.object({ name: z.string().min(1), age: z.number().int().min(0) }).strict();

const req = (body: string, headers: Record<string, string> = { "content-type": "application/json" }) =>
  new Request("http://localhost:3000/api/x", { method: "POST", body, headers });

async function errorOf(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    if (e instanceof AppError) return { status: e.status, code: e.code, details: e.details };
    throw e;
  }
  return null;
}

describe("readJson", () => {
  it("parses a valid body", async () => {
    await expect(readJson(req('{"name":"a","age":3}'), schema)).resolves.toEqual({ name: "a", age: 3 });
  });

  it("returns field-level issues without echoing values", async () => {
    const err = await errorOf(readJson(req('{"name":"","age":-1,"extra":"SECRET"}'), schema));
    expect(err?.status).toBe(400);
    const serialized = JSON.stringify(err?.details);
    expect(serialized).toContain("name");
    expect(serialized).not.toContain("SECRET");
  });

  it("rejects malformed JSON with 400", async () => {
    expect((await errorOf(readJson(req("{not json"), schema)))?.status).toBe(400);
  });

  it("rejects non-JSON content types with 415", async () => {
    expect(
      (await errorOf(readJson(req('{"name":"a","age":1}', { "content-type": "text/plain" }), schema)))?.status,
    ).toBe(415);
  });

  it("rejects bodies over the limit with 413 (declared and streamed)", async () => {
    const big = JSON.stringify({ name: "x".repeat(5000), age: 1 });
    expect((await errorOf(readJson(req(big), schema, 1024)))?.status).toBe(413);
    const declared = req("{}", { "content-type": "application/json", "content-length": "999999" });
    expect((await errorOf(readJson(declared, schema, 1024)))?.status).toBe(413);
  });
});

describe("assertSameOrigin (CSRF defence)", () => {
  const cfg = { appUrl: "https://saarthi.example", allowedOrigins: ["https://admin.saarthi.example"] };
  const post = (origin?: string) =>
    new Request("https://saarthi.example/api/x", { method: "POST", headers: origin ? { origin } : {} });

  it("allows same-origin, configured origins and requests without Origin", () => {
    expect(() => assertSameOrigin(post("https://saarthi.example"), cfg)).not.toThrow();
    expect(() => assertSameOrigin(post("https://admin.saarthi.example"), cfg)).not.toThrow();
    expect(() => assertSameOrigin(post(), cfg)).not.toThrow();
  });

  it("rejects cross-origin and opaque origins on state-changing requests", () => {
    expect(() => assertSameOrigin(post("https://evil.example"), cfg)).toThrow(AppError);
    expect(() => assertSameOrigin(post("null"), cfg)).toThrow(AppError);
  });

  it("does not block safe methods", () => {
    const get = new Request("https://saarthi.example/api/x", { headers: { origin: "https://evil.example" } });
    expect(() => assertSameOrigin(get, cfg)).not.toThrow();
  });
});
