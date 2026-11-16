import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalFileStorage, localSigningKey, signLocalUrl, verifyLocalSignature } from "@/lib/storage/local-storage";
import { parseEnv } from "@/lib/config/env";

const KEY = localSigningKey("unit-test-secret");

describe("local development storage", () => {
  let dir: string;
  let store: LocalFileStorage;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "saarthi-local-"));
    store = new LocalFileStorage(dir, "development", KEY);
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("round-trips bytes under a server-generated key", async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const stored = await store.upload({ bytes, userId: "cuser123", purpose: "SKIN_SCAN", format: "jpg" });
    expect(stored.storageKey).toMatch(/^saarthi\/development\/users\/cuser123\/skin\/[0-9a-f-]{36}$/);
    expect(store.providerName).toBe("LOCAL_FILESYSTEM");
    expect(await store.download({ storageKey: stored.storageKey, format: "jpg" })).toEqual(bytes);

    await store.remove({ storageKey: stored.storageKey, format: "jpg" });
    await expect(store.download({ storageKey: stored.storageKey, format: "jpg" })).rejects.toThrow();
  });

  it("removes orphans without knowing the format", async () => {
    const stored = await store.upload({ bytes: new Uint8Array([9]), userId: "cuser123", purpose: "PHYSICAL_SCAN", format: "png" });
    await store.remove({ storageKey: stored.storageKey });
    const leaf = path.join(dir, "saarthi", "development", "users", "cuser123", "physical");
    expect(await readdir(leaf)).toEqual([]);
  });

  it.each([
    ["../../etc/passwd", "jpg"],
    ["saarthi/development/users/../../../x/skin/00000000-0000-0000-0000-000000000000", "jpg"],
    ["saarthi/development/users/cuser123/skin/00000000-0000-0000-0000-000000000000", "exe"],
  ])("refuses malformed or traversing keys (%s.%s)", (key, format) => {
    expect(() => store.resolve(key, format)).toThrow(/Invalid local storage key/);
  });

  it("signs URLs that verify only while unexpired and untampered", () => {
    const url = new URL(store.signedUrl({ storageKey: "saarthi/development/users/u1/skin/k", deliveryType: "local", format: "jpg" }), "http://x");
    expect(url.pathname).toBe("/api/dev-storage");
    const input = {
      storageKey: url.searchParams.get("key")!,
      format: url.searchParams.get("format")!,
      expiresAt: Number(url.searchParams.get("exp")),
      signature: url.searchParams.get("sig")!,
    };
    expect(store.verify(input)).toBe(true);
    expect(store.verify({ ...input, storageKey: input.storageKey + "x" })).toBe(false);
    expect(store.verify({ ...input, signature: input.signature.slice(0, -1) + "A" })).toBe(false);
    expect(verifyLocalSignature(localSigningKey("other-secret"), input)).toBe(false);
    const expired = { ...input, expiresAt: 1000, signature: signLocalUrl(KEY, input.storageKey, input.format, 1000) };
    expect(verifyLocalSignature(KEY, expired)).toBe(false);
  });

  it("is only ever enabled for local development without Cloudinary", () => {
    expect(parseEnv({ NODE_ENV: "development", APP_ENV: "development" }).localStorageDir).toBe(".data/uploads");
    expect(parseEnv({ NODE_ENV: "development", APP_ENV: "staging" }).localStorageDir).toBeUndefined();
    expect(parseEnv({ NODE_ENV: "test", APP_ENV: "test" }).localStorageDir).toBeUndefined();
    expect(parseEnv({ NODE_ENV: "production" }).localStorageDir).toBeUndefined();
    expect(
      parseEnv({
        NODE_ENV: "development",
        CLOUDINARY_CLOUD_NAME: "c",
        CLOUDINARY_API_KEY: "k",
        CLOUDINARY_API_SECRET: "s",
      }).localStorageDir,
    ).toBeUndefined();
  });
});
