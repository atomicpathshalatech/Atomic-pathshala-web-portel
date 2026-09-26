import "server-only";
import { getYoutubeAccessToken, clearCachedYoutubeToken, youtubeArchiveConfigured, isRetryableYoutubeError } from "@/lib/youtube/upload-client";

/**
 * Schema-agnostic YouTube Live Streaming API (Data API v3) client — the pure
 * API-call layer shared by both the standalone Classroom module
 * (src/lib/classroom/youtube-broadcast.ts) and Whiteboard's "Application
 * Class + YouTube" simulcast (src/lib/live-class/youtube-broadcast.ts).
 * Neither caller's DB writes live here — this file only talks to Google.
 *
 * Deliberately independent from src/lib/live-class/youtube.ts, which is
 * Whiteboard's older manual videoId-mapping code (paste an externally
 * already-live YouTube URL) and never calls this API at all.
 */

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

export function youtubeLiveConfigured(): boolean {
  return youtubeArchiveConfigured();
}

async function youtubeApiFetch<T>(
  path: string,
  init: RequestInit & { query?: Record<string, string> } = {},
  retries = 2
): Promise<T> {
  const { query, ...rest } = init;
  const url = new URL(`${YOUTUBE_API_BASE}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const accessToken = await getYoutubeAccessToken(attempt > 0);
      const res = await fetch(url.toString(), {
        ...rest,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          ...(rest.headers ?? {}),
        },
      });

      if (res.status === 401 && attempt < retries) {
        clearCachedYoutubeToken();
        await new Promise((r) => setTimeout(r, 600));
        continue;
      }

      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`YouTube API ${path} failed (${res.status}): ${text}`);
      }
      if (res.status === 204) return undefined as T;
      return res.json() as Promise<T>;
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt >= retries || !isRetryableYoutubeError(err)) {
        throw lastError;
      }
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }

  throw lastError || new Error(`YouTube API ${path} failed after retries`);
}

export interface CreateLiveStreamResult {
  id: string;
  ingestUrl: string;
  streamKey: string;
}

/** liveStreams.insert — the RTMP ingest endpoint whatever pushes video (LiveKit Egress, a relay, or an external encoder) publishes into. */
export async function createLiveStream(title: string): Promise<CreateLiveStreamResult> {
  const json = await youtubeApiFetch<{
    id: string;
    cdn: { ingestionInfo: { ingestionAddress: string; streamName: string } };
  }>("/liveStreams", {
    method: "POST",
    query: { part: "snippet,cdn,status" },
    body: JSON.stringify({
      snippet: { title },
      cdn: { frameRate: "variable", ingestionType: "rtmp", resolution: "variable" },
    }),
  });

  return {
    id: json.id,
    ingestUrl: json.cdn.ingestionInfo.ingestionAddress,
    streamKey: json.cdn.ingestionInfo.streamName,
  };
}

export interface CreateLiveBroadcastResult {
  id: string;
  liveChatId: string | null;
}

/** liveBroadcasts.insert — strictly UNLISTED for batch privacy; Atomic Pathshala is the access-control layer. */
export async function createLiveBroadcast(
  title: string,
  scheduledStartTime: string,
  description?: string
): Promise<CreateLiveBroadcastResult> {
  const desc =
    description ||
    `Atomic Pathshala Live Interactive Lecture: ${title}\n\nJoin live for comprehensive concept explanation, doubt clearing, and problem solving sessions.\n\nWebsite: https://atomicpathshala.com`;

  const cleanTitle = (title || "Atomic Pathshala Live Lecture")
    .replace(/[<>{}]/g, "")
    .trim()
    .slice(0, 92);

  const nowMs = Date.now();
  const inputTimeMs = new Date(scheduledStartTime).getTime();
  const validStartTime = new Date(
    Math.max(nowMs + 15_000, isNaN(inputTimeMs) ? nowMs + 15_000 : inputTimeMs)
  ).toISOString();

  let json: { id: string; snippet: { liveChatId?: string } } | undefined;

  // Tier 1: Full broadcast config with DVR and auto-start (NO enableEmbed, which is invalid on standard channels)
  try {
    json = await youtubeApiFetch<{ id: string; snippet: { liveChatId?: string } }>("/liveBroadcasts", {
      method: "POST",
      query: { part: "snippet,status,contentDetails" },
      body: JSON.stringify({
        snippet: { title: cleanTitle, description: desc, scheduledStartTime: validStartTime },
        status: { privacyStatus: "unlisted", selfDeclaredMadeForKids: false },
        contentDetails: {
          enableAutoStart: true,
          enableAutoStop: true,
          enableDvr: true,
          recordFromStart: true,
          latencyPreference: "low",
        },
      }),
    });
  } catch (err1) {
    console.warn("[youtube_live_broadcast_fallback_tier1]", err1);
    // Tier 2: Without latency preference
    try {
      json = await youtubeApiFetch<{ id: string; snippet: { liveChatId?: string } }>("/liveBroadcasts", {
        method: "POST",
        query: { part: "snippet,status,contentDetails" },
        body: JSON.stringify({
          snippet: {
            title: cleanTitle,
            description: desc,
            scheduledStartTime: new Date(Date.now() + 30_000).toISOString(),
          },
          status: { privacyStatus: "unlisted", selfDeclaredMadeForKids: false },
          contentDetails: {
            enableAutoStart: true,
            enableAutoStop: true,
            enableDvr: true,
            recordFromStart: true,
          },
        }),
      });
    } catch (err2) {
      console.warn("[youtube_live_broadcast_fallback_tier2]", err2);
      // Tier 3: Minimal contentDetails
      try {
        json = await youtubeApiFetch<{ id: string; snippet: { liveChatId?: string } }>("/liveBroadcasts", {
          method: "POST",
          query: { part: "snippet,status,contentDetails" },
          body: JSON.stringify({
            snippet: {
              title: cleanTitle,
              description: desc,
              scheduledStartTime: new Date(Date.now() + 30_000).toISOString(),
            },
            status: { privacyStatus: "unlisted", selfDeclaredMadeForKids: false },
            contentDetails: {
              enableAutoStart: true,
              enableAutoStop: true,
            },
          }),
        });
      } catch (err3) {
        console.warn("[youtube_live_broadcast_fallback_tier3]", err3);
        // Tier 4: Basic broadcast without contentDetails
        json = await youtubeApiFetch<{ id: string; snippet: { liveChatId?: string } }>("/liveBroadcasts", {
          method: "POST",
          query: { part: "snippet,status" },
          body: JSON.stringify({
            snippet: {
              title: cleanTitle,
              description: desc,
              scheduledStartTime: new Date(Date.now() + 30_000).toISOString(),
            },
            status: { privacyStatus: "unlisted", selfDeclaredMadeForKids: false },
          }),
        });
      }
    }
  }

  if (!json?.id) {
    throw new Error("Failed to create YouTube Live Broadcast across all configuration tiers.");
  }

  // Attempt to mark video status unlisted & embeddable silently (does not fail broadcast if unpermitted)
  try {
    await youtubeApiFetch("/videos", {
      method: "PUT",
      query: { part: "status" },
      body: JSON.stringify({
        id: json.id,
        status: {
          privacyStatus: "unlisted",
          selfDeclaredMadeForKids: false,
        },
      }),
    });
  } catch (err) {
    console.warn("[youtube_video_status_update_warning]", err);
  }

  return { id: json.id, liveChatId: json.snippet?.liveChatId ?? null };
}

/**
 * Ensures an existing broadcast has embedding explicitly enabled and remains unlisted on YouTube
 */
export async function ensureBroadcastEmbeddable(broadcastId: string): Promise<void> {
  try {
    await youtubeApiFetch("/videos", {
      method: "PUT",
      query: { part: "status" },
      body: JSON.stringify({
        id: broadcastId,
        status: {
          embeddable: true,
          privacyStatus: "unlisted",
          selfDeclaredMadeForKids: false,
        },
      }),
    });
  } catch (err) {
    console.warn("[ensureBroadcastEmbeddable error]", err);
  }
}

export async function bindBroadcastToStream(broadcastId: string, streamId: string): Promise<void> {
  try {
    await youtubeApiFetch(`/liveBroadcasts/bind`, {
      method: "POST",
      query: { id: broadcastId, streamId, part: "id" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/alreadyBound|redundant/i.test(message)) return;
    // Retry once after brief pause if stream was freshly created
    await new Promise((r) => setTimeout(r, 1200));
    try {
      await youtubeApiFetch(`/liveBroadcasts/bind`, {
        method: "POST",
        query: { id: broadcastId, streamId, part: "id" },
      });
    } catch (retryErr) {
      const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
      if (/alreadyBound|redundant/i.test(retryMsg)) return;
      throw retryErr;
    }
  }
}

export async function transitionBroadcast(youtubeBroadcastId: string, status: "live" | "complete"): Promise<void> {
  try {
    await youtubeApiFetch(`/liveBroadcasts/transition`, {
      method: "POST",
      query: { broadcastStatus: status, id: youtubeBroadcastId, part: "status" },
    });
  } catch (err) {
    // The broadcast is created with enableAutoStart/enableAutoStop, so
    // YouTube itself transitions it the moment it detects (or loses) an
    // active incoming stream — often before our own explicit transition call
    // lands. YouTube rejects that as "redundant," which is not a failure
    // here: the broadcast is already in (or moving to) the requested state
    // either way (confirmed live against a real OBS stream during Classroom
    // testing), so this is safe to treat as success.
    const message = err instanceof Error ? err.message : String(err);
    if (/redundantTransition/i.test(message)) return;
    throw err;
  }
}

export interface RecordingStatusResult {
  recordingVideoId: string | null;
  recordingStatus: "PROCESSING" | "READY" | "FAILED" | "NOT_AVAILABLE";
}

/** videos.list — polled after transition(complete) to find out when the VOD is watchable. */
export async function fetchRecordingStatus(youtubeVideoId: string): Promise<RecordingStatusResult> {
  const json = await youtubeApiFetch<{
    items: Array<{ id: string; status?: { uploadStatus?: string }; processingDetails?: { processingStatus?: string } }>;
  }>("/videos", {
    method: "GET",
    query: { part: "status,processingDetails,recordingDetails", id: youtubeVideoId },
  });

  const item = json.items[0];
  if (!item) return { recordingVideoId: null, recordingStatus: "NOT_AVAILABLE" };

  const uploadStatus = item.status?.uploadStatus;
  if (uploadStatus === "failed" || uploadStatus === "rejected") {
    return { recordingVideoId: null, recordingStatus: "FAILED" };
  }
  if (uploadStatus === "processed") {
    return { recordingVideoId: item.id, recordingStatus: "READY" };
  }
  return { recordingVideoId: null, recordingStatus: "PROCESSING" };
}

// Cache the master stream in memory so we reuse the single channel stream key across all classes
let cachedMasterStream: CreateLiveStreamResult | null = null;

/**
 * Returns the channel's single persistent Master Live Stream.
 * Ensures the teacher only ever needs ONE stream key in OBS for all classes.
 */
export async function getOrCreateMasterLiveStream(): Promise<CreateLiveStreamResult> {
  if (cachedMasterStream) {
    return cachedMasterStream;
  }

  // 1. Check environment variable override
  if (process.env.YOUTUBE_STREAM_ID && process.env.YOUTUBE_STREAM_KEY) {
    cachedMasterStream = {
      id: process.env.YOUTUBE_STREAM_ID,
      ingestUrl: process.env.YOUTUBE_INGEST_URL || "rtmp://a.rtmp.youtube.com/live2",
      streamKey: process.env.YOUTUBE_STREAM_KEY,
    };
    return cachedMasterStream;
  }

  // 2. Check if a master stream already exists on the YouTube channel
  try {
    const listRes = await youtubeApiFetch<{
      items?: Array<{
        id: string;
        snippet?: { title?: string };
        cdn?: { ingestionInfo?: { ingestionAddress?: string; streamName?: string } };
        status?: { streamStatus?: string };
      }>;
    }>("/liveStreams", {
      method: "GET",
      query: { part: "snippet,cdn,status", mine: "true", maxResults: "10" },
    });

    if (listRes.items && listRes.items.length > 0) {
      const matching =
        listRes.items.find(
          (item) =>
            item.snippet?.title?.includes("Atomic Pathshala") &&
            item.cdn?.ingestionInfo?.streamName
        ) ||
        listRes.items.find((item) => item.cdn?.ingestionInfo?.streamName);

      if (matching && matching.cdn?.ingestionInfo?.streamName) {
        cachedMasterStream = {
          id: matching.id,
          ingestUrl: matching.cdn.ingestionInfo.ingestionAddress || "rtmp://a.rtmp.youtube.com/live2",
          streamKey: matching.cdn.ingestionInfo.streamName,
        };
        return cachedMasterStream;
      }
    }
  } catch (err) {
    console.warn("[getOrCreateMasterLiveStream list warning]", err);
  }

  // 3. Create a single permanent Master Live Stream on the channel if none exists
  const newStream = await createLiveStream("Atomic Pathshala Master Live Stream");
  cachedMasterStream = newStream;
  return cachedMasterStream;
}

export async function createAndBindBroadcast(title: string, scheduledStartTime: Date, description?: string) {
  const [stream, broadcast] = await Promise.all([
    getOrCreateMasterLiveStream(),
    createLiveBroadcast(title, scheduledStartTime.toISOString(), description),
  ]);
  await bindBroadcastToStream(broadcast.id, stream.id);
  return { stream, broadcast };
}

export interface YouTubeLiveChatMessage {
  id: string;
  authorName: string;
  authorPhotoUrl?: string | null;
  messageText: string;
  publishedAt: string;
}

export async function fetchLiveChatMessages(
  liveChatId: string,
  pageToken?: string
): Promise<{
  messages: YouTubeLiveChatMessage[];
  nextPageToken?: string;
  pollingIntervalMillis?: number;
}> {
  const json = await youtubeApiFetch<{
    items?: Array<{
      id: string;
      snippet: {
        displayMessage: string;
        publishedAt: string;
      };
      authorDetails: {
        displayName: string;
        profileImageUrl: string;
      };
    }>;
    nextPageToken?: string;
    pollingIntervalMillis?: number;
  }>("/liveChat/messages", {
    method: "GET",
    query: {
      liveChatId,
      part: "snippet,authorDetails",
      maxResults: "200",
      ...(pageToken ? { pageToken } : {}),
    },
  });

  return {
    messages: (json.items || []).map((item) => ({
      id: item.id,
      authorName: item.authorDetails?.displayName || "YouTube Viewer",
      authorPhotoUrl: item.authorDetails?.profileImageUrl || null,
      messageText: item.snippet?.displayMessage || "",
      publishedAt: item.snippet?.publishedAt || new Date().toISOString(),
    })),
    nextPageToken: json.nextPageToken,
    pollingIntervalMillis: json.pollingIntervalMillis || 4000,
  };
}

export async function getLiveChatIdForVideo(videoId: string): Promise<string | null> {
  try {
    const json = await youtubeApiFetch<{
      items?: Array<{ liveStreamingDetails?: { activeLiveChatId?: string } }>;
    }>("/videos", {
      method: "GET",
      query: { part: "liveStreamingDetails", id: videoId },
    });
    return json.items?.[0]?.liveStreamingDetails?.activeLiveChatId ?? null;
  } catch {
    return null;
  }
}

