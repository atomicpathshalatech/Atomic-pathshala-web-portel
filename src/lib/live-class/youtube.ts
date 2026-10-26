import { prisma } from "@/lib/db";
import { LiveClassPhase, VideoTransport } from "@prisma/client";

import { extractYouTubeVideoId } from "./youtube-url";

// Re-exported for server code that imports them from here.
export { extractYouTubeVideoId, extractYoutubeVideoId, isValidYouTubeVideoId, buildYouTubeEmbedUrl } from "./youtube-url";

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
