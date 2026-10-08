import "server-only";
import { prisma } from "@/lib/db";
import { computeISTScheduleDates } from "@/lib/date-utils";
import { clearAttemptsForSchedules } from "@/lib/team/resource-delete";

/**
 * Keeps a chapter's lectures and the batch timetables they are in the same:
 * a lecture created / moved / deleted in the chapter shows up the same way in
 * every batch that has the chapter, and a class moved in a batch moves the
 * lecture (and its class in the chapter's other batches).
 */

/**
 * Batches that have this chapter: assigned / imported (BatchChapter), plus any
 * batch whose timetable already holds this chapter's classes (older imports
 * put classes there without the assignment row).
 */
export async function chapterBatchIds(chapterId: string): Promise<string[]> {
  const [assigned, scheduled] = await Promise.all([
    prisma.batchChapter.findMany({ where: { chapterId }, select: { batchId: true }, orderBy: { assignedAt: "asc" } }),
    prisma.batchSchedule.findMany({ where: { chapterId }, select: { batchId: true }, distinct: ["batchId"] }),
  ]);
  return Array.from(new Set([...assigned.map((a) => a.batchId), ...scheduled.map((s) => s.batchId)]));
}

type SyncLecture = {
  id: string;
  title: string;
  teacherId: string;
  scheduledDate: Date | null;
  startTime: string | null;
  durationMin: number | null;
  videoUrl: string | null;
};

/**
 * Puts a dated lecture into every batch that has its chapter but doesn't have
 * this lecture yet (a batch that already has it keeps its own entry).
 */
export async function addLectureToChapterBatches(
  lecture: SyncLecture,
  chapter: { id: string; subjectTitle: string | null },
  userId: string
): Promise<number> {
  if (!lecture.scheduledDate) return 0;
  const batchIds = await chapterBatchIds(chapter.id);
  if (batchIds.length === 0) return 0;
  const existing = await prisma.batchSchedule.findMany({
    where: { OR: [{ id: lecture.id }, { lectureId: lecture.id }] },
    select: { id: true, batchId: true },
  });
  const has = new Set(existing.map((s) => s.batchId));
  const idTaken = existing.some((s) => s.id === lecture.id);

  const { startsAt, endsAt } = computeISTScheduleDates(lecture.scheduledDate, lecture.startTime, lecture.durationMin || 60);
  const { extractYouTubeVideoId } = await import("@/lib/live-class/youtube");
  const ytVideoId = lecture.videoUrl ? extractYouTubeVideoId(lecture.videoUrl) : null;
  const isPastCompletedClass = Boolean(ytVideoId);

  let added = 0;
  for (const batchId of batchIds) {
    if (has.has(batchId)) continue;
    const scheduleKey = !idTaken && added === 0 ? lecture.id : `${lecture.id}-${batchId}`;
    await prisma.batchSchedule.create({
      data: {
        id: scheduleKey,
        title: lecture.title,
        subject: chapter.subjectTitle,
        type: "LIVE_CLASS",
        batchId,
        teacherId: lecture.teacherId,
        chapterId: chapter.id,
        lectureId: lecture.id,
        startsAt,
        endsAt,
        status: isPastCompletedClass ? "COMPLETED" : "SCHEDULED",
        createdById: userId,
      },
    });
    if (isPastCompletedClass && ytVideoId) {
      await prisma.whiteboardSession.create({
        data: {
          batchScheduleId: scheduleKey,
          teacherId: lecture.teacherId,
          title: lecture.title,
          status: "ENDED",
          livePhase: "ENDED",
          videoTransport: "YOUTUBE",
          youtubeVideoId: ytVideoId,
          recordingStatus: "READY",
          actualStartedAt: startsAt,
          actualEndedAt: endsAt,
          pages: { create: { pageNumber: 1, objects: [] } },
        },
      });
    } else {
      await prisma.whiteboardSession.create({
        data: {
          batchScheduleId: scheduleKey,
          teacherId: lecture.teacherId,
          title: lecture.title,
          status: "ACTIVE",
          livePhase: "SCHEDULED",
          videoTransport: "YOUTUBE",
          scheduledStart: startsAt,
          scheduledEnd: endsAt,
          pages: { create: { pageNumber: 1, objects: [] } },
        },
      });
    }
    added++;
  }
  return added;
}

/**
 * Before a lecture is deleted: removes its classes from the batch timetables.
 * A class that already happened (started, completed, or has a recording) is
 * kept as history; a class that is live right now blocks the delete.
 */
export async function removeLectureFromBatches(lectureId: string): Promise<{ removed: number; kept: number; liveTitle?: string }> {
  const schedules = await prisma.batchSchedule.findMany({
    where: { OR: [{ id: lectureId }, { lectureId }] },
    select: {
      id: true,
      title: true,
      status: true,
      liveWhiteboardSession: {
        select: { id: true, status: true, actualStartedAt: true, lastHeartbeatAt: true, youtubeBroadcastId: true, youtubeVideoId: true, livePhase: true },
      },
    },
  });

  const STALE_SESSION_MS = 5 * 60 * 1000;
  const toRemove: typeof schedules = [];
  let kept = 0;
  for (const s of schedules) {
    const wb = s.liveWhiteboardSession;
    const beat = wb?.lastHeartbeatAt ?? wb?.actualStartedAt;
    if (wb?.status === "ACTIVE" && beat && Date.now() - beat.getTime() < STALE_SESSION_MS) {
      return { removed: 0, kept: schedules.length, liveTitle: s.title };
    }
    const happened = s.status === "COMPLETED" || Boolean(wb?.actualStartedAt) || wb?.livePhase === "ENDED" || Boolean(wb?.youtubeVideoId);
    if (happened) kept++;
    else toRemove.push(s);
  }
  if (toRemove.length === 0) return { removed: 0, kept };

  const ids = toRemove.map((s) => s.id);
  await clearAttemptsForSchedules(ids);
  for (const s of toRemove) {
    if (s.liveWhiteboardSession?.youtubeBroadcastId) {
      const { cancelYoutubeBroadcastForWhiteboard } = await import("@/lib/live-class/youtube-broadcast");
      cancelYoutubeBroadcastForWhiteboard(s.liveWhiteboardSession.id).catch((err) => {
        console.warn("[Lecture Delete] Broadcast cancel warning:", err);
      });
    }
  }
  const deleted = await prisma.batchSchedule.deleteMany({ where: { id: { in: ids } } });
  try {
    const { cancelScheduledNotifications } = await import("@/lib/notifications/scheduler");
    const { NotificationType } = await import("@/lib/notifications/types");
    for (const id of ids) {
      await cancelScheduledNotifications(NotificationType.CLASS_REMINDER_15_MIN, id);
      await cancelScheduledNotifications(NotificationType.CLASS_STARTED, id);
    }
  } catch (notifErr) {
    console.warn("[Lecture Delete Reminder Cancellation Warning]", notifErr);
  }
  return { removed: deleted.count, kept };
}

/** IST date / "HH:MM" of an instant, in the form lectures store them. */
function istParts(at: Date): { scheduledDate: Date; startTime: string } {
  const ymd = at.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const hm = at.toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return { scheduledDate: new Date(`${ymd}T00:00:00.000Z`), startTime: hm };
}

/**
 * A class moved in a batch timetable: the chapter's lecture takes the new
 * date / time / duration, and the same lecture's class in the chapter's other
 * batches moves too (only while it is still ahead — never one that started).
 */
export async function applyBatchRescheduleToLecture(scheduleId: string, lectureId: string, startsAt: Date, endsAt: Date) {
  const { scheduledDate, startTime } = istParts(startsAt);
  const durationMin = Math.max(1, Math.round((endsAt.getTime() - startsAt.getTime()) / 60000));
  await prisma.lecture.update({ where: { id: lectureId }, data: { scheduledDate, startTime, durationMin } });

  const others = await prisma.batchSchedule.findMany({
    where: { OR: [{ id: lectureId }, { lectureId }], NOT: { id: scheduleId } },
    select: { id: true, status: true, startsAt: true, endsAt: true, liveWhiteboardSession: { select: { actualStartedAt: true, livePhase: true } } },
  });
  const { rescheduleBlockReason } = await import("@/lib/schedule/reschedule-guard");
  const { rescheduleOpenLiveSession } = await import("@/lib/live-session/service");
  for (const o of others) {
    if (o.startsAt.getTime() === startsAt.getTime() && o.endsAt.getTime() === endsAt.getTime()) continue;
    if (rescheduleBlockReason(o)) continue;
    await prisma.batchSchedule.update({ where: { id: o.id }, data: { startsAt, endsAt, rescheduledAt: new Date() } });
    await prisma.whiteboardSession.updateMany({ where: { batchScheduleId: o.id }, data: { scheduledStart: startsAt, scheduledEnd: endsAt } });
    await rescheduleOpenLiveSession(o.id, startsAt, endsAt);
  }
}
