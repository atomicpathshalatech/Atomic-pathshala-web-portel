import "server-only";
import { prisma } from "@/lib/db";
import type { CreativeContentData } from "../content-types";
import { toCreativeEducator } from "./educators";

const TEACHER_SELECT = {
  id: true,
  creativePngUrl: true,
  creativeAssetVersion: true,
  user: { select: { name: true, photoUrl: true } },
} as const;

export function lectureLabel(order: number): string {
  return `LECTURE ${String(order + 1).padStart(2, "0")}`;
}

/** Lecture creative content (spec section 9). Batch name comes from the
 * lecture's most recent BatchSchedule, if it's been scheduled anywhere yet —
 * a lecture in the library with no schedule still gets a creative, just
 * without a batch name. */
export async function resolveLectureContent(lectureId: string): Promise<CreativeContentData | null> {
  const lecture = await prisma.lecture.findUnique({
    where: { id: lectureId },
    select: {
      title: true,
      order: true,
      teacher: { select: TEACHER_SELECT },
      chapter: { select: { title: true, subject: { select: { title: true } } } },
      batchSchedules: {
        select: { batch: { select: { name: true } } },
        orderBy: { startsAt: "desc" },
        take: 1,
      },
    },
  });
  if (!lecture) return null;

  return {
    title: lecture.title,
    chapterName: lecture.chapter.title,
    subjectName: lecture.chapter.subject.title,
    lectureLabel: lectureLabel(lecture.order),
    lectureTitle: lecture.title,
    batchName: lecture.batchSchedules[0]?.batch.name,
    educators: [toCreativeEducator(lecture.teacher)],
  };
}

/**
 * Lecture-start-slide content (spec section 10) — resolved from a
 * BatchSchedule, the entity the "Start Class" flow already operates on, so
 * batch/teacher/lecture/chapter are all known with zero extra lookups on
 * the caller's side.
 */
export async function resolveLectureStartSlideContent(scheduleId: string): Promise<CreativeContentData | null> {
  const schedule = await prisma.batchSchedule.findUnique({
    where: { id: scheduleId },
    select: {
      title: true,
      batch: { select: { name: true, targetExam: true } },
      teacher: { select: TEACHER_SELECT },
      lecture: { select: { title: true, order: true } },
      chapter: { select: { title: true, subject: { select: { title: true } } } },
    },
  });
  if (!schedule) return null;

  return {
    title: schedule.lecture?.title || schedule.title,
    chapterName: schedule.chapter?.title,
    subjectName: schedule.chapter?.subject.title,
    lectureLabel: schedule.lecture ? lectureLabel(schedule.lecture.order) : undefined,
    lectureTitle: schedule.lecture?.title || schedule.title,
    batchName: schedule.batch.name,
    examOrCourse: schedule.batch.targetExam ?? undefined,
    educators: schedule.teacher ? [toCreativeEducator(schedule.teacher)] : [],
  };
}
