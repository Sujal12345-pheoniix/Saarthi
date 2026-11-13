import { createHash } from "node:crypto";
import { AppError, Errors } from "@/lib/api/errors";

/**
 * Server-side image verification. The browser-declared MIME type is never trusted:
 * the type comes from the file signature and dimensions come from the image header.
 */

export type ImageMime = "image/jpeg" | "image/png" | "image/webp";

export interface ImageLimits {
  maxBytes: number;
  minDimension: number;
  maxDimension: number;
  maxPixels: number;
}

export const UPLOAD_IMAGE_LIMITS: ImageLimits = {
  maxBytes: 10 * 1024 * 1024,
  minDimension: 320,
  maxDimension: 8192,
  maxPixels: 40_000_000,
};

export interface VerifiedImage {
  mimeType: ImageMime;
  format: "jpg" | "png" | "webp";
  width: number;
  height: number;
  sizeBytes: number;
  sha256: string;
}

const startsWith = (b: Uint8Array, sig: number[], offset = 0) => sig.every((v, i) => b[offset + i] === v);

export function detectImageType(bytes: Uint8Array): ImageMime | null {
  if (bytes.length >= 3 && startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (bytes.length >= 8 && startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (
    bytes.length >= 12 &&
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && // RIFF
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8) // WEBP
  ) {
    return "image/webp";
  }
  return null;
}

const u16be = (b: Uint8Array, o: number) => (b[o] << 8) | b[o + 1];
const u32be = (b: Uint8Array, o: number) => ((b[o] << 24) >>> 0) + ((b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]);
const u16le = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8);
const u24le = (b: Uint8Array, o: number) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16);

function pngDimensions(b: Uint8Array) {
  // Signature (8) + IHDR length (4) + "IHDR" (4) + width (4) + height (4)
  if (b.length < 24 || !startsWith(b, [0x49, 0x48, 0x44, 0x52], 12)) return null;
  return { width: u32be(b, 16), height: u32be(b, 20) };
}

function jpegDimensions(b: Uint8Array) {
  let o = 2;
  while (o + 9 < b.length) {
    if (b[o] !== 0xff) return null;
    const marker = b[o + 1];
    if (marker === 0xff) {
      o += 1; // fill byte
      continue;
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      o += 2; // standalone markers
      continue;
    }
    const length = u16be(b, o + 2);
    if (length < 2) return null;
    // SOF0–SOF15 except DHT (C4), JPG (C8), DAC (CC)
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: u16be(b, o + 5), width: u16be(b, o + 7) };
    }
    if (marker === 0xda || marker === 0xd9) return null; // start of scan / end without SOF
    o += 2 + length;
  }
  return null;
}

function webpDimensions(b: Uint8Array) {
  if (b.length < 30) return null;
  const chunk = String.fromCharCode(b[12], b[13], b[14], b[15]);
  if (chunk === "VP8 ") {
    // Frame tag (3) then start code 9d 01 2a, then 14-bit width/height
    if (!startsWith(b, [0x9d, 0x01, 0x2a], 23)) return null;
    return { width: u16le(b, 26) & 0x3fff, height: u16le(b, 28) & 0x3fff };
  }
  if (chunk === "VP8L") {
    if (b[20] !== 0x2f) return null;
    const bits = b[21] | (b[22] << 8) | (b[23] << 16) | (b[24] << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X") {
    return { width: u24le(b, 24) + 1, height: u24le(b, 27) + 1 };
  }
  return null;
}

export function readImageDimensions(bytes: Uint8Array, type: ImageMime): { width: number; height: number } | null {
  const dims =
    type === "image/png" ? pngDimensions(bytes) : type === "image/jpeg" ? jpegDimensions(bytes) : webpDimensions(bytes);
  if (!dims || dims.width <= 0 || dims.height <= 0) return null;
  return dims;
}

const FORMAT: Record<ImageMime, VerifiedImage["format"]> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function verifyImage(bytes: Uint8Array, limits: ImageLimits = UPLOAD_IMAGE_LIMITS): VerifiedImage {
  if (bytes.byteLength === 0) throw Errors.badRequest("The uploaded file is empty.");
  if (bytes.byteLength > limits.maxBytes) throw Errors.payloadTooLarge(limits.maxBytes);

  const mimeType = detectImageType(bytes);
  if (!mimeType) {
    throw Errors.unsupportedMediaType("Only JPEG, PNG and WEBP images are accepted (file contents did not match).");
  }
  const dims = readImageDimensions(bytes, mimeType);
  if (!dims) throw Errors.badRequest("The image header could not be read. The file may be corrupted.");

  const { width, height } = dims;
  if (width < limits.minDimension || height < limits.minDimension) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Image is too small (${width}×${height}). Minimum is ${limits.minDimension}×${limits.minDimension} pixels.`,
      400,
    );
  }
  if (width > limits.maxDimension || height > limits.maxDimension || width * height > limits.maxPixels) {
    throw new AppError(
      "VALIDATION_ERROR",
      `Image dimensions are too large (${width}×${height}). Maximum side is ${limits.maxDimension} pixels.`,
      400,
    );
  }

  return {
    mimeType,
    format: FORMAT[mimeType],
    width,
    height,
    sizeBytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}
