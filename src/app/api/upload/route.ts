import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { uploadFile } from "@/lib/storage";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const ALLOWED_MIME_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError("Unauthorized", 401);
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return apiError("No file uploaded", 400);
    }

    if (file.size > MAX_FILE_SIZE) {
      return apiError("File size exceeds maximum allowed size (50MB)", 400);
    }

    // Determine extension
    let ext = ALLOWED_MIME_TYPES[file.type];
    if (!ext) {
      const name = file.name.toLowerCase();
      if (name.endsWith(".pdf")) ext = "pdf";
      else if (name.endsWith(".pptx")) ext = "pptx";
      else if (name.endsWith(".ppt")) ext = "ppt";
      else if (name.endsWith(".png")) ext = "png";
      else if (name.endsWith(".jpg") || name.endsWith(".jpeg")) ext = "jpg";
    }

    if (!ext) {
      return apiError("Unsupported file type. Please upload a PDF, PPT, or PPTX file.", 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `live-presentations/${Date.now()}-${safeName}`;

    // 1. Try cloud storage first
    try {
      if (
        process.env.STORAGE_ENDPOINT &&
        process.env.STORAGE_BUCKET_NAME &&
        process.env.STORAGE_ACCESS_KEY_ID &&
        process.env.STORAGE_SECRET_ACCESS_KEY &&
        process.env.STORAGE_PUBLIC_URL
      ) {
        const publicUrl = await uploadFile({
          key,
          body: buffer,
          contentType: file.type || "application/octet-stream",
        });

        return apiSuccess({
          url: publicUrl,
          name: file.name,
          type: ext.toUpperCase(),
          size: file.size,
        });
      }
    } catch (cloudErr) {
      console.warn("Cloud storage upload warning, falling back to local storage:", cloudErr);
    }

    // 2. Fallback to local server filesystem storage
    try {
      const uploadsDir = path.join(process.cwd(), "public", "uploads", "presentations");
      await mkdir(uploadsDir, { recursive: true });
      const fileName = `${Date.now()}-${safeName}`;
      const filePath = path.join(uploadsDir, fileName);
      await writeFile(filePath, buffer);

      const localUrl = `/uploads/presentations/${fileName}`;
      return apiSuccess({
        url: localUrl,
        name: file.name,
        type: ext.toUpperCase(),
        size: file.size,
      });
    } catch (localWriteErr) {
      console.error("Local filesystem write warning, using inline data url:", localWriteErr);
    }

    // 3. Fallback to inline Base64 data URL
    const base64Data = buffer.toString("base64");
    const dataUrl = `data:${file.type || "application/pdf"};base64,${base64Data}`;
    return apiSuccess({
      url: dataUrl,
      name: file.name,
      type: ext.toUpperCase(),
      size: file.size,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
