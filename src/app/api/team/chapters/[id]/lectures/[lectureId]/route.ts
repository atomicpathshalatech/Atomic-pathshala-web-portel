import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, hasPermission, UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { computeISTScheduleDates } from "@/lib/date-utils";
import { newTimeBlockReason, rescheduleBlockReason } from "@/lib/schedule/reschedule-guard";
import { assertChapterAccess } from "@/lib/chapters/access";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; lectureId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.LECTURE_CREATE);
    await assertChapterAccess(session?.user?.id ?? "", params.id, "write");

    const lecture = await prisma.lecture.findUnique({
      where: { id: params.lectureId, chapterId: params.id },
    });
    if (!lecture) return apiError("Lecture not found", 404);

    const body = await request.json();
    const { title, scheduledDate, startTime, slidesUrl, videoUrl, language } = body;
    let { durationMin } = body;
    // A YouTube class's length comes from the video itself, never typed in.
    if (typeof videoUrl === "string" && videoUrl.trim()) {
      const { extractYouTubeVideoId } = await import("@/lib/live-class/youtube");
      const { youtubeVideoDurationMin } = await import("@/lib/youtube/video-duration");
      const fromYoutube = await youtubeVideoDurationMin(extractYouTubeVideoId(videoUrl.trim()));
      if (fromYoutube) durationMin = fromYoutube;
    }
    // Only an edit that actually sets the timing moves the class in the batch
    // timetable — saving notes or a title used to reset its date/time to the
    // lecture's old values ("the date changed by itself").
    const timingChanged = scheduledDate !== undefined || startTime !== undefined || durationMin !== undefined;

    // Moving a live class: only while it's still ahead (not started, start
    // time not passed), and only to a future time. An old class (YouTube
    // recording) records when it was taught, so its date may be in the past.
    const { extractYouTubeVideoId: ytOf } = await import("@/lib/live-class/youtube");
    const isOldClass = Boolean(ytOf(typeof videoUrl === "string" ? videoUrl : lecture.videoUrl || ""));
    if (timingChanged && !isOldClass) {
      const nextDate = scheduledDate !== undefined ? (scheduledDate ? new Date(scheduledDate) : null) : lecture.scheduledDate;
      const nextTime = startTime !== undefined ? startTime?.trim() || null : lecture.startTime;
      const nextDuration = durationMin !== undefined ? Number(durationMin) || 60 : lecture.durationMin || 60;
      const schedules = await prisma.batchSchedule.findMany({
        where: { OR: [{ id: lecture.id }, { lectureId: lecture.id }] },
        select: { startsAt: true, endsAt: true, status: true, liveWhiteboardSession: { select: { actualStartedAt: true, livePhase: true } } },
      });
      if (nextDate) {
        const next = computeISTScheduleDates(nextDate, nextTime, nextDuration);
        const moves = schedules.some(
          (s) => s.startsAt.getTime() !== next.startsAt.getTime() || s.endsAt.getTime() !== next.endsAt.getTime()
        );
        if (moves) {
          for (const s of schedules) {
            const blocked = rescheduleBlockReason(s);
            if (blocked) return apiError(blocked, 409, { code: "RESCHEDULE_NOT_ALLOWED" });
          }
          const pastTime = newTimeBlockReason(next.startsAt);
          if (pastTime) return apiError(pastTime, 400, { code: "TIME_IN_PAST" });
        }
      } else if (schedules.length > 0) {
        return apiError("A scheduled class needs a date and time.", 400);
      }
    }

    const updated = await prisma.lecture.update({
      where: { id: params.lectureId },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(scheduledDate !== undefined && { scheduledDate: scheduledDate ? new Date(scheduledDate) : null }),
        ...(startTime !== undefined && { startTime: startTime?.trim() || null }),
        ...(durationMin !== undefined && { durationMin: Number(durationMin) || 60 }),
        ...(slidesUrl !== undefined && { slidesUrl: slidesUrl?.trim() || null }),
        ...(videoUrl !== undefined && { videoUrl: videoUrl?.trim() || "" }),
        ...(language !== undefined && { language }),
      },
      include: {
        teacher: { include: { user: { select: { name: true } } } },
      },
    });

    // Auto-sync BatchSchedule with accurate IST dates
    if (updated.scheduledDate && (timingChanged || videoUrl !== undefined || title !== undefined)) try {
      const { startsAt, endsAt } = computeISTScheduleDates(
        updated.scheduledDate,
        updated.startTime,
        updated.durationMin || 60
      );
      const { extractYouTubeVideoId } = await import("@/lib/live-class/youtube");
      const ytVideoId = updated.videoUrl ? extractYouTubeVideoId(updated.videoUrl) : null;
      const isPastCompletedClass = Boolean(ytVideoId);

      const matchingSchedules = await prisma.batchSchedule.findMany({
        where: {
          OR: [{ id: updated.id }, { lectureId: updated.id }],
        },
        select: { id: true, teacherId: true },
      });

      for (const s of matchingSchedules) {
        await prisma.batchSchedule.update({
          where: { id: s.id },
          data: {
            title: updated.title,
            ...(timingChanged && { startsAt, endsAt }),
            ...(isPastCompletedClass && { status: "COMPLETED" }),
          },
        });
        // The class's room (countdown, start window, auto-end) moves with it.
        if (timingChanged && !isPastCompletedClass) {
          const { rescheduleOpenLiveSession } = await import("@/lib/live-session/service");
          await rescheduleOpenLiveSession(s.id, startsAt, endsAt);
        }

        if (isPastCompletedClass && ytVideoId) {
          await prisma.whiteboardSession.upsert({
            where: { batchScheduleId: s.id },
            update: {
              status: "ENDED",
              livePhase: "ENDED",
              videoTransport: "YOUTUBE",
              youtubeVideoId: ytVideoId,
              recordingStatus: "READY",
            },
            create: {
              batchScheduleId: s.id,
              teacherId: s.teacherId || updated.teacherId,
              title: updated.title,
              status: "ENDED",
              livePhase: "ENDED",
              videoTransport: "YOUTUBE",
              youtubeVideoId: ytVideoId,
              recordingStatus: "READY",
              actualStartedAt: startsAt || new Date(),
              actualEndedAt: endsAt || new Date(),
              pages: { create: { pageNumber: 1, objects: [] } },
            },
          });
        }
      }
    } catch (syncErr) {
      console.error("[lecture_patch_sync_error]", syncErr);
    }

    // A batch that has this chapter but not this class yet (e.g. the lecture
    // got its date only now) gets it.
    if (updated.scheduledDate) try {
      const { addLectureToChapterBatches } = await import("@/lib/chapters/lecture-batch-sync");
      const chapterRow = await prisma.chapter.findUnique({ where: { id: params.id }, select: { subject: { select: { title: true } } } });
      await addLectureToChapterBatches(updated, { id: params.id, subjectTitle: chapterRow?.subject?.title ?? null }, session.user.id);
    } catch (syncErr) {
      console.error("[lecture_patch_add_to_batches_error]", syncErr);
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "LECTURE_UPDATED",
        entityType: "Lecture",
        entityId: updated.id,
        metadata: { chapterId: params.id, title: updated.title },
      },
    });

    return apiSuccess({ lecture: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; lectureId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    // `PERMISSIONS.LECTURE_DELETE || PERMISSIONS.CHAPTER_UPDATE` used to
    // collapse to just LECTURE_DELETE (both are non-empty strings, so `||`
    // never fell through to CHAPTER_UPDATE) - a permission the TEACHER role
    // never gets by default, only ADMIN does. This is why teachers could
    // never delete a lecture. Real "allow either permission" check below.
    const canDelete =
      (await hasPermission(session.user.id, PERMISSIONS.LECTURE_DELETE)) ||
      (await hasPermission(session.user.id, PERMISSIONS.CHAPTER_UPDATE));
    if (!canDelete) throw new ForbiddenError("You do not have permission to delete this lecture.");
    await assertChapterAccess(session.user.id, params.id, "write");

    const lecture = await prisma.lecture.findUnique({
      where: { id: params.lectureId, chapterId: params.id },
    });
    if (!lecture) return apiError("Lecture not found", 404);

    // Hard delete — Lecture has no soft-delete field/status in the current
    // schema (LectureStatus is only DRAFT|PUBLISHED). Safe: every relation
    // pointing at Lecture is onDelete Cascade (LectureProgress,
    // LectureIssueReport, LectureNote) or SetNull (BatchSchedule.lecture) -
    // nothing Restricts. Deleting a Lecture never touches the separate
    // WhiteboardSession/youtubeArchive* fields (no direct FK relation
    // exists between Lecture and WhiteboardSession), so an archived
    // YouTube recording is never deleted just because the Lecture row is.
    // BatchSchedule.lecture is onDelete: SetNull, so any schedule rows
    // that referenced this lecture have their lectureId nulled by the
    // database automatically as part of this delete — no separate cleanup
    // query needed. (The previous cleanup here filtered BatchSchedule by
    // `id: params.lectureId`, a Lecture id never a BatchSchedule id, so it
    // always matched zero rows — dead code, removed rather than fixed
    // in place since it's now redundant with the FK's own SetNull.)
    // The lecture's upcoming classes leave the batch timetables with it (a
    // class that already happened stays as history).
    const { removeLectureFromBatches } = await import("@/lib/chapters/lecture-batch-sync");
    const fromBatches = await removeLectureFromBatches(params.lectureId);
    if (fromBatches.liveTitle) {
      return apiError(`"${fromBatches.liveTitle}" is live right now — end the class before deleting the lecture.`, 409);
    }

    await prisma.lecture.delete({
      where: { id: params.lectureId },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "LECTURE_DELETED",
        entityType: "Lecture",
        entityId: params.lectureId,
        metadata: { chapterId: params.id, title: lecture.title, batchClassesRemoved: fromBatches.removed, batchClassesKept: fromBatches.kept },
      },
    });

    return apiSuccess({ deleted: true, batchClassesRemoved: fromBatches.removed });
  } catch (error) {
    return handleApiError(error);
  }
}
