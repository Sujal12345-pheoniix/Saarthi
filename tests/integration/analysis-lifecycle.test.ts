import { beforeAll, describe, expect, it } from "vitest";
import type { AssetPurpose } from "@prisma/client";
import { getPrisma } from "@/lib/database/prisma";
import { verifyImage } from "@/lib/security/image-validation";
import { processAnalysis, type ProcessorDeps } from "@/server/services/analysis-processor";
import { AnalysisFailure } from "@/server/services/analysis-errors";
import {
  createCombinedAnalysis,
  createImageAnalysis,
  getAnalysisStatus,
  type Dispatcher,
} from "@/server/services/analysis-service";
import {
  createMentalQuestionnaireReport,
  createSkinQuestionnaireReport,
} from "@/server/services/questionnaire-reports";
import { fakeCv, fakeLlm, MemoryStorage, quietLog } from "../helpers/fakes";
import { makePng } from "../helpers/images";

const db = () => getPrisma();
const storage = new MemoryStorage();
const noDispatch: Dispatcher = {
  mode: () => "queue",
  enqueue: async () => undefined,
  processInline: async () => undefined,
};

let seq = 0;
async function newUser() {
  seq += 1;
  return db().user.create({ data: { clerkId: `clerk_life_${seq}_${Date.now()}` } });
}

async function newAsset(userId: string, purpose: AssetPurpose = "SKIN_SCAN") {
  const bytes = makePng(480, 480, ++seq);
  const v = verifyImage(bytes);
  const stored = await storage.upload({ bytes, userId, purpose, format: v.format });
  return db().uploadedAsset.create({
    data: {
      userId,
      purpose,
      storageKey: stored.storageKey,
      deliveryType: "authenticated",
      mimeType: v.mimeType,
      format: v.format,
      sizeBytes: v.sizeBytes,
      width: v.width,
      height: v.height,
      sha256: v.sha256,
    },
  });
}

function deps(over: Partial<ProcessorDeps> = {}): ProcessorDeps {
  return { db: db(), storage, cv: fakeCv().client, llm: () => null, log: quietLog, now: () => new Date(), ...over };
}

async function queuedSkinAnalysis(userId: string) {
  const asset = await newAsset(userId);
  const s = await createImageAnalysis(
    db(),
    { userId, domain: "SKIN", assetId: asset.id, requestId: "t", log: quietLog },
    noDispatch,
  );
  return { analysisId: s.analysisId, asset };
}

beforeAll(() => undefined);

describe("analysis lifecycle", () => {
  it("QUEUED → PROCESSING → COMPLETED writes report, raw output, progress and achievement atomically", async () => {
    const user = await newUser();
    const { analysisId, asset } = await queuedSkinAnalysis(user.id);
    expect((await db().analysis.findUniqueOrThrow({ where: { id: analysisId } })).status).toBe("QUEUED");

    const cv = fakeCv();
    const outcome = await processAnalysis(analysisId, deps({ cv: cv.client }));
    expect(outcome.status).toBe("completed");
    expect(cv.calls).toEqual([{ kind: "skin", bytes: (await storage.download(asset)).byteLength }]);

    const a = await db().analysis.findUniqueOrThrow({
      where: { id: analysisId },
      include: { skinReport: true, result: true },
    });
    expect(a).toMatchObject({ status: "COMPLETED", attempts: 1, errorCode: null });
    expect(a.completedAt).not.toBeNull();
    expect(a.skinReport).toMatchObject({
      method: "COMPUTER_VISION",
      skinScore: 82,
      confidence: null,
      assetId: asset.id,
      engineVersion: "skin-cv@3",
    });
    expect(a.result).toMatchObject({ engine: "saarthi-cv", engineVersion: "skin-cv@3" });
    // Contract v3: structured, sourced measurements are kept with the report; unmeasurable values stay null.
    expect(a.skinReport).toMatchObject({ hydrationScore: null, acneSeverity: null });
    expect(a.skinReport!.metrics).toMatchObject({
      contractVersion: "3",
      measurements: [expect.objectContaining({ key: "reddishSpotCount", confidence: null })],
      limitations: [expect.stringContaining("not a medical assessment")],
    });
    expect(await db().progressHistory.count({ where: { userId: user.id, sourceReportId: a.skinReport!.id } })).toBe(1);
    expect(await db().achievement.count({ where: { userId: user.id, code: "FIRST_SKIN_SCAN" } })).toBe(1);

    const view = await getAnalysisStatus(db(), user.id, analysisId);
    expect(view).toMatchObject({
      status: "COMPLETED",
      report: { score: 82, confidenceLabel: "Confidence not measured" },
    });
  });

  it("is idempotent: re-processing a completed analysis is a no-op", async () => {
    const user = await newUser();
    const { analysisId } = await queuedSkinAnalysis(user.id);
    await processAnalysis(analysisId, deps());
    const again = await processAnalysis(analysisId, deps());
    expect(again).toEqual({ status: "skipped", reason: "COMPLETED" });
    expect(await db().skinReport.count({ where: { analysisId } })).toBe(1);
  });

  it("concurrent processors cannot both claim the same analysis", async () => {
    const user = await newUser();
    const { analysisId } = await queuedSkinAnalysis(user.id);
    const [a, b] = await Promise.all([processAnalysis(analysisId, deps()), processAnalysis(analysisId, deps())]);
    expect([a.status, b.status].sort()).toEqual(["completed", "skipped"]);
    expect(await db().skinReport.count({ where: { analysisId } })).toBe(1);
  });

  it("an image-quality rejection fails permanently with a user-safe message and no report", async () => {
    const user = await newUser();
    const { analysisId } = await queuedSkinAnalysis(user.id);
    const cv = fakeCv({
      skin: new AnalysisFailure("IMAGE_REJECTED", "Face not visible. Please position your face clearly.", false),
    });
    const outcome = await processAnalysis(analysisId, deps({ cv: cv.client }), { attempt: 1, maxAttempts: 3 });
    expect(outcome).toEqual({ status: "failed", code: "IMAGE_REJECTED" });
    const a = await db().analysis.findUniqueOrThrow({ where: { id: analysisId }, include: { skinReport: true } });
    expect(a).toMatchObject({
      status: "FAILED",
      errorCode: "IMAGE_REJECTED",
      errorMessage: "Face not visible. Please position your face clearly.",
    });
    expect(a.skinReport).toBeNull();
    expect(await getAnalysisStatus(db(), user.id, analysisId)).toMatchObject({
      status: "FAILED",
      error: expect.stringContaining("Face not visible"),
    });
  });

  it("a transient failure returns to QUEUED for retry, then completes on the next attempt", async () => {
    const user = await newUser();
    const { analysisId } = await queuedSkinAnalysis(user.id);
    const flaky = fakeCv({
      skin: new AnalysisFailure("CV_UNREACHABLE", "The analysis service did not respond.", true),
    });
    expect(await processAnalysis(analysisId, deps({ cv: flaky.client }), { attempt: 1, maxAttempts: 3 })).toEqual({
      status: "retry",
      code: "CV_UNREACHABLE",
    });
    expect((await db().analysis.findUniqueOrThrow({ where: { id: analysisId } })).status).toBe("QUEUED");
    expect((await processAnalysis(analysisId, deps(), { attempt: 2, maxAttempts: 3 })).status).toBe("completed");
    expect((await db().analysis.findUniqueOrThrow({ where: { id: analysisId } })).attempts).toBe(2);
  });

  it("a transient failure on the last attempt fails permanently", async () => {
    const user = await newUser();
    const { analysisId } = await queuedSkinAnalysis(user.id);
    const flaky = fakeCv({ skin: new AnalysisFailure("CV_TIMEOUT", "Timed out.", true) });
    expect((await processAnalysis(analysisId, deps({ cv: flaky.client }), { attempt: 3, maxAttempts: 3 })).status).toBe(
      "failed",
    );
    expect((await db().analysis.findUniqueOrThrow({ where: { id: analysisId } })).status).toBe("FAILED");
  });

  it("unexpected errors are stored as a generic message (no internals leak)", async () => {
    const user = await newUser();
    const { analysisId } = await queuedSkinAnalysis(user.id);
    const boom = fakeCv({ skin: new Error("ECONNRESET 10.0.0.12:5432 password=hunter2") });
    await processAnalysis(analysisId, deps({ cv: boom.client }));
    const a = await db().analysis.findUniqueOrThrow({ where: { id: analysisId } });
    expect(a.errorMessage).not.toMatch(/hunter2|10\.0\.0\.12/);
  });

  it("refuses to analyse a stored file whose bytes no longer match the recorded hash", async () => {
    const user = await newUser();
    const { analysisId, asset } = await queuedSkinAnalysis(user.id);
    storage.objects.set(asset.storageKey, makePng(480, 480, 999)); // tampered object
    const cv = fakeCv();
    expect(await processAnalysis(analysisId, deps({ cv: cv.client }))).toEqual({
      status: "failed",
      code: "ASSET_INTEGRITY",
    });
    expect(cv.calls).toHaveLength(0);
  });

  it("fails honestly when the image was deleted before processing", async () => {
    const user = await newUser();
    const { analysisId, asset } = await queuedSkinAnalysis(user.id);
    await db().uploadedAsset.update({ where: { id: asset.id }, data: { status: "DELETED" } });
    expect(await processAnalysis(analysisId, deps())).toEqual({ status: "failed", code: "ASSET_UNAVAILABLE" });
  });

  it("re-claims a PROCESSING analysis only after it is stale (crashed worker)", async () => {
    const user = await newUser();
    const { analysisId } = await queuedSkinAnalysis(user.id);
    await db().analysis.update({ where: { id: analysisId }, data: { status: "PROCESSING" } });
    expect((await processAnalysis(analysisId, deps())).status).toBe("skipped");
    const later = () => new Date(Date.now() + 11 * 60 * 1000);
    expect((await processAnalysis(analysisId, deps({ now: later }))).status).toBe("completed");
  });

  it("an idempotency key returns the original analysis instead of creating a duplicate", async () => {
    const user = await newUser();
    const asset = await newAsset(user.id);
    const args = {
      userId: user.id,
      domain: "SKIN" as const,
      assetId: asset.id,
      idempotencyKey: "same-key-123",
      requestId: "t",
      log: quietLog,
    };
    const [a, b] = await Promise.all([
      createImageAnalysis(db(), args, noDispatch),
      createImageAnalysis(db(), args, noDispatch),
    ]);
    expect(a.analysisId).toBe(b.analysisId);
    expect(await db().analysis.count({ where: { userId: user.id } })).toBe(1);
  });

  it("rejects an image uploaded for a different domain", async () => {
    const user = await newUser();
    const asset = await newAsset(user.id, "PHYSICAL_SCAN");
    await expect(
      createImageAnalysis(
        db(),
        { userId: user.id, domain: "SKIN", assetId: asset.id, requestId: "t", log: quietLog },
        noDispatch,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });

  it("inline mode runs the same processor inside the request", async () => {
    const user = await newUser();
    const asset = await newAsset(user.id);
    const inline: Dispatcher = {
      mode: () => "inline",
      enqueue: async () => {
        throw new Error("must not enqueue");
      },
      processInline: async (id) => {
        await processAnalysis(id, deps());
      },
    };
    const s = await createImageAnalysis(
      db(),
      { userId: user.id, domain: "SKIN", assetId: asset.id, requestId: "t", log: quietLog },
      inline,
    );
    expect(s.status).toBe("COMPLETED");
  });
});

describe("combined wellness synthesis", () => {
  it("fails honestly when the user has no verified reports", async () => {
    const user = await newUser();
    const s = await createCombinedAnalysis(db(), { userId: user.id, requestId: "t", log: quietLog }, noDispatch);
    const llm = fakeLlm({ insights: "x", risks: [], actionPlan: ["y"] });
    expect(await processAnalysis(s.analysisId, deps({ llm: () => llm }))).toEqual({
      status: "failed",
      code: "NO_SOURCE_DATA",
    });
    expect(llm.prompts).toHaveLength(0);
  });

  it("fails honestly when no LLM provider is configured", async () => {
    const user = await newUser();
    await createMentalQuestionnaireReport(
      db(),
      { mood: 4, stress: 20, sleepHours: 8, energy: 4, journal: "" },
      { userId: user.id, requestId: "t" },
    );
    const s = await createCombinedAnalysis(db(), { userId: user.id, requestId: "t", log: quietLog }, noDispatch);
    expect(await processAnalysis(s.analysisId, deps({ llm: () => null }))).toEqual({
      status: "failed",
      code: "LLM_NOT_CONFIGURED",
    });
  });

  it("computes the overall score itself (mean of verified scores), excludes legacy data, and stores provenance", async () => {
    const user = await newUser();
    const skin = await createSkinQuestionnaireReport(
      db(),
      { skinType: "Balanced", concerns: [], hydration: 60, sunExposure: 2, sleepHours: 7 },
      { userId: user.id, requestId: "t" },
    );
    const mental = await createMentalQuestionnaireReport(
      db(),
      { mood: 3, stress: 50, sleepHours: 6, energy: 3, journal: "never send this" },
      { userId: user.id, requestId: "t" },
    );
    await db().physicalReport.create({
      data: {
        userId: user.id,
        method: "LEGACY_UNVERIFIED",
        fitnessScore: 5,
        detectedIssues: [],
        recommendations: [],
        summary: "legacy",
      },
    });

    const s = await createCombinedAnalysis(db(), { userId: user.id, requestId: "t", log: quietLog }, noDispatch);
    const llm = fakeLlm({
      insights: "Sleep and stress may relate to energy.",
      risks: ["Short sleep"],
      actionPlan: ["Sleep 7-8 hours"],
    });
    expect((await processAnalysis(s.analysisId, deps({ llm: () => llm }))).status).toBe("completed");

    const report = await db().combinedWellnessReport.findUniqueOrThrow({ where: { analysisId: s.analysisId } });
    expect(report.overallHealthScore).toBe(Math.round((skin.score + mental.score) / 2));
    expect(report).toMatchObject({
      method: "LLM_SYNTHESIS",
      model: "fake:test-model",
      aiInsights: "Sleep and stress may relate to energy.",
    });
    expect(llm.prompts[0]).not.toContain("never send this");
    expect(llm.prompts[0]).not.toContain("legacy");
    expect(llm.prompts[0]).not.toContain(user.id);
  });

  it("an invalid LLM response never becomes a report", async () => {
    const user = await newUser();
    await createMentalQuestionnaireReport(
      db(),
      { mood: 4, stress: 20, sleepHours: 8, energy: 4, journal: "" },
      { userId: user.id, requestId: "t" },
    );
    const s = await createCombinedAnalysis(db(), { userId: user.id, requestId: "t", log: quietLog }, noDispatch);
    const bad = fakeLlm(
      new AnalysisFailure("LLM_INVALID_OUTPUT", "The AI response did not match the expected format.", true),
    );
    expect((await processAnalysis(s.analysisId, deps({ llm: () => bad }), { attempt: 3, maxAttempts: 3 })).status).toBe(
      "failed",
    );
    expect(await db().combinedWellnessReport.count({ where: { analysisId: s.analysisId } })).toBe(0);
  });
});
