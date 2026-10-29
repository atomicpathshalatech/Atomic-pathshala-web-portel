/**
 * Recorded-lecture file rules — pure, unit tested (scripts/test-recorded-lectures.ts).
 */

/** Formats a browser can play from a signed URL. */
export const VIDEO_TYPES: Record<string, { extensions: string[]; label: string }> = {
  "video/mp4": { extensions: ["mp4", "m4v"], label: "MP4" },
  "video/webm": { extensions: ["webm"], label: "WebM" },
  "video/quicktime": { extensions: ["mov"], label: "MOV" },
};

export const THUMBNAIL_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;

const MIB = 1024 * 1024;
/** R2 / S3 multipart limits: parts of 5 MiB–5 GiB, at most 10,000 parts. */
export const MIN_PART_BYTES = 5 * MIB;
export const MAX_PARTS = 10_000;

/**
 * Part size for a file: 16 MiB, or larger for very big files so the upload
 * stays under 9,000 parts (room to spare below R2's 10,000).
 */
export function partSizeFor(sizeBytes: number): number {
  const needed = Math.ceil(sizeBytes / 9000);
  return Math.max(16 * MIB, Math.ceil(needed / MIB) * MIB);
}

export function partCountFor(sizeBytes: number, partSize: number): number {
  return Math.max(1, Math.ceil(sizeBytes / partSize));
}

export type FileCheck = { ok: true; mimeType: string } | { ok: false; error: string };

/** What the browser says about the file — checked again against its bytes after upload. */
export function checkVideoDeclaration(file: { name: string; size: number; type: string }, maxBytes: number): FileCheck {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  const declared = (file.type || "").toLowerCase();
  const byExt = Object.entries(VIDEO_TYPES).find(([, v]) => v.extensions.includes(ext))?.[0];
  if (!byExt) return { ok: false, error: `Only ${Object.values(VIDEO_TYPES).map((v) => v.label).join(", ")} videos can be uploaded.` };
  if (declared && declared !== byExt && !(declared === "video/x-m4v" && byExt === "video/mp4")) {
    return { ok: false, error: `The file says it is "${declared}" but is named .${ext}. Export the video again as MP4.` };
  }
  if (!Number.isFinite(file.size) || file.size <= 0) return { ok: false, error: "The file is empty." };
  if (file.size > maxBytes) {
    return { ok: false, error: `The file is ${(file.size / 1024 ** 3).toFixed(2)} GB; the limit is ${(maxBytes / 1024 ** 3).toFixed(1)} GB.` };
  }
  return { ok: true, mimeType: byExt };
}

/**
 * Does the start of the file match a video container? MP4/MOV/M4V have an
 * ISO-BMFF box ("ftyp", sometimes "moov"/"mdat"/"free"/"wide" first) at byte 4;
 * WebM starts with the EBML magic 1A 45 DF A3.
 */
export function sniffVideo(head: Uint8Array): "video/mp4" | "video/quicktime" | "video/webm" | null {
  if (head.length >= 4 && head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3) return "video/webm";
  if (head.length >= 12) {
    const box = String.fromCharCode(head[4]!, head[5]!, head[6]!, head[7]!);
    if (box === "ftyp") {
      const brand = String.fromCharCode(head[8]!, head[9]!, head[10]!, head[11]!);
      return brand === "qt  " ? "video/quicktime" : "video/mp4";
    }
    if (["moov", "mdat", "free", "wide", "skip"].includes(box)) return "video/quicktime";
  }
  return null;
}

/** Is the sniffed container acceptable for the declared type? (MP4 and MOV share the format.) */
export function sniffMatches(declared: string, sniffed: string | null): boolean {
  if (!sniffed) return false;
  if (declared === "video/webm") return sniffed === "video/webm";
  return sniffed === "video/mp4" || sniffed === "video/quicktime";
}

/** Stable object key: lectures/<course>/<chapter>/<lecture>/<upload>.<ext> — never reused. */
export function videoObjectKey(p: { courseId: string; chapterId: string; lectureId: string; uploadToken: string; mimeType: string }): string {
  const ext = VIDEO_TYPES[p.mimeType]?.extensions[0] ?? "mp4";
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, "");
  return `lectures/${safe(p.courseId)}/${safe(p.chapterId)}/${safe(p.lectureId)}/${safe(p.uploadToken)}.${ext}`;
}

export function thumbnailObjectKey(lectureId: string, token: string, contentType: string): string {
  const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  return `thumbnails/${lectureId.replace(/[^a-zA-Z0-9_-]/g, "")}/${token.replace(/[^a-zA-Z0-9_-]/g, "")}.${ext}`;
}

/** "Ravi Kumar" + "STU2026001234" → "Ravi K. · ****1234" — enough to trace a leak, nothing sensitive. */
export function watermarkLabel(name: string | null | undefined, code: string | null | undefined): string {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  const shortName = parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]![0]}.` : parts[0] ?? "Student";
  const c = String(code ?? "").replace(/\s+/g, "");
  const masked = c.length > 4 ? `****${c.slice(-4)}` : c ? "****" : "";
  return masked ? `${shortName} · ${masked}` : shortName;
}
