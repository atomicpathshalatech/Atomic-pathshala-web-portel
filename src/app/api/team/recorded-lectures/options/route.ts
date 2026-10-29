import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiSuccess } from "@/lib/api/response";
import { ForbiddenError } from "@/lib/rbac/guard";
import { canManageRecordedLectures } from "@/lib/recorded-lectures/access";
import { recordedApiError, requireUserId } from "@/lib/recorded-lectures/api";
import { recordedStorageStatus } from "@/lib/recorded-lectures/config";

export const dynamic = "force-dynamic";

/**
 * Choices for the upload form, from the existing records (no new subjects,
 * chapters or teachers): batches; for a chosen batch its subjects → chapters
 * (assigned to the batch, or in its course) and its teachers first.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId();
    if (!(await canManageRecordedLectures(userId))) throw new ForbiddenError();
    const batchId = request.nextUrl.searchParams.get("batchId");

    const [batches, teachers] = await Promise.all([
      prisma.batch.findMany({
        where: { status: { not: "ARCHIVED" } },
        orderBy: { name: "asc" },
        select: { id: true, name: true, courseId: true },
      }),
      prisma.teacher.findMany({
        select: { id: true, displayName: true, subjects: true, user: { select: { name: true, status: true } } },
        orderBy: { user: { name: "asc" } },
      }),
    ]);

    let subjects: { id: string; title: string; chapters: { id: string; title: string }[] }[] = [];
    let batchTeacherIds: string[] = [];
    if (batchId) {
      const batch = batches.find((b) => b.id === batchId);
      if (batch) {
        const chapters = await prisma.chapter.findMany({
          where: {
            OR: [{ batchAssignments: { some: { batchId } } }, ...(batch.courseId ? [{ subject: { courseId: batch.courseId } }] : [])],
          },
          orderBy: [{ subject: { title: "asc" } }, { order: "asc" }, { title: "asc" }],
          select: { id: true, title: true, subject: { select: { id: true, title: true } } },
        });
        const bySubject = new Map<string, { id: string; title: string; chapters: { id: string; title: string }[] }>();
        for (const c of chapters) {
          const s = bySubject.get(c.subject.id) ?? { id: c.subject.id, title: c.subject.title, chapters: [] };
          s.chapters.push({ id: c.id, title: c.title });
          bySubject.set(c.subject.id, s);
        }
        subjects = Array.from(bySubject.values());
        batchTeacherIds = (await prisma.batchTeacher.findMany({ where: { batchId }, select: { teacherId: true } })).map((t) => t.teacherId);
      }
    }

    return apiSuccess({
      storage: recordedStorageStatus(),
      batches: batches.map((b) => ({ id: b.id, name: b.name })),
      subjects,
      teachers: teachers
        .filter((t) => t.user.status === "ACTIVE")
        .map((t) => ({ id: t.id, name: t.displayName || t.user.name, subjects: t.subjects, inBatch: batchTeacherIds.includes(t.id) }))
        .sort((a, b) => Number(b.inBatch) - Number(a.inBatch)),
    });
  } catch (error) {
    return recordedApiError(error);
  }
}
