import "server-only";
import { prisma } from "@/lib/db";
import { createPresignedDownloadUrl } from "@/lib/storage/r2-client";

/**
 * Resolves a direct presigned download URL for an original uploaded
 * presentation/document file, from whatever format WhiteboardSession.
 * presentationUrl happens to be stored as (a raw R2 key, a "/api/files/
 * <id>/access" FileAsset reference, an absolute R2 URL, or - for older
 * sessions predating the current upload pipeline - a stale, tab-scoped
 * "blob:" object URL that was never actually persisted to storage).
 *
 * Previously duplicated near-identically in both
 * src/app/api/schedule/[scheduleId]/assets/route.ts and this route's own
 * file, and the two had drifted: only one of them explicitly rejected a
 * "blob:" input instead of returning it as-is, which produced a dead link
 * the browser can't resolve (a visible download error) on the other
 * route. Single shared implementation so both callers behave identically.
 */
export async function resolveOriginalDownloadUrl(
  urlOrKey: string,
  fallbackFilename: string
): Promise<string> {
  // Case 1: Pure R2 storage key (e.g. "modules/live-classes/...")
  if (
    !urlOrKey.startsWith("http://") &&
    !urlOrKey.startsWith("https://") &&
    !urlOrKey.startsWith("/api/") &&
    !urlOrKey.startsWith("blob:")
  ) {
    return createPresignedDownloadUrl({
      key: urlOrKey,
      expiresInSeconds: 900,
      contentDisposition: `attachment; filename="${encodeURIComponent(fallbackFilename)}"`,
    });
  }

  // Case 2: FileAsset access URL (e.g. "/api/files/<id>/access")
  const fileIdMatch = urlOrKey.match(/\/api\/files\/([a-zA-Z0-9_-]+)\/access/);
  if (fileIdMatch && fileIdMatch[1]) {
    const fileAsset = await prisma.fileAsset.findUnique({
      where: { id: fileIdMatch[1] },
    });
    if (fileAsset?.storageKey) {
      return createPresignedDownloadUrl({
        key: fileAsset.storageKey,
        expiresInSeconds: 900,
        contentDisposition: `attachment; filename="${encodeURIComponent(
          fallbackFilename || fileAsset.originalFilename
        )}"`,
      });
    }
  }

  // Case 3: Absolute R2 URL with pathname
  try {
    const parsed = new URL(urlOrKey);
    const pathnameKey = parsed.pathname.replace(/^\/+/, "");
    if (pathnameKey && (pathnameKey.startsWith("modules/") || pathnameKey.startsWith("documents/") || pathnameKey.startsWith("classes/"))) {
      return createPresignedDownloadUrl({
        key: pathnameKey,
        expiresInSeconds: 900,
        contentDisposition: `attachment; filename="${encodeURIComponent(fallbackFilename)}"`,
      });
    }
  } catch {
    // ignore URL parse errors for relative paths
  }

  // If the stored URL is a local blob, throw a user-friendly error instead
  // of silently returning a dead tab-scoped link.
  if (urlOrKey.startsWith("blob:")) {
    throw new Error("The presentation material was not saved to permanent cloud storage. Please upload the document again in Material Setup.");
  }

  // Fallback: return as-is
  return urlOrKey;
}
