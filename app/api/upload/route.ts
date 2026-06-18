import { v2 as cloudinary } from "cloudinary";
import { Readable } from "node:stream";

export const runtime = "nodejs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

function uploadStream(buffer: Buffer, folder: string) {
  return new Promise<{ secure_url: string; public_id: string }>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (error, result) => {
        if (error || !result) {
          reject(error ?? new Error("Cloudinary upload failed"));
          return;
        }

        resolve({ secure_url: result.secure_url, public_id: result.public_id });
      }
    );

    Readable.from(buffer).pipe(stream);
  });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const folder = String(formData.get("folder") ?? "saarthi-wellness");

    if (!file) {
      return Response.json({ success: false, error: "A file is required." }, { status: 400 });
    }

    // Accept browser `File` and Node/undici `Blob`-like values that implement
    // `arrayBuffer()` so the route works from both browser fetch and server-side
    // Node scripts used for testing.
    let bytes: Buffer;
    let fileType = "";
    if (file instanceof File) {
      bytes = Buffer.from(await file.arrayBuffer());
      fileType = file.type;
    } else if (typeof (file as any)?.arrayBuffer === "function") {
      bytes = Buffer.from(await (file as any).arrayBuffer());
      fileType = (file as any).type || "";
    } else {
      return Response.json({ success: false, error: "A file is required." }, { status: 400 });
    }

    // Validate image formats: JPG, PNG, WEBP
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (fileType && !allowedTypes.includes(fileType)) {
      return Response.json({ success: false, error: "Invalid file type. Only JPG, PNG, and WEBP are allowed." }, { status: 400 });
    }

    // Validate size limit: 10MB
    const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
    if (bytes.length > MAX_BYTES) {
      return Response.json({ success: false, error: `File too large. Max ${Math.round(MAX_BYTES / 1024 / 1024)}MB allowed.` }, { status: 413 });
    }

    const upload = await uploadStream(bytes, folder);

    return Response.json({ success: true, url: upload.secure_url, publicId: upload.public_id });
  } catch (error: any) {
    console.error("Error in /api/upload:", error);
    return Response.json({ success: false, error: error.message || "Upload failed" }, { status: 500 });
  }
}
