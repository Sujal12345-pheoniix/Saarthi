import type { AssetPurpose } from "@prisma/client";
import { buildStorageKey, type StorageProvider } from "@/lib/storage/storage";
import type { CvClient } from "@/server/integrations/ai-service";
import type { LlmClient, SynthesisOutput } from "@/server/integrations/llm";
import type { FitnessCvResult, SkinCvResult } from "@/features/analysis/cv-contract";
import { logger } from "@/lib/logging/logger";

/** In-memory object storage with the same contract as the Cloudinary implementation. */
export class MemoryStorage implements StorageProvider {
  readonly objects = new Map<string, Uint8Array>();
  readonly removed: string[] = [];

  async upload({
    bytes,
    userId,
    purpose,
  }: {
    bytes: Uint8Array;
    userId: string;
    purpose: AssetPurpose;
    format: string;
  }) {
    const storageKey = buildStorageKey("test", userId, purpose);
    this.objects.set(storageKey, bytes);
    return { storageKey, deliveryType: "authenticated" };
  }
  signedUrl(o: { storageKey: string }) {
    return `https://storage.test/${encodeURIComponent(o.storageKey)}?sig=test&exp=300`;
  }
  async download(o: { storageKey: string }) {
    const bytes = this.objects.get(o.storageKey);
    if (!bytes) throw new Error("not found");
    return bytes;
  }
  async remove(o: { storageKey: string }) {
    this.objects.delete(o.storageKey);
    this.removed.push(o.storageKey);
  }
}

export const SKIN_RESULT: SkinCvResult = {
  engine: "saarthi-cv",
  engineVersion: "skin-cv@2",
  skinScore: 82,
  hydrationScore: 71,
  acneSeverity: 16,
  confidence: null,
  metrics: {
    acneCount: 2,
    rednessScore: 12,
    pigmentationScore: 9,
    wrinkleScore: 5,
    drynessScore: 29,
    oilinessScore: 4,
    skinUniformityScore: 88,
  },
  findings: ["2 small acne-like spots detected on the cheeks."],
  recommendations: ["Keep a gentle cleanser and daily SPF."],
  summary: "Computer-vision skin score 82/100 based on spot, redness, pigment and line measurements.",
  quality: { width: 1024, height: 1024, blurScore: 210.5, brightness: 132.1 },
};

export const FITNESS_RESULT: FitnessCvResult = {
  engine: "saarthi-cv",
  engineVersion: "posture-cv@2",
  fitnessScore: 78,
  postureScore: 80,
  balanceScore: 76,
  symmetryScore: 79,
  mobilityScore: null,
  confidence: 91.5,
  metrics: { shoulderTiltDeg: 1.8, hipTiltDeg: 1.1, headTiltDeg: 2.0, neckAngleDeg: 6.2, spineAngleDeg: 1.4 },
  findings: ["Good spinal alignment and body symmetry observed."],
  recommendations: ["Maintain posture with regular stretching."],
  summary: "Posture composite 78/100 from measured joint angles.",
  quality: { width: 720, height: 1280 },
};

export type CvBehaviour = "ok" | Error;

export function fakeCv(behaviour: { skin?: CvBehaviour; fitness?: CvBehaviour } = {}) {
  const calls: Array<{ kind: string; bytes: number }> = [];
  const client: CvClient = {
    async analyzeSkin(image) {
      calls.push({ kind: "skin", bytes: image.byteLength });
      if (behaviour.skin instanceof Error) throw behaviour.skin;
      return { result: SKIN_RESULT, raw: SKIN_RESULT, durationMs: 5 };
    },
    async analyzeFitness(image) {
      calls.push({ kind: "fitness", bytes: image.byteLength });
      if (behaviour.fitness instanceof Error) throw behaviour.fitness;
      return { result: FITNESS_RESULT, raw: FITNESS_RESULT, durationMs: 5 };
    },
  };
  return { client, calls };
}

export function fakeLlm(output: SynthesisOutput | Error): LlmClient & { prompts: string[] } {
  const prompts: string[] = [];
  return {
    id: "fake:test-model",
    prompts,
    async synthesize({ user }) {
      prompts.push(user);
      if (output instanceof Error) throw output;
      return output;
    },
  };
}

export const quietLog = logger.child({ test: true });
