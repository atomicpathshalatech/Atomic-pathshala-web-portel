import "server-only";
import { prisma } from "@/lib/db";
import { youtubeLiveConfigured, createAndBindBroadcast, ensureBroadcastEmbeddable } from "@/lib/youtube/live-broadcast";

/**
 * WhiteboardSession-specific wiring around the shared YouTube Live API
 * client (src/lib/youtube/live-broadcast.ts).
 */

export const youtubeLiveClassConfigured = youtubeLiveConfigured;

/**
 * Idempotent create-or-reuse: never creates a second YouTube broadcast for
 * the same WhiteboardSession, even across multiple "Start Class" clicks or
 * class restarts within the same occurrence.
 */
export async function ensureYoutubeBroadcastForWhiteboard(
  whiteboardSessionId: string,
  title: string,
  scheduledStartTime: Date
) {
  const existing = await prisma.whiteboardSession.findUniqueOrThrow({
    where: { id: whiteboardSessionId },
    include: {
      teacher: { include: { user: true } },
    },
  });
  if (existing.youtubeBroadcastId && existing.youtubeStreamId) {
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

  // Rich formatted academic title (YouTube limit 100 chars)
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

  return prisma.whiteboardSession.update({
    where: { id: whiteboardSessionId },
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
