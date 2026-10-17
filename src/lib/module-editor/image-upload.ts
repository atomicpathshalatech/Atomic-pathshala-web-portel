"use client";

import { uploadFileToR2 } from "@/lib/storage/upload-client";

/**
 * Images placed in the module editor (pictures, replacement images, the
 * watermark, a background, a cover logo) were kept as base64 text and sent
 * inside the Save request. Vercel refuses a request body over ~4.5 MB, so one
 * or two phone photos made every save fail ("Save failed with HTTP 413"), and
 * a .webp image silently went missing from the saved PDF (the PDF writer
 * only reads PNG/JPEG and skipped it).
 *
 * Before saving, every embedded image is:
 *   - redrawn as PNG (if it can be transparent) or JPEG, at most 2000 px on
 *     its longest side — the PDF never needs more, and PNG/JPEG is what the
 *     PDF writer reads;
 *   - uploaded straight from the browser to file storage, and replaced in the
 *     save request by its URL (the server already embeds images by URL).
 * The same picture is uploaded only once per editor session.
 */

const MAX_SIDE = 2000;
const uploaded = new Map<string, string>();

function cacheKey(dataUrl: string): string {
  return `${dataUrl.length}:${dataUrl.slice(0, 80)}:${dataUrl.slice(-80)}`;
}

function isImageDataUrl(v: unknown): v is string {
  return typeof v === "string" && v.startsWith("data:image/");
}

async function toPdfReadyBlob(dataUrl: string): Promise<{ blob: Blob; ext: "png" | "jpg" }> {
  const img = new Image();
  img.decoding = "async";
  img.src = dataUrl;
  await img.decode();
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This browser cannot prepare the image.");
  // PNG keeps transparency (logos, cut-outs); photos become JPEG (much smaller).
  const keepAlpha = /^data:image\/(png|webp|gif|svg)/i.test(dataUrl);
  if (!keepAlpha) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(img, 0, 0, w, h);
  const type = keepAlpha ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9));
  if (!blob) throw new Error("Could not prepare the image for the PDF.");
  return { blob, ext: keepAlpha ? "png" : "jpg" };
}

async function uploadOne(dataUrl: string, moduleId: string): Promise<string> {
  const key = cacheKey(dataUrl);
  const hit = uploaded.get(key);
  if (hit) return hit;
  const { blob, ext } = await toPdfReadyBlob(dataUrl);
  const file = new File([blob], `module-image-${Date.now()}.${ext}`, { type: blob.type });
  const res = await uploadFileToR2(file, { prefix: "modules", fileType: "IMAGE", visibility: "PUBLIC", entityId: moduleId });
  if (!res.url) throw new Error("The image was uploaded but no address came back for it.");
  uploaded.set(key, res.url);
  return res.url;
}

/**
 * Returns a copy of `payload` in which every image held as base64 text is
 * replaced by the address of the uploaded image. Everything else is unchanged.
 */
export async function moveEditorImagesToStorage<T>(payload: T, moduleId: string): Promise<T> {
  const walk = async (value: unknown): Promise<unknown> => {
    if (isImageDataUrl(value)) return uploadOne(value, moduleId);
    if (Array.isArray(value)) return Promise.all(value.map(walk));
    if (value && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = await walk(v);
      return out;
    }
    return value;
  };
  return (await walk(payload)) as T;
}
