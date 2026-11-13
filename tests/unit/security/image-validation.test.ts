import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/api/errors";
import { detectImageType, readImageDimensions, verifyImage } from "@/lib/security/image-validation";
import { makeJpegHeader, makePng, makeWebpHeader, SVG_BYTES } from "../../helpers/images";

function codeOf(fn: () => unknown) {
  try {
    fn();
  } catch (e) {
    return e instanceof AppError ? `${e.status}:${e.code}` : "other";
  }
  return "ok";
}

describe("image signature detection", () => {
  it("detects JPEG, PNG and WebP from bytes", () => {
    expect(detectImageType(makeJpegHeader(640, 480))).toBe("image/jpeg");
    expect(detectImageType(makePng(400, 400))).toBe("image/png");
    expect(detectImageType(makeWebpHeader(800, 600))).toBe("image/webp");
  });

  it("rejects SVG, HTML and random bytes regardless of claimed type", () => {
    expect(detectImageType(SVG_BYTES)).toBeNull();
    expect(detectImageType(new TextEncoder().encode("<!doctype html><html>"))).toBeNull();
    expect(detectImageType(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))).toBeNull();
  });
});

describe("dimension parsing", () => {
  it("reads dimensions from PNG, JPEG and WebP headers", () => {
    expect(readImageDimensions(makePng(401, 333), "image/png")).toEqual({ width: 401, height: 333 });
    expect(readImageDimensions(makeJpegHeader(1920, 1080), "image/jpeg")).toEqual({ width: 1920, height: 1080 });
    expect(readImageDimensions(makeWebpHeader(1000, 750), "image/webp")).toEqual({ width: 1000, height: 750 });
  });

  it("returns null for a truncated header", () => {
    expect(readImageDimensions(makePng(400, 400).slice(0, 20), "image/png")).toBeNull();
    expect(readImageDimensions(makeJpegHeader(640, 480).slice(0, 12), "image/jpeg")).toBeNull();
  });
});

describe("verifyImage", () => {
  it("accepts a valid image and returns verified metadata", () => {
    const bytes = makePng(512, 512);
    const v = verifyImage(bytes);
    expect(v).toMatchObject({
      mimeType: "image/png",
      format: "png",
      width: 512,
      height: 512,
      sizeBytes: bytes.byteLength,
    });
    expect(v.sha256).toBe(createHash("sha256").update(bytes).digest("hex"));
  });

  it("rejects non-images with 415", () => {
    expect(codeOf(() => verifyImage(SVG_BYTES))).toBe("415:UNSUPPORTED_MEDIA_TYPE");
  });

  it("rejects images below the minimum dimension", () => {
    expect(codeOf(() => verifyImage(makePng(200, 600)))).toBe("400:VALIDATION_ERROR");
  });

  it("rejects images above the maximum dimension (decompression-bomb guard)", () => {
    expect(codeOf(() => verifyImage(makeJpegHeader(20000, 20000)))).toBe("400:VALIDATION_ERROR");
  });

  it("rejects oversized payloads with 413", () => {
    const big = new Uint8Array(11 * 1024 * 1024);
    big.set(makePng(400, 400));
    expect(codeOf(() => verifyImage(big))).toBe("413:PAYLOAD_TOO_LARGE");
  });

  it("rejects empty files", () => {
    expect(codeOf(() => verifyImage(new Uint8Array()))).toBe("400:VALIDATION_ERROR");
  });
});
