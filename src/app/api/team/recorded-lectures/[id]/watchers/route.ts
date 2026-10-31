import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/api/response";
import { ForbiddenError } from "@/lib/rbac/guard";
import { canEditLectureContent, canManageRecordedLectures } from "@/lib/recorded-lectures/access";
import { recordedApiError, requireUserId } from "@/lib/recorded-lectures/api";

export const dynamic = "force-dynamic";

/**
 * Who watched this recorded lecture and how much: every student allowed to
 * watch the chapter (ticked in "Students who can watch"), plus anyone else
 * with watch time, with the minutes really played (VideoWatch, counted by
 * the player's heartbeat — skipping ahead does not count), the % of the
 * lecture, where they stopped, and whether it is completed (90% reached).
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    const lecture = await prisma.lecture.findUnique({
      where: { id: params.id },
      select: { id: true, teacherId: true, chapterId: true, recordedMedia: { select: { durationSec: true } } },
    });
    if (!lecture) return apiError("Lecture not found.", 404);
    if (!(await canManageRecordedLectures(userId)) && !(await canEditLectureContent(userId, lecture))) throw new ForbiddenError();

    const [viewers, watches, completed] = await Promise.all([
      prisma.recordedChapterViewer.findMany({ where: { chapterId: lecture.chapterId }, select: { studentId: true } }),
      prisma.videoWatch.findMany({
        where: { lectureId: lecture.id },
        select: { studentId: true, watchedSec: true, lastPositionSec: true, durationSec: true, firstWatchedAt: true, lastWatchedAt: true },
      }),
      prisma.lectureProgress.findMany({ where: { lectureId: lecture.id }, select: { studentId: true, completedAt: true } }),
    ]);
    const ids = Array.from(new Set([...viewers.map((v) => v.studentId), ...watches.map((w) => w.studentId), ...completed.map((c) => c.studentId)]));
    const students = ids.length
      ? await prisma.student.findMany({
          where: { id: { in: ids } },
          select: { id: true, studentIdCode: true, user: { select: { name: true } } },
        })
      : [];
    const watchBy = new Map(watches.map((w) => [w.studentId, w]));
    const doneBy = new Map(completed.map((c) => [c.studentId, c.completedAt]));
    const allowed = new Set(viewers.map((v) => v.studentId));
    const lectureSec = lecture.recordedMedia?.durationSec ?? null;

    const rows = students
      .map((s) => {
        const w = watchBy.get(s.id);
        const dur = lectureSec ?? w?.durationSec ?? null;
        const percent = w && dur ? Math.min(100, Math.round((w.watchedSec / dur) * 100)) : 0;
        return {
          studentId: s.id,
          name: s.user?.name ?? "Student",
          code: s.studentIdCode,
          allowed: allowed.has(s.id),
          watchedSec: w?.watchedSec ?? 0,
          percent,
          lastPositionSec: w?.lastPositionSec ?? 0,
          firstWatchedAt: w?.firstWatchedAt ?? null,
          lastWatchedAt: w?.lastWatchedAt ?? null,
          completedAt: doneBy.get(s.id) ?? null,
        };
      })
      .sort((a, b) => b.percent - a.percent || b.watchedSec - a.watchedSec || a.name.localeCompare(b.name));

    const watched = rows.filter((r) => r.watchedSec > 0).length;
    return apiSuccess({
      durationSec: lectureSec,
      summary: {
        students: rows.length,
        watched,
        notStarted: rows.length - watched,
        completed: rows.filter((r) => r.completedAt).length,
        averagePercent: rows.length ? Math.round(rows.reduce((n, r) => n + r.percent, 0) / rows.length) : 0,
      },
      rows,
    });
  } catch (error) {
    return recordedApiError(error);
  }
}
