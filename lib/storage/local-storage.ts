import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AssetPurpose } from "@prisma/client";
import { buildStorageKey, MAX_DOWNLOAD_BYTES, SIGNED_URL_TTL_SECONDS, type StorageProvider, type StoredObject } from "./storage";

/**
 * DEVELOPMENT-ONLY private photo storage on the local disk, used when Cloudinary is not configured so that
 * uploads and analyses work on a developer machine. `getEnv().localStorageDir` is only ever set when
 * NODE_ENV=development and APP_ENV=development, so this class cannot be selected in staging/production.
 *
 * Same security properties as the Cloudinary store, scaled to one machine:
 * - object keys are server-generated (buildStorageKey); the client never influences a path;
 * - every resolved path is checked to stay inside the storage root (no traversal);
 * - files are served only through /api/dev-storage with an HMAC-signed, expiring URL.
 */

const KEY_RE = /^saarthi\/[a-z]+\/users\/[a-z0-9]+\/[a-z]+\/[0-9a-f-]{36}$/i;
const FORMAT_RE = /^(jpg|jpeg|png|webp)$/;

export function localSigningKey(secretMaterial: string): Buffer {
  return createHash("sha256").update(`saarthi-local-storage:${secretMaterial}`).digest();
}

export function signLocalUrl(key: Buffer, storageKey: string, format: string, expiresAt: number): string {
  return createHmac("sha256", key).update(`${storageKey}.${format}:${expiresAt}`).digest("base64url");
}

export function verifyLocalSignature(
  key: Buffer,
  input: { storageKey: string; format: string; expiresAt: number; signature: string },
  now = Date.now(),
): boolean {
  if (!Number.isFinite(input.expiresAt) || input.expiresAt * 1000 < now) return false;
  const expected = Buffer.from(signLocalUrl(key, input.storageKey, input.format, input.expiresAt));
  const given = Buffer.from(input.signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export class LocalFileStorage implements StorageProvider {
  readonly providerName = "LOCAL_FILESYSTEM" as const;
  private readonly root: string;

  constructor(
    rootDir: string,
    private readonly appEnv: string,
    private readonly signingKey: Buffer,
  ) {
    this.root = path.resolve(rootDir);
  }

  /** Absolute path for a stored object; throws if the key or format is malformed or escapes the root. */
  resolve(storageKey: string, format: string): string {
    if (!KEY_RE.test(storageKey) || !FORMAT_RE.test(format)) throw new Error("Invalid local storage key");
    const full = path.resolve(this.root, `${storageKey}.${format}`);
    if (!full.startsWith(this.root + path.sep)) throw new Error("Invalid local storage key");
    return full;
  }

  async upload({ bytes, userId, purpose, format }: { bytes: Uint8Array; userId: string; purpose: AssetPurpose; format: string }) {
    const storageKey = buildStorageKey(this.appEnv, userId, purpose);
    const file = this.resolve(storageKey, format);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, bytes, { flag: "wx" });
    return { storageKey, deliveryType: "local" } satisfies StoredObject;
  }

  signedUrl(object: { storageKey: string; deliveryType: string; format: string }, ttlSeconds = SIGNED_URL_TTL_SECONDS) {
    const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
    const params = new URLSearchParams({
      key: object.storageKey,
      format: object.format,
      exp: String(expiresAt),
      sig: signLocalUrl(this.signingKey, object.storageKey, object.format, expiresAt),
    });
    return `/api/dev-storage?${params.toString()}`;
  }

  async download(object: { storageKey: string; format: string }) {
    const bytes = await readFile(this.resolve(object.storageKey, object.format));
    if (bytes.byteLength > MAX_DOWNLOAD_BYTES) throw new Error("Stored image exceeds the download limit");
    return new Uint8Array(bytes);
  }

  async remove(object: { storageKey: string; format?: string }) {
    for (const format of object.format ? [object.format] : ["jpg", "jpeg", "png", "webp"]) {
      await rm(this.resolve(object.storageKey, format), { force: true });
    }
  }

  verify(input: { storageKey: string; format: string; expiresAt: number; signature: string }) {
    return verifyLocalSignature(this.signingKey, input);
  }
}
