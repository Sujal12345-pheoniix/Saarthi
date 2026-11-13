import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { v2 as cloudinary } from "cloudinary";
import type { AssetPurpose } from "@prisma/client";
import { getEnv } from "@/lib/config/env";
import { safeFetchBytes } from "@/lib/security/safe-fetch";

/**
 * Object storage abstraction. Cloudinary is the implementation; tests inject an in-memory store.
 *
 * Security properties (docs/SECURITY_ARCHITECTURE.md § Storage):
 * - Object keys are generated on the server: saarthi/<appEnv>/users/<internalUserId>/<purpose>/<uuid>.
 *   No part of the key comes from the client.
 * - Uploads use Cloudinary delivery type "authenticated": the file is not reachable by its public URL.
 * - Access is via short-lived signed download URLs (default 5 minutes).
 * - The worker downloads through safeFetchBytes (host allow-list, no redirects, size/time limits).
 */

export interface StoredObject {
  storageKey: string;
  deliveryType: string;
}

export interface StorageProvider {
  upload(input: { bytes: Uint8Array; userId: string; purpose: AssetPurpose; format: string }): Promise<StoredObject>;
  signedUrl(object: { storageKey: string; deliveryType: string; format: string }, ttlSeconds?: number): string;
  download(object: { storageKey: string; deliveryType: string; format: string; mimeType: string }): Promise<Uint8Array>;
  remove(object: { storageKey: string; deliveryType: string }): Promise<void>;
}

export const SIGNED_URL_TTL_SECONDS = 300;
export const MAX_DOWNLOAD_BYTES = 10 * 1024 * 1024;

const PURPOSE_SLUG: Record<AssetPurpose, string> = { SKIN_SCAN: "skin", PHYSICAL_SCAN: "physical" };

export function buildStorageKey(appEnv: string, userId: string, purpose: AssetPurpose, id = randomUUID()): string {
  if (!/^[a-z0-9]+$/i.test(userId)) throw new Error("Invalid user id for storage key");
  return `saarthi/${appEnv}/users/${userId}/${PURPOSE_SLUG[purpose]}/${id}`;
}

class CloudinaryStorage implements StorageProvider {
  constructor(
    private readonly cfg: { cloudName: string; apiKey: string; apiSecret: string },
    private readonly appEnv: string,
  ) {
    cloudinary.config({ cloud_name: cfg.cloudName, api_key: cfg.apiKey, api_secret: cfg.apiSecret, secure: true });
  }

  upload({ bytes, userId, purpose }: { bytes: Uint8Array; userId: string; purpose: AssetPurpose; format: string }) {
    const publicId = buildStorageKey(this.appEnv, userId, purpose);
    return new Promise<StoredObject>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          public_id: publicId,
          resource_type: "image",
          type: "authenticated",
          overwrite: false,
          unique_filename: false,
          use_filename: false,
        },
        (error, result) => {
          if (error || !result) return reject(error ?? new Error("Cloudinary upload failed"));
          resolve({ storageKey: result.public_id, deliveryType: "authenticated" });
        },
      );
      Readable.from(Buffer.from(bytes)).pipe(stream);
    });
  }

  signedUrl(object: { storageKey: string; deliveryType: string; format: string }, ttlSeconds = SIGNED_URL_TTL_SECONDS) {
    return cloudinary.utils.private_download_url(object.storageKey, object.format, {
      resource_type: "image",
      type: object.deliveryType,
      expires_at: Math.floor(Date.now() / 1000) + ttlSeconds,
    });
  }

  async download(object: { storageKey: string; deliveryType: string; format: string; mimeType: string }) {
    const env = getEnv();
    const { bytes } = await safeFetchBytes(this.signedUrl(object, 120), {
      allowedHosts: env.storageAllowedHosts,
      allowedContentTypes: [object.mimeType, "application/octet-stream"],
      maxBytes: MAX_DOWNLOAD_BYTES,
      timeoutMs: 20_000,
    });
    return bytes;
  }

  async remove(object: { storageKey: string; deliveryType: string }) {
    const result = (await cloudinary.uploader.destroy(object.storageKey, {
      resource_type: "image",
      type: object.deliveryType,
      invalidate: true,
    })) as { result?: string };
    if (result.result !== "ok" && result.result !== "not found") {
      throw new Error(`Cloudinary destroy returned ${result.result ?? "unknown"}`);
    }
  }
}

let override: StorageProvider | undefined;
let instance: StorageProvider | undefined;

export function setStorageForTesting(provider: StorageProvider | undefined) {
  override = provider;
}

/** Returns null when storage is not configured (development without Cloudinary). */
export function getStorage(): StorageProvider | null {
  if (override) return override;
  if (instance) return instance;
  const env = getEnv();
  if (!env.cloudinary) return null;
  instance = new CloudinaryStorage(env.cloudinary, env.appEnv);
  return instance;
}
