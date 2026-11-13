import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { getPrisma } from "@/lib/database/prisma";
import { setStorageForTesting } from "@/lib/storage/storage";
import { createSkinQuestionnaireReport } from "@/server/services/questionnaire-reports";
import * as analyzeSkin from "@/app/api/analyze-skin/route";
import * as analyzeFitness from "@/app/api/analyze-fitness/route";
import * as upload from "@/app/api/upload/route";
import * as assetById from "@/app/api/assets/[id]/route";
import * as reportById from "@/app/api/report/[id]/route";
import * as reportGenerate from "@/app/api/report/generate/route";
import * as reportLatest from "@/app/api/report/latest/route";
import * as reportsByDomain from "@/app/api/reports/[domain]/route";
import * as history from "@/app/api/history/route";
import * as progress from "@/app/api/progress/route";
import * as dashboard from "@/app/api/dashboard/summary/route";
import * as account from "@/app/api/account/route";
import * as accountExport from "@/app/api/account/export/route";
import * as health from "@/app/api/health/route";
import { MemoryStorage } from "../helpers/fakes";
import { call, multipart, setClerkUser } from "../helpers/http";
import { makePng } from "../helpers/images";

const db = () => getPrisma();

async function userFor(clerkId: string) {
  setClerkUser(clerkId);
  await call(history.GET); // first authenticated request provisions the internal user
  return db().user.findUniqueOrThrow({ where: { clerkId } });
}

describe("authentication", () => {
  const protectedRoutes: Array<[string, () => Promise<{ status: number; body: unknown }>]> = [
    ["POST /api/upload", () => call(upload.POST, { method: "POST", ...multipart({ purpose: "skin" }) })],
    ["POST /api/analyze-skin", () => call(analyzeSkin.POST, { method: "POST", json: { assetId: "c".repeat(25) } })],
    [
      "POST /api/analyze-fitness",
      () => call(analyzeFitness.POST, { method: "POST", json: { assetId: "c".repeat(25) } }),
    ],
    ["DELETE /api/assets/:id", () => call(assetById.DELETE, { method: "DELETE", params: { id: "x" } })],
    ["GET /api/report/:id", () => call(reportById.GET, { params: { id: "x" } })],
    ["POST /api/report/generate", () => call(reportGenerate.POST, { method: "POST", json: {} })],
    ["GET /api/report/latest", () => call(reportLatest.GET)],
    ["GET /api/reports/skin", () => call(reportsByDomain.GET, { params: { domain: "skin" } })],
    [
      "POST /api/reports/mental",
      () =>
        call(reportsByDomain.POST, {
          method: "POST",
          params: { domain: "mental" },
          json: { mood: 3, stress: 10, sleepHours: 7, energy: 3 },
        }),
    ],
    ["GET /api/history", () => call(history.GET)],
    ["GET /api/progress", () => call(progress.GET)],
    ["GET /api/dashboard/summary", () => call(dashboard.GET)],
    ["GET /api/account/export", () => call(accountExport.GET)],
    ["DELETE /api/account", () => call(account.DELETE, { method: "DELETE", json: { confirm: "DELETE MY ACCOUNT" } })],
  ];

  it.each(protectedRoutes)("%s returns 401 without a session", async (_name, invoke) => {
    setClerkUser(null);
    const res = await invoke();
    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({ success: false, error: { code: "UNAUTHENTICATED" } });
  });

  it("health is public and reveals nothing else", async () => {
    const res = await call(health.GET);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, data: { status: "ok" } });
  });

  it("provisions an internal user from the verified Clerk identity", async () => {
    const user = await userFor("clerk_provision");
    expect(user.id).not.toBe("clerk_provision");
    expect(user.role).toBe("USER");
  });

  it("does not honour DEV_ALLOW_ANON outside development", async () => {
    process.env.DEV_ALLOW_ANON = "true";
    try {
      setClerkUser(null);
      const before = await db().user.count({ where: { clerkId: "dev_local_user" } });
      const res = await call(history.GET);
      expect(res.status).not.toBe(200);
      expect(await db().user.count({ where: { clerkId: "dev_local_user" } })).toBe(before);
    } finally {
      delete process.env.DEV_ALLOW_ANON;
    }
  });

  it("every response carries a request id and API version", async () => {
    setClerkUser(null);
    const res = await call(history.GET, { headers: { "x-request-id": "trace-abc-12345" } });
    expect(res.headers.get("x-request-id")).toBe("trace-abc-12345");
    expect(res.headers.get("x-api-version")).toBe("1");
    expect(res.body).toMatchObject({ requestId: "trace-abc-12345" });
  });
});

describe("cross-user isolation (IDOR)", () => {
  const storage = new MemoryStorage();
  let alice: { id: string };
  let bob: { id: string };
  let aliceAnalysisId: string;
  let aliceAssetId: string;

  beforeAll(async () => {
    setStorageForTesting(storage);
    alice = await userFor("clerk_alice");
    bob = await userFor("clerk_bob");
    const report = await createSkinQuestionnaireReport(
      db(),
      { skinType: "Dry", concerns: ["Redness"], hydration: 40, sunExposure: 6, sleepHours: 6 },
      { userId: alice.id, requestId: "seed" },
    );
    aliceAnalysisId = report.analysisId!;

    setClerkUser("clerk_alice");
    const up = multipart({ purpose: "skin", file: { bytes: makePng(480, 480, 7), type: "image/png", name: "a.png" } });
    const res = await call<{ assetId: string }>(upload.POST, { method: "POST", body: up.body, headers: up.headers });
    expect(res.status).toBe(200);
    aliceAssetId = res.body.success ? res.body.data.assetId : "";
  });

  afterEach(() => setClerkUser(null));

  it("Bob cannot read Alice's analysis (404, not 403)", async () => {
    setClerkUser("clerk_bob");
    const res = await call(reportById.GET, { params: { id: aliceAnalysisId } });
    expect(res.status).toBe(404);
    setClerkUser("clerk_alice");
    expect((await call(reportById.GET, { params: { id: aliceAnalysisId } })).status).toBe(200);
  });

  it("Bob's latest-report endpoints never return Alice's data", async () => {
    setClerkUser("clerk_bob");
    const res = await call<{ report: unknown }>(reportsByDomain.GET, { params: { domain: "skin" } });
    expect(res.body).toMatchObject({ success: true, data: { report: null } });
    const dash = await call<{ skin: unknown }>(dashboard.GET);
    expect(dash.body).toMatchObject({ success: true, data: { skin: null } });
  });

  it("Bob cannot analyse Alice's uploaded image", async () => {
    setClerkUser("clerk_bob");
    const res = await call(analyzeSkin.POST, { method: "POST", json: { assetId: aliceAssetId } });
    expect(res.status).toBe(404);
    expect(await db().analysis.count({ where: { userId: bob.id, inputAssetId: aliceAssetId } })).toBe(0);
  });

  it("Bob cannot delete Alice's image", async () => {
    setClerkUser("clerk_bob");
    expect((await call(assetById.DELETE, { method: "DELETE", params: { id: aliceAssetId } })).status).toBe(404);
    const asset = await db().uploadedAsset.findUniqueOrThrow({ where: { id: aliceAssetId } });
    expect(asset.status).toBe("ACTIVE");
  });

  it("a client-supplied userId is rejected, not used", async () => {
    setClerkUser("clerk_bob");
    const res = await call(reportsByDomain.POST, {
      method: "POST",
      params: { domain: "mental" },
      json: { mood: 3, stress: 10, sleepHours: 7, energy: 3, userId: alice.id },
    });
    expect(res.status).toBe(400);
    expect(await db().mentalWellnessReport.count({ where: { userId: alice.id } })).toBe(0);
  });

  it("history lists only the caller's analyses", async () => {
    setClerkUser("clerk_bob");
    const res = await call<{ history: Array<{ id: string }> }>(history.GET);
    expect(res.body.success && res.body.data.history.some((h) => h.id === aliceAnalysisId)).toBe(false);
  });

  it("export contains only the caller's data", async () => {
    setClerkUser("clerk_bob");
    const res = await call<{ user: { id: string; skinReports: unknown[]; assets: unknown[] } }>(accountExport.GET);
    expect(res.status).toBe(200);
    if (!res.body.success) throw new Error("export failed");
    expect(res.body.data.user.id).toBe(bob.id);
    expect(res.body.data.user.skinReports).toHaveLength(0);
    expect(res.body.data.user.assets).toHaveLength(0);
  });
});
