import "server-only";

/**
 * Low-level YouTube Data API v3 client for the recording-archive pipeline —
 * OAuth2 token refresh, the resumable upload protocol (videos.insert), and
 * thumbnails.set. No orchestration/business logic here; see
 * ./archive-service.ts for the checkpointed chunk loop that calls these.
 */

const YOUTUBE_UPLOAD_ENDPOINT = "https://www.googleapis.com/upload/youtube/v3/videos";
const YOUTUBE_THUMBNAIL_ENDPOINT = "https://www.googleapis.com/upload/youtube/v3/thumbnails/set";

// YouTube requires resumable-upload chunk sizes to be a multiple of 256 KiB
// (except the final chunk). 16 MiB keeps each chunk comfortably inside one
// serverless invocation's time budget on typical bandwidth while staying an
// exact multiple (16 MiB / 256 KiB = 64).
export const YOUTUBE_UPLOAD_CHUNK_SIZE = 16 * 1024 * 1024;

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

// Module-scope cache: reused across chunk-upload calls within the SAME
// invocation only — a fresh serverless invocation gets a cold module and
// refreshes again, which is fine since a refresh-token exchange is cheap
// and this is never on a per-request hot path.
let cachedToken: CachedToken | null = null;

export class YoutubeNotConfiguredError extends Error {
  constructor() {
    super("YouTube OAuth credentials are not configured (YOUTUBE_CLIENT_ID / YOUTUBE_CLIENT_SECRET / YOUTUBE_REFRESH_TOKEN).");
    this.name = "YoutubeNotConfiguredError";
  }
}

export function youtubeArchiveConfigured(): boolean {
  return Boolean(process.env.YOUTUBE_CLIENT_ID && process.env.YOUTUBE_CLIENT_SECRET && process.env.YOUTUBE_REFRESH_TOKEN);
}

export async function getYoutubeAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.accessToken;
  }

  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;
  if (!clientId || !clientSecret || !refreshToken) throw new YoutubeNotConfiguredError();

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const json: { access_token?: string; expires_in?: number; error?: string; error_description?: string } = await res.json();

  if (!res.ok || !json.access_token) {
    throw new Error(`YouTube token refresh failed (${res.status}): ${json.error || "unknown"} ${json.error_description || ""}`.trim());
  }

  cachedToken = { accessToken: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return cachedToken.accessToken;
}

export interface InitiateUploadParams {
  title: string;
  description: string;
  tags: string[];
  categoryId: string;
  fileSizeBytes: number;
  mimeType: string;
}

/**
 * Step 1 of the resumable upload protocol — creates the upload session and
 * returns its session URI (the `Location` response header), which is what
 * every subsequent chunked PUT targets. privacyStatus is hardcoded
 * "unlisted" here (not accepted as a caller param) so this can never
 * accidentally publish a class recording publicly.
 */
export async function initiateResumableUpload(params: InitiateUploadParams): Promise<string> {
  const accessToken = await getYoutubeAccessToken();

  const res = await fetch(`${YOUTUBE_UPLOAD_ENDPOINT}?uploadType=resumable&part=snippet,status`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Upload-Content-Type": params.mimeType,
      "X-Upload-Content-Length": String(params.fileSizeBytes),
    },
    body: JSON.stringify({
      snippet: {
        title: params.title,
        description: params.description,
        tags: params.tags,
        categoryId: params.categoryId,
      },
      status: {
        privacyStatus: "unlisted",
        selfDeclaredMadeForKids: false,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to initiate YouTube resumable upload session (${res.status}): ${text}`);
  }

  const location = res.headers.get("Location") || res.headers.get("location");
  if (!location) throw new Error("YouTube did not return a resumable upload session URI (Location header missing).");
  return location;
}

export type ChunkUploadResult = { done: true; videoId: string } | { done: false; nextOffset: number };

/**
 * PUTs one chunk to an existing resumable-upload session URI. Returns the
 * new video id once YouTube reports the whole file received (200/201), or
 * the byte offset to resume from on a 308 partial-progress response — the
 * caller persists that offset so a later invocation can pick up exactly
 * there instead of re-uploading from zero.
 */
export async function uploadChunk(
  sessionUrl: string,
  chunk: Buffer,
  rangeStart: number,
  totalSize: number
): Promise<ChunkUploadResult> {
  const rangeEnd = rangeStart + chunk.length - 1;
  const res = await fetch(sessionUrl, {
    method: "PUT",
    headers: {
      "Content-Length": String(chunk.length),
      "Content-Range": `bytes ${rangeStart}-${rangeEnd}/${totalSize}`,
    },
    body: chunk,
  });

  if (res.status === 200 || res.status === 201) {
    const json: { id?: string } = await res.json();
    if (!json.id) throw new Error("YouTube reported the upload complete but returned no video id.");
    return { done: true, videoId: json.id };
  }

  if (res.status === 308) {
    // Google's own resumable-upload spec: a 308 carries a `Range` header
    // naming the bytes it has actually persisted so far (e.g.
    // "bytes=0-8388607") — trust that over assuming the whole chunk landed,
    // since a partial chunk write is exactly what this status means.
    const range = res.headers.get("Range");
    const nextOffset = range ? Number(range.split("-")[1]) + 1 : rangeEnd + 1;
    return { done: false, nextOffset };
  }

  const text = await res.text().catch(() => "");
  throw new Error(`YouTube chunk upload failed (${res.status}): ${text}`);
}

/**
 * A separate, independently-retryable call from videos.insert — a failure
 * here must never cause the already-uploaded video to be re-uploaded (the
 * caller tracks this on its own thumbnailStatus column, not the video's
 * upload status).
 */
export async function setThumbnail(videoId: string, imageBuffer: Buffer, contentType: string): Promise<void> {
  const accessToken = await getYoutubeAccessToken();
  const res = await fetch(`${YOUTUBE_THUMBNAIL_ENDPOINT}?videoId=${encodeURIComponent(videoId)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": contentType },
    body: imageBuffer,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`YouTube thumbnail upload failed (${res.status}): ${text}`);
  }
}

/** Transient/retryable Google API or network errors — matched against the
 * error message since these calls throw plain Errors rather than a typed
 * error hierarchy. */
export function isRetryableYoutubeError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /\((429|500|502|503|504)\)/.test(msg) || /timeout|ETIMEDOUT|ECONNRESET|fetch failed/i.test(msg);
}
