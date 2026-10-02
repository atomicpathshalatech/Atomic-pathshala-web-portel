import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { type ChapterStatusValue } from "@/lib/chapters/state-machine";
import { assertChapterAccess } from "@/lib/chapters/access";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CHAPTER_UPDATE);
    await assertChapterAccess(session?.user?.id ?? "", params.id, "write");

    const body = await request.json().catch(() => ({}));
    const { startDate, startTime = "10:00", durationMin = 90, weekdays } = body;

    const chapter = await prisma.chapter.findUnique({
      where: { id: params.id },
      include: {
        subject: { select: { title: true } },
        lectures: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
      },
    });
    if (!chapter) return apiError("Chapter not found", 404);

    if (chapter.lectures.length === 0) {
      return apiError("Please add at least one lecture before submitting the chapter.", 400);
    }

    const currentStatus = chapter.status as ChapterStatusValue;

    // Optional Batch Scheduling Calculation across selected Weekdays
    // Weekdays + time + duration chosen here decide every lecture's date, and
    // the same dates go into the batch timetable (assigned batches) — before,
    // only the Lecture rows changed, so the chapter and the batch showed
    // different dates. Old classes (a YouTube recording) keep their own date;
    // a class that already ran is never moved.
    const { computeISTScheduleDates } = await import("@/lib/date-utils");
    const { extractYouTubeVideoId } = await import("@/lib/live-class/youtube");
    const lectureUpdates: any[] = [];
    const planned: { lectureId: string; title: string; teacherId: string; startsAt: Date; endsAt: Date }[] = [];
    // Classes already taken or whose time has passed keep their date (they
    // can only be deleted or have notes updated, never moved).
    const { rescheduleBlockReason } = await import("@/lib/schedule/reschedule-guard");
    const existingSchedules = await prisma.batchSchedule.findMany({
      where: { lectureId: { in: chapter.lectures.map((l) => l.id) } },
      select: { lectureId: true, startsAt: true, status: true, liveWhiteboardSession: { select: { actualStartedAt: true, livePhase: true } } },
    });
    const lockedLectureIds = new Set(existingSchedules.filter((s) => rescheduleBlockReason(s)).map((s) => s.lectureId));
    if (startDate && Array.isArray(weekdays) && weekdays.length > 0) {
      const parts = String(startDate).split("-").map((p) => parseInt(p, 10));
      const year = parts[0] || new Date().getFullYear();
      const month = (parts[1] || 1) - 1;
      const day = parts[2] || 1;
      // Calendar arithmetic in UTC, so the server's own timezone can't shift a day.
      const current = new Date(Date.UTC(year, month, day));
      const duration = Number(durationMin) || 90;

      for (const lec of chapter.lectures) {
        if (lec.videoUrl && extractYouTubeVideoId(lec.videoUrl)) continue;
        if (lockedLectureIds.has(lec.id)) continue;
        while (!weekdays.includes(current.getUTCDay())) {
          current.setUTCDate(current.getUTCDate() + 1);
        }

        const scheduledDate = new Date(current);
        const { startsAt, endsAt } = computeISTScheduleDates(scheduledDate, startTime || "10:00", duration);
        planned.push({ lectureId: lec.id, title: lec.title, teacherId: lec.teacherId, startsAt, endsAt });
        lectureUpdates.push(
          prisma.lecture.update({
            where: { id: lec.id },
            data: {
              scheduledDate: scheduledDate,
              startTime: startTime || "10:00",
              durationMin: duration,
            },
          })
        );

        current.setUTCDate(current.getUTCDate() + 1);
      }
    }

    const [updated] = await prisma.$transaction([
      ...lectureUpdates,
      prisma.chapter.update({
        where: { id: chapter.id },
        data: { status: "UNDER_REVIEW" },
      }),
      prisma.chapterReview.create({
        data: {
          chapterId: chapter.id,
          action: "SUBMITTED",
          actorId: session.user.id,
          previousStatus: currentStatus,
          newStatus: "UNDER_REVIEW",
        },
      }),
      prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CHAPTER_SUBMITTED",
          entityType: "Chapter",
          entityId: chapter.id,
          metadata: {
            from: currentStatus,
            to: "UNDER_REVIEW",
            batchSchedule: startDate ? { startDate, startTime, durationMin, weekdays } : null,
          },
        },
      }),
    ]);

    // Batch timetable: same dates in every batch that has this chapter.
    if (planned.length) {
      const { chapterBatchIds } = await import("@/lib/chapters/lecture-batch-sync");
      const batches = (await chapterBatchIds(chapter.id)).map((batchId) => ({ batchId }));
      const { rescheduleOpenLiveSession } = await import("@/lib/live-session/service");
      for (const p of planned) {
        for (const { batchId } of batches) {
          const existing = await prisma.batchSchedule.findFirst({
            where: { batchId, lectureId: p.lectureId },
            select: { id: true, status: true, liveWhiteboardSession: { select: { status: true, livePhase: true } } },
          });
          if (existing) {
            const ran =
              existing.status === "COMPLETED" ||
              existing.status === "LIVE" ||
              existing.liveWhiteboardSession?.status === "ENDED" ||
              existing.liveWhiteboardSession?.livePhase === "LIVE" ||
              existing.liveWhiteboardSession?.livePhase === "ENDED";
            if (ran) continue;
            await prisma.batchSchedule.update({ where: { id: existing.id }, data: { startsAt: p.startsAt, endsAt: p.endsAt } });
            await rescheduleOpenLiveSession(existing.id, p.startsAt, p.endsAt);
          } else {
            await prisma.batchSchedule.create({
              data: {
                id: `${p.lectureId}-${batchId}`,
                title: p.title,
                subject: chapter.subject?.title ?? null,
                type: "LIVE_CLASS",
                batchId,
                teacherId: p.teacherId,
                chapterId: chapter.id,
                lectureId: p.lectureId,
                startsAt: p.startsAt,
                endsAt: p.endsAt,
                createdById: session.user.id,
              },
            });
          }
        }
      }
    }

    return apiSuccess({ chapter: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
