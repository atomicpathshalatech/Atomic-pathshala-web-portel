import "server-only";
import { prisma } from "@/lib/db";
import { createPresignedDownloadUrl } from "@/lib/storage/r2-client";

/**
 * Turns whatever link was stored for an uploaded file into a link that works
 * right now.
 *
 * Several places stored a signed R2 link that is valid for only 10 minutes
 * (a class's presentation PDF among them), so the file could no longer be
 * opened once those minutes had passed. A stored value can be:
 *   - a storage key ("modules/live-classes/…")
 *   - "/api/files/<id>/access" or "/api/files/<id>/open"
 *   - a signed or unsigned R2 link (path-style: /<bucket>/<key>)
 *   - any other public link (returned as it is)
 */
export async function storageKeyFromStoredUrl(stored: string): Promise<string | null> {
  const value = stored.trim();
  if (!value) return null;

  const fileId = value.match(/^\/api\/files\/([A-Za-z0-9_-]+)\/(?:access|open)\b/)?.[1];
  if (fileId) {
    const asset = await prisma.fileAsset.findUnique({ where: { id: fileId }, select: { storageKey: true } });
    return asset?.storageKey ?? null;
  }

  if (!/^(https?:|\/|blob:|data:)/i.test(value)) return value; // already a key

  try {
    const url = new URL(value);
    if (!url.hostname.endsWith(".r2.cloudflarestorage.com")) return null;
    const path = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
    const bucket = process.env.R2_BUCKET_NAME || process.env.STORAGE_BUCKET_NAME || "atomic-pathshala";
    // Path-style R2 links carry the bucket first.
    return path.startsWith(`${bucket}/`) ? path.slice(bucket.length + 1) : path || null;
  } catch {
    return null;
  }
}

/** A link to the stored file that is valid now (for `expiresInSeconds`), or the stored value if it is not one of ours. */
export async function freshFileUrl(stored: string, opts: { expiresInSeconds?: number; contentDisposition?: string } = {}): Promise<string> {
  const key = await storageKeyFromStoredUrl(stored);
  if (!key) return stored;
  return createPresignedDownloadUrl({ key, expiresInSeconds: opts.expiresInSeconds ?? 3600, contentDisposition: opts.contentDisposition });
}
