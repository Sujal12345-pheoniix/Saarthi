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
  const formData = await request.formData();
  const file = formData.get("file");
  const folder = String(formData.get("folder") ?? "saarthi-wellness");

  if (!(file instanceof File)) {
    return Response.json({ error: "A file is required." }, { status: 400 });
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  const upload = await uploadStream(bytes, folder);

  return Response.json({ url: upload.secure_url, publicId: upload.public_id });
}
