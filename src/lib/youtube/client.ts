import "server-only";
import {
  YoutubeApiError,
  backoffDelayMs,
  classifyYoutubeResponse,
  extractYoutubeErrorReason,
} from "@/lib/youtube/errors";
import {
  type YoutubeChannelKey,
  ensureYoutubeChannelIdentity,
  getYoutubeChannelAccessToken,
} from "@/lib/youtube/channels";

import { recordYoutubeCall } from "@/lib/youtube/usage";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

export interface YoutubeApiRequest {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  query?: Record<string, string>;
  body?: unknown;
  /** Short label for logs/errors, e.g. "liveBroadcasts.insert". Defaults to the path. */
  operation?: string;
  /** Max retries for transient failures (rate limit, 5xx, network). Default 2. */
  maxRetries?: number;
  timeoutMs?: number;
  /** Test seam — defaults to setTimeout. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/**
 * The one way Atomic talks to the YouTube Data API.
 *
 * - Every call names its channel; APP and MAIN never share a token.
 * - MAIN is read-only: Atomic maps existing MAIN videos but never creates,
 *   binds, transitions or edits anything there.
 * - The channel's identity is verified before use (see channels.ts).
 * - Retry policy by error kind, not by message regex:
 *     AUTH_EXPIRED            → refresh the access token once, retry once
 *     RATE_LIMIT/BACKEND/NETWORK → exponential backoff with jitter
 *     everything else (QUOTA, PERMISSION, INVALID_*, …) → throw immediately
 */
export async function youtubeApi<T>(channel: YoutubeChannelKey, path: string, req: YoutubeApiRequest = {}): Promise<T> {
  const method = req.method ?? "GET";
  const operation = req.operation ?? path.replace(/^\//, "");
  const maxRetries = req.maxRetries ?? 2;
  const sleep = req.sleep ?? defaultSleep;

  if (channel === "MAIN" && method !== "GET") {
    throw new YoutubeApiError({
      kind: "CONFIG",
      status: null,
      reason: "mainChannelReadOnly",
      operation,
      detail: "The MAIN channel is read-only for Atomic; broadcasts are only created on the APP channel.",
    });
  }

  await ensureYoutubeChannelIdentity(channel);

  const url = new URL(`${YOUTUBE_API_BASE}${path}`);
  for (const [k, v] of Object.entries(req.query ?? {})) url.searchParams.set(k, v);

  let refreshedAuth = false;
  let transientAttempt = 0;

  for (;;) {
    const accessToken = await getYoutubeChannelAccessToken(channel, refreshedAuth);

    let res: Response;
    try {
      res = await fetch(url.toString(), {
        method,
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: req.body === undefined ? undefined : JSON.stringify(req.body),
        signal: AbortSignal.timeout(req.timeoutMs ?? 20_000),
      });
    } catch (err) {
      const networkErr = new YoutubeApiError({
        kind: "NETWORK",
        status: null,
        reason: null,
        operation,
        detail: err instanceof Error ? err.message : String(err),
      });
      if (transientAttempt >= maxRetries) throw networkErr;
      await sleep(backoffDelayMs(transientAttempt++));
      continue;
    }

    if (res.ok) {
      // Every request that reached YouTube is counted against the daily quota.
      recordYoutubeCall({ channel, operation, method, path, ok: true, status: res.status });
      if (res.status === 204) return undefined as T;
      const text = await res.text();
      return (text ? JSON.parse(text) : undefined) as T;
    }

    const text = await res.text().catch(() => "");
    const reason = extractYoutubeErrorReason(text);
    const error = new YoutubeApiError({
      kind: classifyYoutubeResponse(res.status, reason),
      status: res.status,
      reason,
      operation,
      detail: text,
    });
    recordYoutubeCall({ channel, operation, method, path, ok: false, status: res.status, kind: error.kind, reason });

    if (error.kind === "AUTH_EXPIRED" && !refreshedAuth) {
      refreshedAuth = true;
      continue;
    }
    if ((error.kind === "RATE_LIMIT" || error.kind === "BACKEND") && transientAttempt < maxRetries) {
      await sleep(backoffDelayMs(transientAttempt++));
      continue;
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Read helpers usable on either channel (MAIN mapping relies on these)
// ---------------------------------------------------------------------------

export interface YoutubeVideoInfo {
  videoId: string;
  channelId: string | null;
  title: string | null;
  /** "live" | "upcoming" | "none" */
  liveBroadcastContent: string | null;
  privacyStatus: string | null;
  uploadStatus: string | null;
  embeddable: boolean | null;
  actualStartTime: string | null;
  actualEndTime: string | null;
}

/** videos.list for one id (1 unit). Returns null when the video doesn't exist or isn't visible to this channel's token. */
export async function getYoutubeVideoInfo(channel: YoutubeChannelKey, videoId: string): Promise<YoutubeVideoInfo | null> {
  const json = await youtubeApi<{ items?: any[] }>(channel, "/videos", {
    operation: "videos.list",
    query: { part: "snippet,status,liveStreamingDetails", id: videoId },
  });
  const item = json?.items?.[0];
  if (!item) return null;
  return {
    videoId: item.id,
    channelId: item.snippet?.channelId ?? null,
    title: item.snippet?.title ?? null,
    liveBroadcastContent: item.snippet?.liveBroadcastContent ?? null,
    privacyStatus: item.status?.privacyStatus ?? null,
    uploadStatus: item.status?.uploadStatus ?? null,
    embeddable: typeof item.status?.embeddable === "boolean" ? item.status.embeddable : null,
    actualStartTime: item.liveStreamingDetails?.actualStartTime ?? null,
    actualEndTime: item.liveStreamingDetails?.actualEndTime ?? null,
  };
}

/**
 * For MAIN_YOUTUBE mapping: the video must exist and belong to the channel
 * whose token looked it up. Throws YoutubeApiError(CONFIG/NOT_FOUND) when it
 * doesn't, so a video from another channel can never be mapped as MAIN.
 */
export async function assertVideoBelongsToChannel(channel: YoutubeChannelKey, videoId: string): Promise<YoutubeVideoInfo> {
  const info = await getYoutubeVideoInfo(channel, videoId);
  if (!info) {
    throw new YoutubeApiError({ kind: "NOT_FOUND", status: 404, reason: "videoNotFound", operation: "videos.list", detail: `Video ${videoId} was not found.` });
  }
  const { getYoutubeChannelConfig } = await import("@/lib/youtube/channels");
  const expected = getYoutubeChannelConfig(channel).expectedChannelId;
  if (!expected || info.channelId !== expected) {
    throw new YoutubeApiError({
      kind: "CONFIG",
      status: null,
      reason: "videoChannelMismatch",
      operation: "videos.list",
      detail: expected
        ? `Video ${videoId} belongs to channel ${info.channelId}, not the ${channel} channel.`
        : `Cannot verify ownership: the ${channel} channel id is not configured.`,
    });
  }
  return info;
}
