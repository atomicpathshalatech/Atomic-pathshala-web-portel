import "server-only";
import { getYoutubeAccessToken, youtubeArchiveConfigured } from "@/lib/youtube/upload-client";

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

async function youtubeApiFetch<T>(path: string, init: RequestInit & { query?: Record<string, string> } = {}): Promise<T> {
  const accessToken = await getYoutubeAccessToken();
  const { query, ...rest } = init;
  const url = new URL(`${YOUTUBE_API_BASE}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) url.searchParams.set(key, value);

  const res = await fetch(url.toString(), {
    ...rest,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(rest.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`YouTube API ${path} failed (${res.status}): ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
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

/** liveBroadcasts.insert — always unlisted; Atomic Pathshala, not YouTube, is the access-control layer. */
export async function createLiveBroadcast(title: string, scheduledStartTime: string): Promise<CreateLiveBroadcastResult> {
  const json = await youtubeApiFetch<{ id: string; snippet: { liveChatId?: string } }>("/liveBroadcasts", {
    method: "POST",
    query: { part: "snippet,status,contentDetails" },
    body: JSON.stringify({
      snippet: { title, scheduledStartTime },
      status: { privacyStatus: "unlisted", selfDeclaredMadeForKids: false },
      contentDetails: {
        enableAutoStart: true,
        enableAutoStop: true,
        enableDvr: true,
        latencyPreference: "ultraLow",
      },
    }),
  });

  // Explicitly ensure the created broadcast's video status has embeddable: true
  // so external websites/webviews can embed the video without "playback disabled by video owner"
  try {
    await youtubeApiFetch("/videos", {
      method: "PUT",
      query: { part: "status" },
      body: JSON.stringify({
        id: json.id,
        status: {
          embeddable: true,
          privacyStatus: "unlisted",
          selfDeclaredMadeForKids: false,
        },
      }),
    });
  } catch (err) {
    console.warn("[youtube_video_embeddable_update_warning]", err);
  }

  return { id: json.id, liveChatId: json.snippet.liveChatId ?? null };
}

export async function bindBroadcastToStream(broadcastId: string, streamId: string): Promise<void> {
  await youtubeApiFetch(`/liveBroadcasts/bind`, {
    method: "POST",
    query: { id: broadcastId, streamId, part: "id" },
  });
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

export async function createAndBindBroadcast(title: string, scheduledStartTime: Date) {
  const [stream, broadcast] = await Promise.all([
    createLiveStream(title),
    createLiveBroadcast(title, scheduledStartTime.toISOString()),
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

