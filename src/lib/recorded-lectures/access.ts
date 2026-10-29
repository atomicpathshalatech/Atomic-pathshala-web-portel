import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { canManageLecture } from "@/lib/lecture/access";
import { pickPremiere, premiereState, RECORDED_CLASS_MODE, type PremiereState } from "./premiere";

/** Upload, publish, archive recorded lectures (Admin / Super Admin, or granted). */
export function canManageRecordedLectures(userId: string): Promise<boolean> {
  return hasPermission(userId, PERMISSIONS.RECORDED_LECTURE_MANAGE);
}

/**
 * Write the About and work on the summary of this lecture: its own teacher,
 * a lecture admin (LECTURE_PUBLISH), or a recorded-lecture manager. A teacher
 * never gets another teacher's lectures.
 */
export async function canEditLectureContent(userId: string, lecture: { teacherId: string }): Promise<boolean> {
  if (await canManageLecture(userId, lecture.teacherId)) return true;
  return canManageRecordedLectures(userId);
}

/** Approve / publish a summary: the lecture's own teacher or a lecture admin. */
export function canApproveSummary(userId: string, lecture: { teacherId: string }): Promise<boolean> {
  return canEditLectureContent(userId, lecture);
}

/** What makes a recorded lecture watchable at all. */
export const WATCHABLE_MEDIA: Prisma.RecordedLectureMediaWhereInput = {
  uploadStatus: "READY",
  archivedAt: null,
};

/**
 * Lectures a student of `batch` may see: published, file ready, not archived,
 * and either uploaded for this batch, or uploaded for no particular batch
 * and in a chapter this batch has (assigned to it, or part of its course).
 */
export function recordedForBatchWhere(batch: { id: string; courseId: string | null }): Prisma.LectureWhereInput {
  const chapterInBatch: Prisma.ChapterWhereInput[] = [{ batchAssignments: { some: { batchId: batch.id } } }];
  if (batch.courseId) chapterInBatch.push({ subject: { courseId: batch.courseId } });
  return {
    status: "PUBLISHED",
    recordedMedia: {
      is: {
        ...WATCHABLE_MEDIA,
        OR: [{ batchId: batch.id }, { batchId: null, lecture: { chapter: { OR: chapterInBatch } } }],
      },
    },
  };
}

export type StudentPremiere = { scheduleId: string; startsAt: Date; endsAt: Date; state: PremiereState };

export type StudentLectureAccess =
  | { ok: true; batchId: string; premiere: StudentPremiere | null }
  | { ok: false; reason: "NOT_FOUND" | "NOT_PUBLISHED" | "NOT_ENROLLED" };

/**
 * The premiere slot of this lecture for one batch (null: not scheduled —
 * the lecture is watchable as soon as it is published).
 */
export async function premiereForBatch(lectureId: string, batchId: string, now: Date = new Date()): Promise<StudentPremiere | null> {
  const slots = await prisma.batchSchedule.findMany({
    where: { lectureId, batchId, classMode: RECORDED_CLASS_MODE, status: { not: "CANCELLED" } },
    select: { id: true, startsAt: true, endsAt: true },
  });
  const slot = pickPremiere(slots, now);
  return slot ? { scheduleId: slot.id, startsAt: slot.startsAt, endsAt: slot.endsAt, state: premiereState(slot, now) } : null;
}

/**
 * May this student watch this recorded lecture right now? Checked on the
 * server for every page load and every playback URL — never from anything
 * the client sends besides the lecture id. Losing the enrollment (dropped,
 * expired) ends access on the next check.
 */
export async function studentRecordedAccess(studentId: string, lectureId: string): Promise<StudentLectureAccess> {
  const lecture = await prisma.lecture.findUnique({
    where: { id: lectureId },
    select: {
      status: true,
      chapterId: true,
      chapter: { select: { subject: { select: { courseId: true } } } },
      recordedMedia: { select: { uploadStatus: true, archivedAt: true, batchId: true } },
    },
  });
  if (!lecture?.recordedMedia) return { ok: false, reason: "NOT_FOUND" };
  const media = lecture.recordedMedia;
  if (lecture.status !== "PUBLISHED" || media.uploadStatus !== "READY" || media.archivedAt) return { ok: false, reason: "NOT_PUBLISHED" };

  const courseId = lecture.chapter.subject.courseId;
  const enrollment = await prisma.batchEnrollment.findFirst({
    where: {
      studentId,
      status: "ACTIVE",
      batch: media.batchId
        ? { id: media.batchId }
        : { OR: [{ chapterAssignments: { some: { chapterId: lecture.chapterId } } }, { courseId }] },
    },
    select: { batchId: true },
    orderBy: { enrolledAt: "desc" },
  });
  if (!enrollment) return { ok: false, reason: "NOT_ENROLLED" };
  return { ok: true, batchId: enrollment.batchId, premiere: await premiereForBatch(lectureId, enrollment.batchId) };
}

/** Is the student actively enrolled in this batch? */
export async function activeEnrollment(studentId: string, batchId: string) {
  return prisma.batchEnrollment.findFirst({
    where: { studentId, batchId, status: "ACTIVE" },
    select: { batch: { select: { id: true, name: true, courseId: true } } },
  });
}
