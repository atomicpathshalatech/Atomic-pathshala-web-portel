import "server-only";
import {
  type YoutubeChannelKey,
  clearCachedYoutubeToken,
  ensureYoutubeChannelIdentity,
  getYoutubeChannelAccessToken,
  youtubeChannelConfigured,
} from "@/lib/youtube/channels";
import { isTransientYoutubeError } from "@/lib/youtube/errors";

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

// Recordings are archived to the APP channel only — never MAIN. Token
// caching, per-channel credentials and channel-identity verification live in
// ./channels.ts.
const ARCHIVE_CHANNEL: YoutubeChannelKey = "APP";

export { clearCachedYoutubeToken };

export function youtubeArchiveConfigured(): boolean {
  return youtubeChannelConfigured(ARCHIVE_CHANNEL);
}

export async function getYoutubeAccessToken(forceFresh = false): Promise<string> {
  await ensureYoutubeChannelIdentity(ARCHIVE_CHANNEL);
  return getYoutubeChannelAccessToken(ARCHIVE_CHANNEL, forceFresh);
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

/** Transient/retryable Google API or network errors (rate limit, 5xx,
 * network) — quota, permission and auth-revoked errors are never retryable. */
export function isRetryableYoutubeError(err: unknown): boolean {
  return isTransientYoutubeError(err);
}
