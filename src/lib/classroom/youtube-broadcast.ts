import "server-only";
import { prisma } from "@/lib/db";
import {
  youtubeLiveConfigured,
  createAndBindBroadcast,
  transitionBroadcast as sharedTransitionBroadcast,
  fetchRecordingStatus as sharedFetchRecordingStatus,
  ensureBroadcastEmbeddable,
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
  const existing = await prisma.classroomSession.findUniqueOrThrow({
    where: { id: classroomSessionId },
    include: {
      teacher: { include: { user: true } },
    },
  });
  if (existing.youtubeBroadcastId && existing.youtubeStreamId && existing.youtubeStreamKey) {
    ensureBroadcastEmbeddable(existing.youtubeBroadcastId).catch(() => {});
    return existing;
  }

  const schedule = existing.batchScheduleId
    ? await prisma.batchSchedule.findUnique({
        where: { id: existing.batchScheduleId },
        include: {
          batch: true,
          teacher: { include: { user: true } },
        },
      })
    : null;

  const teacherName = schedule?.teacher?.user?.name || existing.teacher?.user?.name || "Educator";
  const subjectName = (schedule as any)?.subject || "";
  const batchName = schedule?.batch?.name || "";

  const cleanSubject = subjectName ? `[${subjectName}] ` : "";
  const finalTitle = `${cleanSubject}${title} | ${teacherName} | Atomic Pathshala`.slice(0, 98);

  const description = [
    `🎓 Atomic Pathshala Live Classroom`,
    subjectName ? `📚 Subject: ${subjectName}` : null,
    batchName ? `👥 Batch: ${batchName}` : null,
    `👨‍🏫 Educator: ${teacherName}`,
    `🗓️ Date: ${scheduledStartTime.toLocaleDateString("en-IN")}`,
    ``,
    `Join Atomic Pathshala live lectures for concept explanation, doubt clearing, and question practice.`,
    `🌐 Official Portal: https://atomicpathshala.com`,
  ]
    .filter(Boolean)
    .join("\n");

  const { stream, broadcast } = await createAndBindBroadcast(finalTitle, scheduledStartTime, description);

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
