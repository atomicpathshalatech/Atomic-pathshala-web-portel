import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { uploadFile, storageConfigured, activeStorageInfo } from "@/lib/storage";
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

const IMAGE_EXTS = new Set(["jpg", "png", "webp", "gif", "svg"]);

/**
 * Sniff the first bytes so a file can't lie about being an image via its
 * Content-Type / extension alone (spec §22 — secure MIME validation). SVG
 * is text so it's checked for a root <svg tag instead of a binary magic.
 */
function looksLikeImage(buf: Buffer, ext: string): boolean {
  if (buf.length < 12) return false;
  const hex = buf.subarray(0, 12).toString("hex");
  if (ext === "png") return hex.startsWith("89504e470d0a1a0a");
  if (ext === "jpg") return hex.startsWith("ffd8ff");
  if (ext === "gif") return hex.startsWith("474946383761") || hex.startsWith("474946383961");
  if (ext === "webp") return hex.startsWith("52494646") && buf.subarray(8, 12).toString("ascii") === "WEBP";
  if (ext === "svg") {
    const head = buf.subarray(0, 512).toString("utf8").toLowerCase();
    return head.includes("<svg") || head.includes("<?xml");
  }
  return false;
}

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
      else if (name.endsWith(".gif")) ext = "gif";
      else if (name.endsWith(".svg")) ext = "svg";
    }

    if (!ext) {
      return apiError("Unsupported file type. Please upload an image, PDF, PPT, or PPTX file.", 400);
    }

    const isImage = IMAGE_EXTS.has(ext);
    const buffer = Buffer.from(await file.arrayBuffer());

    // Content sniff for images — reject a spoofed content-type / extension.
    if (isImage && !looksLikeImage(buffer, ext)) {
      return apiError("That file does not look like a valid image. Please upload a real PNG, JPG, WEBP, GIF or SVG.", 400);
    }

    // Generate clean, short unique filename (e.g. q_lh8w2_7a9f.png)
    const shortRandom = Math.random().toString(36).substring(2, 7);
    const shortTime = Date.now().toString(36);
    const shortFileName = isImage
      ? `q_${shortTime}_${shortRandom}.${ext}`
      : `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

    const subDir = isImage ? "questions" : targetFolder === "presentations" ? "presentations" : "files";
    const key = `${subDir}/${shortFileName}`;

    // 1. Cloud object storage — the source of truth whenever it's configured.
    //    Previously a cloud failure here was swallowed and the file was
    //    written to ./public/uploads instead: that "works" on a dev laptop
    //    but silently 404s on any serverless / read-only host, which is
    //    exactly how a broken upload stayed invisible. Now: if storage is
    //    configured, a failure is a real 502 that names the bucket.
    if (storageConfigured()) {
      try {
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
          provider: "cloud",
          storage: activeStorageInfo(),
        });
      } catch (cloudErr) {
        const info = activeStorageInfo();
        console.error("[upload] cloud storage PUT failed", {
          key,
          bucket: info.bucket,
          endpointHost: info.endpointHost,
          error: cloudErr instanceof Error ? cloudErr.message : String(cloudErr),
        });
        return apiError(
          `Upload to object storage failed (bucket "${info.bucket}" @ ${info.endpointHost}). ` +
            `Check the STORAGE_* credentials — if .env has more than one STORAGE_* block the last one wins. ` +
            `Details: ${cloudErr instanceof Error ? cloudErr.message : String(cloudErr)}`,
          502
        );
      }
    }

    // 2. No cloud storage configured (pure local dev) — write under
    //    ./public/uploads so the app still works offline.
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
        provider: "local",
        storage: activeStorageInfo(),
      });
    } catch (localWriteErr) {
      console.error("Local filesystem write error:", localWriteErr);
      return apiError(
        "File storage isn't configured (no STORAGE_* env) and the local fallback write failed. " +
          "Set STORAGE_ENDPOINT / STORAGE_BUCKET_NAME / STORAGE_ACCESS_KEY_ID / STORAGE_SECRET_ACCESS_KEY / STORAGE_PUBLIC_URL.",
        500
      );
    }
  } catch (error) {
    return handleApiError(error);
  }
}
