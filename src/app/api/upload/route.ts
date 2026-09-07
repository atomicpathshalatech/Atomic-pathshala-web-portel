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
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return apiError("Unauthorized", 401);
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const targetFolder = (formData.get("folder") as string) || "questions";

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
      else if (name.endsWith(".webp")) ext = "webp";
    }

    if (!ext) {
      return apiError("Unsupported file type. Please upload an image, PDF, PPT, or PPTX file.", 400);
    }

    const isImage = ["jpg", "png", "webp", "gif", "svg"].includes(ext);
    const buffer = Buffer.from(await file.arrayBuffer());

    // Generate clean, short unique filename (e.g. q_lh8w2_7a9f.png)
    const shortRandom = Math.random().toString(36).substring(2, 7);
    const shortTime = Date.now().toString(36);
    const shortFileName = isImage
      ? `q_${shortTime}_${shortRandom}.${ext}`
      : `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    const subDir = isImage ? "questions" : targetFolder === "presentations" ? "presentations" : "files";
    const key = `${subDir}/${shortFileName}`;

    // 1. Try cloud storage first if configured
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
          contentType: file.type || (isImage ? `image/${ext}` : "application/octet-stream"),
        });

        return apiSuccess({
          url: publicUrl,
          name: shortFileName,
          type: ext.toUpperCase(),
          size: file.size,
        });
      }
    } catch (cloudErr) {
      console.warn("Cloud storage upload warning, falling back to local storage:", cloudErr);
    }

    // 2. Save to local server filesystem storage (clean short URL)
    try {
      const uploadsDir = path.join(process.cwd(), "public", "uploads", subDir);
      await mkdir(uploadsDir, { recursive: true });
      const filePath = path.join(uploadsDir, shortFileName);
      await writeFile(filePath, buffer);

      const localUrl = `/uploads/${subDir}/${shortFileName}`;
      return apiSuccess({
        url: localUrl,
        name: shortFileName,
        type: ext.toUpperCase(),
        size: file.size,
      });
    } catch (localWriteErr) {
      console.error("Local filesystem write error:", localWriteErr);
      return apiError("Failed to save uploaded file locally", 500);
    }
  } catch (error) {
    return handleApiError(error);
  }
}
