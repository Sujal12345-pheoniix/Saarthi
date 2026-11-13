import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getPrisma } from "@/lib/database/prisma";
import { setStorageForTesting } from "@/lib/storage/storage";
import * as upload from "@/app/api/upload/route";
import * as reportsByDomain from "@/app/api/reports/[domain]/route";
import * as analyzeSkin from "@/app/api/analyze-skin/route";
import { MemoryStorage } from "../helpers/fakes";
import { call, multipart, setClerkUser } from "../helpers/http";
import { makeJpegHeader, makePng, SVG_BYTES } from "../helpers/images";

const storage = new MemoryStorage();

beforeAll(() => setStorageForTesting(storage));
beforeEach(() => setClerkUser("clerk_uploader"));

async function send(fields: Parameters<typeof multipart>[0], extraHeaders: Record<string, string> = {}) {
  const m = multipart(fields);
  return call<{ assetId: string; previewUrl: string | null; width: number }>(upload.POST, {
    method: "POST",
    body: m.body,
    headers: { ...m.headers, ...extraHeaders },
  });
}

describe("upload restrictions", () => {
  it("stores a verified image privately under a server-generated, user-scoped key", async () => {
    const res = await send({
      purpose: "skin",
      file: { bytes: makePng(500, 520, 1), type: "image/png", name: "../../etc/passwd.png" },
    });
    expect(res.status).toBe(200);
    if (!res.body.success) throw new Error("upload failed");
    const asset = await getPrisma().uploadedAsset.findUniqueOrThrow({
      where: { id: res.body.data.assetId },
      include: { user: true },
    });
    expect(asset.user.clerkId).toBe("clerk_uploader");
    expect(asset.storageKey).toMatch(new RegExp(`^saarthi/test/users/${asset.userId}/skin/[0-9a-f-]{36}$`));
    expect(asset).toMatchObject({
      mimeType: "image/png",
      width: 500,
      height: 520,
      deliveryType: "authenticated",
      status: "ACTIVE",
    });
    expect(res.body.data.previewUrl).toMatch(/sig=/);
  });

  it("ignores the browser MIME type: SVG labelled image/png is rejected", async () => {
    const res = await send({ purpose: "skin", file: { bytes: SVG_BYTES, type: "image/png", name: "x.png" } });
    expect(res.status).toBe(415);
  });

  it("rejects a client-chosen folder that is not a known purpose", async () => {
    const res = await send({
      folder: "../../other-user",
      file: { bytes: makePng(400, 400, 2), type: "image/png", name: "a.png" },
    });
    expect(res.status).toBe(400);
  });

  it("maps the legacy folder field to a purpose without using it as a path", async () => {
    const res = await send({
      folder: "saarthi/physical",
      file: { bytes: makeJpegHeader(800, 1200), type: "image/jpeg", name: "a.jpg" },
    });
    expect(res.status).toBe(200);
    if (!res.body.success) throw new Error();
    const asset = await getPrisma().uploadedAsset.findUniqueOrThrow({ where: { id: res.body.data.assetId } });
    expect(asset.purpose).toBe("PHYSICAL_SCAN");
    expect(asset.storageKey).not.toContain("saarthi/physical/");
  });

  it("rejects images below the minimum resolution", async () => {
    expect(
      (await send({ purpose: "skin", file: { bytes: makePng(100, 100), type: "image/png", name: "a.png" } })).status,
    ).toBe(400);
  });

  it("rejects requests over the size limit before parsing", async () => {
    const res = await send({ purpose: "skin" }, { "content-length": String(20 * 1024 * 1024) });
    expect(res.status).toBe(413);
  });

  it("requires multipart/form-data", async () => {
    const res = await call(upload.POST, { method: "POST", json: { file: "x" } });
    expect(res.status).toBe(415);
  });

  it("re-uses an identical upload instead of storing a duplicate", async () => {
    const bytes = makePng(600, 600, 42);
    const a = await send({ purpose: "skin", file: { bytes, type: "image/png", name: "a.png" } });
    const before = storage.objects.size;
    const b = await send({ purpose: "skin", file: { bytes, type: "image/png", name: "b.png" } });
    expect(a.body.success && b.body.success && a.body.data.assetId === b.body.data.assetId).toBe(true);
    expect(storage.objects.size).toBe(before);
  });
});

describe("API validation", () => {
  it("rejects out-of-range questionnaire values with field-level issues", async () => {
    const res = await call(reportsByDomain.POST, {
      method: "POST",
      params: { domain: "mental" },
      json: { mood: 11, stress: 500, sleepHours: 7, energy: 3 },
    });
    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain("mood");
  });

  it("rejects malformed asset ids", async () => {
    const res = await call(analyzeSkin.POST, { method: "POST", json: { assetId: "https://169.254.169.254/latest" } });
    expect(res.status).toBe(400);
  });

  it("rejects the pre-Phase-1 imageUrl contract", async () => {
    const res = await call(analyzeSkin.POST, { method: "POST", json: { imageUrl: "https://example.com/face.jpg" } });
    expect(res.status).toBe(400);
  });

  it("rejects cross-origin state-changing requests", async () => {
    const res = await call(reportsByDomain.POST, {
      method: "POST",
      params: { domain: "mental" },
      json: { mood: 3, stress: 10, sleepHours: 7, energy: 3 },
      headers: { origin: "https://evil.example" },
    });
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: { code: "BAD_ORIGIN" } });
  });

  it("returns 404 for an unknown report domain", async () => {
    expect((await call(reportsByDomain.GET, { params: { domain: "dental" } })).status).toBe(404);
  });

  it("creates a questionnaire report with an analysis record, no confidence, and no stored journal text", async () => {
    const res = await call<{ report: { analysisId: string; confidence: number | null; method: string } }>(
      reportsByDomain.POST,
      {
        method: "POST",
        params: { domain: "mental" },
        json: { mood: 4, stress: 30, sleepHours: 7.5, energy: 4, journal: "PRIVATE JOURNAL TEXT" },
      },
    );
    expect(res.status).toBe(200);
    if (!res.body.success) throw new Error();
    expect(res.body.data.report).toMatchObject({ confidence: null, method: "QUESTIONNAIRE_RULES" });
    const analysis = await getPrisma().analysis.findUniqueOrThrow({
      where: { id: res.body.data.report.analysisId },
      include: { input: true, result: true, mentalReport: true },
    });
    expect(analysis.status).toBe("COMPLETED");
    expect(analysis.result?.engine).toBe("saarthi-rules");
    expect(JSON.stringify(analysis)).not.toContain("PRIVATE JOURNAL TEXT");
    expect(analysis.input?.questionnaire).toMatchObject({ journalProvided: true });
  });
});
