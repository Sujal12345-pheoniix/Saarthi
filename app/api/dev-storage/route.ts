import { getStorage } from "@/lib/storage/storage";
import { LocalFileStorage } from "@/lib/storage/local-storage";

export const runtime = "nodejs";

const MIME: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };

/**
 * GET /api/dev-storage?key=&format=&exp=&sig=
 * Serves a privately stored photo in LOCAL DEVELOPMENT only (see lib/storage/local-storage.ts).
 * Answers 404 whenever local storage is not the active store, so it does nothing in staging/production.
 * Access needs an unexpired HMAC signature minted by the server, like a Cloudinary signed URL.
 */
export async function GET(req: Request) {
  const storage = getStorage();
  if (!(storage instanceof LocalFileStorage)) return new Response("Not found", { status: 404 });

  const url = new URL(req.url);
  const storageKey = url.searchParams.get("key") ?? "";
  const format = url.searchParams.get("format") ?? "";
  const expiresAt = Number(url.searchParams.get("exp"));
  const signature = url.searchParams.get("sig") ?? "";
  if (!MIME[format] || !storage.verify({ storageKey, format, expiresAt, signature })) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const bytes = await storage.download({ storageKey, format });
    return new Response(Buffer.from(bytes), {
      headers: {
        "content-type": MIME[format],
        "cache-control": "private, max-age=60",
        "x-content-type-options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
