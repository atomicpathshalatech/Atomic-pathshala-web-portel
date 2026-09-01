import { prisma } from "@/lib/db";
import { LiveClassPhase, VideoTransport } from "@prisma/client";

/**
 * Extracts an 11-character YouTube video or live ID from various URL formats or raw ID.
 */
export function extractYouTubeVideoId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // Handle standard URLs: watch?v=, youtu.be/, embed/, live/
  const match = trimmed.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|live\/|v\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
  );

  return match ? match[1] ?? null : null;
}

export function isValidYouTubeVideoId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(id);
}

export function buildYouTubeEmbedUrl(
  videoId: string,
  options?: { autoplay?: boolean; mute?: boolean }
): string {
  const params = new URLSearchParams({
    modestbranding: "1",
    rel: "0",
    playsinline: "1",
    enablejsapi: "1",
  });

  if (options?.autoplay) params.set("autoplay", "1");
  if (options?.mute) params.set("mute", "1");

  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}

export type ConfigureYouTubeSessionInput = {
  batchScheduleId: string;
  videoTransport?: VideoTransport;
  youtubeVideoId?: string;
  youtubeBroadcastId?: string;
  youtubeStreamId?: string;
};

export async function configureYouTubeSession(input: ConfigureYouTubeSessionInput) {
  const schedule = await prisma.batchSchedule.findUnique({
    where: { id: input.batchScheduleId },
  });

  if (!schedule) throw new Error("Batch schedule not found");

  const videoId = input.youtubeVideoId ? extractYouTubeVideoId(input.youtubeVideoId) : null;

  const session = await prisma.whiteboardSession.upsert({
    where: { batchScheduleId: input.batchScheduleId },
    update: {
      videoTransport: input.videoTransport ?? VideoTransport.YOUTUBE,
      youtubeVideoId: videoId ?? undefined,
      youtubeBroadcastId: input.youtubeBroadcastId ?? undefined,
      youtubeStreamId: input.youtubeStreamId ?? undefined,
      livePhase: videoId ? LiveClassPhase.LIVE : LiveClassPhase.PREPARING,
    },
    create: {
      batchScheduleId: input.batchScheduleId,
      teacherId: schedule.teacherId || schedule.createdById,
      title: schedule.title,
      videoTransport: input.videoTransport ?? VideoTransport.YOUTUBE,
      youtubeVideoId: videoId ?? null,
      youtubeBroadcastId: input.youtubeBroadcastId ?? null,
      youtubeStreamId: input.youtubeStreamId ?? null,
      livePhase: videoId ? LiveClassPhase.LIVE : LiveClassPhase.PREPARING,
    },
  });

  return session;
}

export async function updateBroadcastPhase(sessionId: string, phase: LiveClassPhase) {
  return prisma.whiteboardSession.update({
    where: { id: sessionId },
    data: {
      livePhase: phase,
      status: phase === LiveClassPhase.ENDED ? "ENDED" : "ACTIVE",
      endedAt: phase === LiveClassPhase.ENDED ? new Date() : undefined,
    },
  });
}
