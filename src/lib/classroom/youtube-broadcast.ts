import "server-only";
import { prisma } from "@/lib/db";
import {
  youtubeLiveConfigured,
  createAndBindBroadcast,
  transitionBroadcast as sharedTransitionBroadcast,
  fetchRecordingStatus as sharedFetchRecordingStatus,
} from "@/lib/youtube/live-broadcast";

/**
 * ClassroomSession-specific wiring around the shared YouTube Live API client
 * (src/lib/youtube/live-broadcast.ts). Who actually pushes RTMP into the
 * stream created here (our self-hosted relay for BROWSER_RELAY sessions, or
 * the teacher's own OBS/phone app for EXTERNAL_ENCODER sessions) is decided
 * by ClassroomSession.streamMethod.
 */

export const youtubeClassroomConfigured = youtubeLiveConfigured;
export const transitionBroadcast = sharedTransitionBroadcast;
export const fetchRecordingStatus = sharedFetchRecordingStatus;

/**
 * Idempotent create-or-reuse: never creates a second YouTube broadcast for
 * the same scheduled lecture. Callers (the .../start route) pass the
 * ClassroomSession row they already fetched/created for this batchSchedule.
 */
export async function ensureYoutubeBroadcast(classroomSessionId: string, title: string, scheduledStartTime: Date) {
  const existing = await prisma.classroomSession.findUniqueOrThrow({ where: { id: classroomSessionId } });
  if (existing.youtubeBroadcastId && existing.youtubeStreamId) return existing;

  const { stream, broadcast } = await createAndBindBroadcast(title, scheduledStartTime);

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
