import "server-only";
import { prisma } from "@/lib/db";
import { getYoutubeAccessToken, youtubeArchiveConfigured } from "@/lib/youtube/upload-client";

/**
 * YouTube Live Streaming API (Data API v3) client for the Classroom module —
 * creates/binds/transitions a real YouTube Live broadcast per classroom
 * session. Deliberately independent from src/lib/live-class/youtube.ts,
 * which is Whiteboard's manual videoId-mapping code and never calls this
 * API. Reuses only the generic OAuth2 refresh-token plumbing from
 * src/lib/youtube/upload-client.ts (no coupling to the archive/upload
 * domain logic).
 *
 * Who actually pushes RTMP into the stream created here (our self-hosted
 * relay for BROWSER_RELAY sessions, or the teacher's own OBS/phone app for
 * EXTERNAL_ENCODER sessions) is decided by ClassroomSession.streamMethod —
 * this module only talks to YouTube.
 */

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

export function youtubeClassroomConfigured(): boolean {
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

interface CreateLiveStreamResult {
  id: string;
  ingestUrl: string;
  streamKey: string;
}

/** liveStreams.insert — the RTMP ingest endpoint that either our relay or the teacher's own encoder pushes video into. */
async function createLiveStream(title: string): Promise<CreateLiveStreamResult> {
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

interface CreateLiveBroadcastResult {
  id: string;
  liveChatId: string | null;
}

/** liveBroadcasts.insert — always unlisted; Atomic Pathshala, not YouTube, is the access-control layer. */
async function createLiveBroadcast(title: string, scheduledStartTime: string): Promise<CreateLiveBroadcastResult> {
  const json = await youtubeApiFetch<{ id: string; snippet: { liveChatId?: string } }>("/liveBroadcasts", {
    method: "POST",
    query: { part: "snippet,status,contentDetails" },
    body: JSON.stringify({
      snippet: { title, scheduledStartTime },
      status: { privacyStatus: "unlisted", selfDeclaredMadeForKids: false },
      contentDetails: { enableAutoStart: true, enableAutoStop: true, enableDvr: true },
    }),
  });

  return { id: json.id, liveChatId: json.snippet.liveChatId ?? null };
}

async function bindBroadcastToStream(broadcastId: string, streamId: string): Promise<void> {
  await youtubeApiFetch(`/liveBroadcasts/bind`, {
    method: "POST",
    query: { id: broadcastId, streamId, part: "id" },
  });
}

export async function transitionBroadcast(youtubeBroadcastId: string, status: "live" | "complete"): Promise<void> {
  await youtubeApiFetch(`/liveBroadcasts/transition`, {
    method: "POST",
    query: { broadcastStatus: status, id: youtubeBroadcastId, part: "status" },
  });
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

/**
 * Idempotent create-or-reuse: never creates a second YouTube broadcast for
 * the same scheduled lecture. Callers (the .../start route) pass the
 * ClassroomSession row they already fetched/created for this batchSchedule.
 */
export async function ensureYoutubeBroadcast(classroomSessionId: string, title: string, scheduledStartTime: Date) {
  const existing = await prisma.classroomSession.findUniqueOrThrow({ where: { id: classroomSessionId } });
  if (existing.youtubeBroadcastId && existing.youtubeStreamId) return existing;

  const [stream, broadcast] = await Promise.all([
    createLiveStream(title),
    createLiveBroadcast(title, scheduledStartTime.toISOString()),
  ]);
  await bindBroadcastToStream(broadcast.id, stream.id);

  return prisma.classroomSession.update({
    where: { id: classroomSessionId },
    data: {
      youtubeBroadcastId: broadcast.id,
      youtubeStreamId: stream.id,
      youtubeVideoId: broadcast.id, // the broadcast id IS the watch/embed video id
      youtubeLiveChatId: broadcast.liveChatId,
      youtubeIngestUrl: stream.ingestUrl,
      youtubeStreamKey: stream.streamKey,
      youtubeStatus: "created",
    },
  });
}
