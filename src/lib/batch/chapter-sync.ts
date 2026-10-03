import "server-only";
import { prisma } from "@/lib/db";
import { computeISTScheduleDates } from "@/lib/date-utils";

/**
 * Puts a chapter's lectures into a batch's timetable at the date / time each
 * lecture already has (set in Chapter Management). A lecture already in the
 * batch keeps its own entry; a lecture with no date / time yet is skipped.
 */
export async function syncChapterLecturesIntoBatch(batchId: string, chapterId: string, userId: string) {
  const result = { scheduled: 0, alreadyScheduled: 0, notScheduled: 0 };
  const lectures = await prisma.lecture.findMany({
    where: { chapterId },
    select: {
      id: true,
      title: true,
      scheduledDate: true,
      startTime: true,
      durationMin: true,
      teacherId: true,
      videoUrl: true,
      chapter: { select: { subject: { select: { title: true } } } },
    },
  });

  // A lecture already in this batch's timetable (e.g. a class the teacher
  // scheduled/rescheduled there before the chapter was assigned) keeps its
  // own entry and time — never a second copy at the lecture's default time.
  const alreadyScheduled = new Set(
    (
      await prisma.batchSchedule.findMany({
        where: { batchId: batchId, lectureId: { in: lectures.map((l) => l.id) } },
        select: { lectureId: true },
      })
    ).map((s) => s.lectureId)
  );

  for (const lec of lectures) {
    if (alreadyScheduled.has(lec.id)) {
      result.alreadyScheduled++;
      continue;
    }
    if (!(lec.scheduledDate && lec.startTime)) {
      result.notScheduled++;
      continue;
    }
    {
      result.scheduled++;
      const { startsAt, endsAt } = computeISTScheduleDates(
        lec.scheduledDate,
        lec.startTime,
        lec.durationMin || 60
      );
      const scheduleKey = `${lec.id}-${batchId}`;
      await prisma.batchSchedule.upsert({
        where: { id: scheduleKey },
        update: {
          title: lec.title,
          subject: lec.chapter?.subject?.title || null,
          teacherId: lec.teacherId,
          chapterId,
          lectureId: lec.id,
          startsAt,
          endsAt,
        },
        create: {
          id: scheduleKey,
          title: lec.title,
          subject: lec.chapter?.subject?.title || null,
          type: "LIVE_CLASS",
          batchId: batchId,
          teacherId: lec.teacherId,
          chapterId,
          lectureId: lec.id,
          startsAt,
          endsAt,
          createdById: userId,
        },
      });
      {
        const { rescheduleOpenLiveSession } = await import("@/lib/live-session/service");
        await rescheduleOpenLiveSession(scheduleKey, startsAt, endsAt);
      }
      // An old class (YouTube recording) arrives as that recording, not as
      // an empty live class that would show "Cancelled".
      const { extractYouTubeVideoId } = await import("@/lib/live-class/youtube");
      const ytId = lec.videoUrl ? extractYouTubeVideoId(lec.videoUrl) : null;
      if (ytId) {
        await prisma.batchSchedule.update({ where: { id: scheduleKey }, data: { status: "COMPLETED" } });
        await prisma.whiteboardSession.upsert({
          where: { batchScheduleId: scheduleKey },
          update: { status: "ENDED", livePhase: "ENDED", videoTransport: "YOUTUBE", youtubeVideoId: ytId, recordingStatus: "READY" },
          create: {
            batchScheduleId: scheduleKey,
            teacherId: lec.teacherId,
            title: lec.title,
            status: "ENDED",
            livePhase: "ENDED",
            videoTransport: "YOUTUBE",
            youtubeVideoId: ytId,
            recordingStatus: "READY",
            actualStartedAt: startsAt,
            actualEndedAt: endsAt,
            pages: { create: { pageNumber: 1, objects: [] } },
          },
        });
      }
    }
  }
  return result;
}
