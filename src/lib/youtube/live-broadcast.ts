import "server-only";
import { youtubeApi } from "@/lib/youtube/client";
import { youtubeChannelConfigured, type YoutubeChannelKey } from "@/lib/youtube/channels";
import { classifyYoutubeError, isTerminalYoutubeError } from "@/lib/youtube/errors";

/**
 * Schema-agnostic YouTube Live Streaming API (Data API v3) client — the pure
 * API-call layer behind the live-class YouTube broadcast
 * (src/lib/live-class/youtube-broadcast.ts, src/lib/live-session/*).
 * No DB writes live here — this file only talks to Google.
 *
 * Every resource-creating/changing call here runs on the APP channel only:
 * the MAIN channel is read-only for Atomic (see src/lib/youtube/client.ts).
 * Read helpers take an optional channel so MAIN-mapped videos are read with
 * MAIN's own credentials.
 *
 * Deliberately independent from src/lib/live-class/youtube.ts, which is
 * Whiteboard's older manual videoId-mapping code (paste an externally
 * already-live YouTube URL) and never calls this API at all.
 */

const LIVE_CHANNEL: YoutubeChannelKey = "APP";

export function youtubeLiveConfigured(): boolean {
  return youtubeChannelConfigured(LIVE_CHANNEL);
}

/**
 * Errors that no variation of the same request can fix — retrying them only
 * burns more quota (every liveBroadcasts.insert costs ~50 units even when it
 * fails validation) or hammers an account that lacks permission.
 */
export function isNonRetryableYoutubeError(err: unknown): boolean {
  return isTerminalYoutubeError(err);
}

/** Only a validation rejection (400) of one config variant is worth trying a simpler variant for. */
function shouldTryNextVariant(err: unknown): boolean {
  return classifyYoutubeError(err) === "INVALID_REQUEST";
}

export interface CreateLiveStreamResult {
  id: string;
  ingestUrl: string;
  streamKey: string;
}

/** liveStreams.insert — the RTMP ingest endpoint whatever pushes video (LiveKit Egress, a relay, or an external encoder) publishes into. */
export async function createLiveStream(title: string): Promise<CreateLiveStreamResult> {
  const json = await youtubeApi<{
    id: string;
    cdn: { ingestionInfo: { ingestionAddress: string; streamName: string } };
  }>(LIVE_CHANNEL, "/liveStreams", {
    method: "POST",
    operation: "liveStreams.insert",
    query: { part: "snippet,cdn,status" },
    body: {
      snippet: { title },
      cdn: { frameRate: "variable", ingestionType: "rtmp", resolution: "variable" },
    },
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

/**
 * liveStreams.insert for the per-class ingest pool: a REUSABLE stream (one
 * key that can serve many broadcasts over time, one at a time). Prefers the
 * RTMPS ingest address.
 */
export async function createPoolIngestStream(title: string): Promise<CreateLiveStreamResult> {
  const json = await youtubeApi<{
    id: string;
    cdn: { ingestionInfo: { ingestionAddress: string; rtmpsIngestionAddress?: string; streamName: string } };
  }>(LIVE_CHANNEL, "/liveStreams", {
    method: "POST",
    operation: "liveStreams.insert",
    query: { part: "snippet,cdn,contentDetails,status" },
    body: {
      snippet: { title },
      cdn: { frameRate: "variable", ingestionType: "rtmp", resolution: "variable" },
      contentDetails: { isReusable: true },
    },
  });
  return {
    id: json.id,
    ingestUrl: json.cdn.ingestionInfo.rtmpsIngestionAddress || json.cdn.ingestionInfo.ingestionAddress,
    streamKey: json.cdn.ingestionInfo.streamName,
  };
}

export async function deleteIngestStream(streamId: string): Promise<void> {
  await youtubeApi(LIVE_CHANNEL, "/liveStreams", { method: "DELETE", operation: "liveStreams.delete", query: { id: streamId } });
}

export interface StreamHealth {
  /** created | ready | active | inactive | error */
  streamStatus: string | null;
  /** good | ok | bad | noData */
  healthStatus: string | null;
}

/** liveStreams.list status for one stream (1 quota unit). */
export async function getIngestStreamHealth(streamId: string): Promise<StreamHealth | null> {
  const json = await youtubeApi<{ items?: Array<{ status?: { streamStatus?: string; healthStatus?: { status?: string } } }> }>(
    LIVE_CHANNEL,
    "/liveStreams",
    { operation: "liveStreams.list", query: { part: "status", id: streamId } }
  );
  const item = json.items?.[0];
  if (!item) return null;
  return { streamStatus: item.status?.streamStatus ?? null, healthStatus: item.status?.healthStatus?.status ?? null };
}

/** liveBroadcasts.list status for one broadcast (1 quota unit). lifeCycleStatus: created | ready | testing | liveStarting | live | complete | revoked … */
export async function getBroadcastLifecycle(broadcastId: string): Promise<string | null> {
  const json = await youtubeApi<{ items?: Array<{ status?: { lifeCycleStatus?: string } }> }>(LIVE_CHANNEL, "/liveBroadcasts", {
    operation: "liveBroadcasts.list",
    query: { part: "status", id: broadcastId },
  });
  return json.items?.[0]?.status?.lifeCycleStatus ?? null;
}

/** liveBroadcasts.insert — strictly UNLISTED for batch privacy; Atomic Pathshala is the access-control layer. */
export async function createLiveBroadcast(
  title: string,
  scheduledStartTime: string,
  description?: string,
  opts: { enableAutoStop?: boolean } = {}
): Promise<CreateLiveBroadcastResult> {
  // Auto-stop ends the broadcast for good the moment the encoder drops — a
  // teacher's brief network blip would end the class on YouTube. Per-class
  // broadcasts on the stream pool pass false and are completed explicitly.
  const enableAutoStop = opts.enableAutoStop ?? true;
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
  const soon = () => new Date(Date.now() + 30_000).toISOString();

  // Config variants, richest first. A variant is only abandoned for the next
  // one when YouTube rejects it as invalid (400) — never for quota,
  // permission, auth or transient errors, which a simpler body can't fix.
  // (NO enableEmbed: it is rejected on standard channels.)
  const variants: Array<{ part: string; body: Record<string, unknown> }> = [
    {
      part: "snippet,status,contentDetails",
      body: {
        snippet: { title: cleanTitle, description: desc, scheduledStartTime: validStartTime },
        status: { privacyStatus: "unlisted", selfDeclaredMadeForKids: false },
        contentDetails: { enableAutoStart: true, enableAutoStop, enableDvr: true, recordFromStart: true, latencyPreference: "low" },
      },
    },
    {
      part: "snippet,status,contentDetails",
      body: {
        snippet: { title: cleanTitle, description: desc, scheduledStartTime: soon() },
        status: { privacyStatus: "unlisted", selfDeclaredMadeForKids: false },
        contentDetails: { enableAutoStart: true, enableAutoStop, enableDvr: true, recordFromStart: true },
      },
    },
    {
      part: "snippet,status,contentDetails",
      body: {
        snippet: { title: cleanTitle, description: desc, scheduledStartTime: soon() },
        status: { privacyStatus: "unlisted", selfDeclaredMadeForKids: false },
        contentDetails: { enableAutoStart: true, enableAutoStop },
      },
    },
    {
      part: "snippet,status",
      body: {
        snippet: { title: cleanTitle, description: desc, scheduledStartTime: soon() },
        status: { privacyStatus: "unlisted", selfDeclaredMadeForKids: false },
      },
    },
  ];

  let json: { id: string; snippet?: { liveChatId?: string } } | undefined;
  for (let i = 0; i < variants.length; i++) {
    const variant = variants[i]!;
    try {
      json = await youtubeApi(LIVE_CHANNEL, "/liveBroadcasts", {
        method: "POST",
        operation: "liveBroadcasts.insert",
        query: { part: variant.part },
        body: variant.body,
      });
      break;
    } catch (err) {
      if (i === variants.length - 1 || !shouldTryNextVariant(err)) throw err;
      console.warn(`[youtube_live_broadcast_fallback_tier${i + 1}]`, err);
    }
  }

  if (!json?.id) {
    throw new Error("Failed to create YouTube Live Broadcast across all configuration tiers.");
  }

  // Explicitly mark video status unlisted & embeddable on YouTube. Best
  // effort: the broadcast already exists and is unlisted either way.
  try {
    await youtubeApi(LIVE_CHANNEL, "/videos", {
      method: "PUT",
      operation: "videos.update",
      query: { part: "status,snippet" },
      body: {
        id: json.id,
        snippet: { title: cleanTitle, categoryId: "27", description: desc }, // 27 = Education
        status: { privacyStatus: "unlisted", embeddable: true, selfDeclaredMadeForKids: false },
      },
    });
  } catch (err) {
    console.warn("[youtube_video_status_update_warning]", err);
    // Fallback: status-only, but only if the snippet was what got rejected.
    if (shouldTryNextVariant(err)) {
      try {
        await youtubeApi(LIVE_CHANNEL, "/videos", {
          method: "PUT",
          operation: "videos.update",
          query: { part: "status" },
          body: { id: json.id, status: { privacyStatus: "unlisted", embeddable: true, selfDeclaredMadeForKids: false } },
        });
      } catch (fallbackErr) {
        console.warn("[youtube_video_status_fallback_warning]", fallbackErr);
      }
    }
  }

  return { id: json.id, liveChatId: json.snippet?.liveChatId ?? null };
}

export async function updateLiveBroadcast(
  broadcastId: string,
  updates: { title?: string; scheduledStartTime?: string; description?: string }
): Promise<void> {
  try {
    const snippet: Record<string, string> = {};
    if (updates.title) snippet.title = updates.title.replace(/[<>{}]/g, "").trim().slice(0, 92);
    if (updates.scheduledStartTime) snippet.scheduledStartTime = updates.scheduledStartTime;
    if (updates.description) snippet.description = updates.description;
    await youtubeApi(LIVE_CHANNEL, "/liveBroadcasts", {
      method: "PUT",
      operation: "liveBroadcasts.update",
      query: { part: "snippet" },
      body: { id: broadcastId, snippet },
    });
  } catch (err) {
    console.warn("[updateLiveBroadcast warning]", err);
  }
}

export async function deleteLiveBroadcast(broadcastId: string): Promise<void> {
  try {
    await youtubeApi(LIVE_CHANNEL, "/liveBroadcasts", {
      method: "DELETE",
      operation: "liveBroadcasts.delete",
      query: { id: broadcastId },
    });
  } catch (err) {
    console.warn("[deleteLiveBroadcast warning]", err);
  }
}

/**
 * Turns embedding on for an existing broadcast (keeps it unlisted). Costs ~50
 * quota units (videos.update) — call it only when a videos.list check showed
 * embedding is off, never from a per-poll path. Throws YouTube's error so the
 * caller can log/surface the real reason.
 */
export async function ensureBroadcastEmbeddable(broadcastId: string): Promise<void> {
  await youtubeApi(LIVE_CHANNEL, "/videos", {
    method: "PUT",
    operation: "videos.update",
    query: { part: "status" },
    body: { id: broadcastId, status: { embeddable: true, privacyStatus: "unlisted", selfDeclaredMadeForKids: false } },
  });
}

export async function bindBroadcastToStream(broadcastId: string, streamId: string): Promise<void> {
  const bind = () =>
    youtubeApi(LIVE_CHANNEL, "/liveBroadcasts/bind", {
      method: "POST",
      operation: "liveBroadcasts.bind",
      query: { id: broadcastId, streamId, part: "id" },
    });
  const isAlreadyBound = (err: unknown) => /alreadyBound|redundant/i.test(err instanceof Error ? err.message : String(err));

  try {
    await bind();
  } catch (err) {
    if (isAlreadyBound(err)) return;
    // A freshly created stream is occasionally not bindable for a moment —
    // retry once, but only for that case (an invalid request), never for
    // quota/permission errors.
    if (!shouldTryNextVariant(err)) throw err;
    await new Promise((r) => setTimeout(r, 1200));
    try {
      await bind();
    } catch (retryErr) {
      if (isAlreadyBound(retryErr)) return;
      throw retryErr;
    }
  }
}

export async function transitionBroadcast(youtubeBroadcastId: string, status: "live" | "complete"): Promise<void> {
  try {
    await youtubeApi(LIVE_CHANNEL, "/liveBroadcasts/transition", {
      method: "POST",
      operation: "liveBroadcasts.transition",
      query: { broadcastStatus: status, id: youtubeBroadcastId, part: "status" },
    });
  } catch (err) {
    // The broadcast is created with enableAutoStart/enableAutoStop, so
    // YouTube itself transitions it the moment it detects (or loses) an
    // active incoming stream — often before our own explicit transition call
    // lands. YouTube rejects that as "redundant," which is not a failure
    // here: the broadcast is already in (or moving to) the requested state.
    if (classifyYoutubeError(err) === "REDUNDANT_TRANSITION") return;
    throw err;
  }
}

export interface RecordingStatusResult {
  recordingVideoId: string | null;
  recordingStatus: "PROCESSING" | "READY" | "FAILED" | "NOT_AVAILABLE";
}

/** videos.list — polled after transition(complete) to find out when the VOD is watchable. */
export async function fetchRecordingStatus(
  youtubeVideoId: string,
  channel: YoutubeChannelKey = LIVE_CHANNEL
): Promise<RecordingStatusResult> {
  const json = await youtubeApi<{
    items: Array<{ id: string; status?: { uploadStatus?: string }; processingDetails?: { processingStatus?: string } }>;
  }>(channel, "/videos", {
    operation: "videos.list",
    query: { part: "status,processingDetails,recordingDetails", id: youtubeVideoId },
  });

  const item = json.items?.[0];
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

// Cache the master stream in memory so we reuse the single channel stream key across all classes.
// TODO(live-class step 4): replaced by the per-class ingest stream pool.
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
    const listRes = await youtubeApi<{
      items?: Array<{
        id: string;
        snippet?: { title?: string };
        cdn?: { ingestionInfo?: { ingestionAddress?: string; streamName?: string } };
        status?: { streamStatus?: string };
      }>;
    }>(LIVE_CHANNEL, "/liveStreams", {
      operation: "liveStreams.list",
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
    // Quota/permission/config problems will fail the insert below too —
    // surface them now instead of spending another 50 units finding out.
    if (isTerminalYoutubeError(err)) throw err;
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
  pageToken?: string,
  channel: YoutubeChannelKey = LIVE_CHANNEL
): Promise<{
  messages: YouTubeLiveChatMessage[];
  nextPageToken?: string;
  pollingIntervalMillis?: number;
}> {
  const json = await youtubeApi<{
    items?: Array<{
      id: string;
      snippet: { displayMessage: string; publishedAt: string };
      authorDetails: { displayName: string; profileImageUrl: string };
    }>;
    nextPageToken?: string;
    pollingIntervalMillis?: number;
  }>(channel, "/liveChat/messages", {
    operation: "liveChatMessages.list",
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

export async function getLiveChatIdForVideo(
  videoId: string,
  channel: YoutubeChannelKey = LIVE_CHANNEL
): Promise<string | null> {
  try {
    const json = await youtubeApi<{
      items?: Array<{ liveStreamingDetails?: { activeLiveChatId?: string } }>;
    }>(channel, "/videos", {
      operation: "videos.list",
      query: { part: "liveStreamingDetails", id: videoId },
    });
    return json.items?.[0]?.liveStreamingDetails?.activeLiveChatId ?? null;
  } catch {
    return null;
  }
}
