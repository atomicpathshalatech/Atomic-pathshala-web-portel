import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/api/response";
import { ForbiddenError } from "@/lib/rbac/guard";
import { canManageRecordedLectures } from "@/lib/recorded-lectures/access";
import { recordedApiError, requireUserId } from "@/lib/recorded-lectures/api";
import { chapterViewerSetting, saveChapterViewers } from "@/lib/recorded-lectures/viewers";

export const dynamic = "force-dynamic";

/**
 * Who may watch this chapter's recorded lectures in one batch:
 *   GET ?batchId=  → {selectedOnly, students: [{id, name, code, selected}]}
 *   PUT {batchId, selectedOnly, studentIds} → everyone, or exactly these students
 * Only the batch's active students can be chosen.
 */

const saveSchema = z.object({
  batchId: z.string().trim().min(1),
  selectedOnly: z.boolean(),
  studentIds: z.array(z.string().trim().min(1)).max(5000),
});

async function batchOfChapter(batchId: string, chapterId: string) {
  const link = await prisma.batchChapter.findUnique({ where: { batchId_chapterId: { batchId, chapterId } }, select: { batchId: true } });
  return Boolean(link);
}

async function activeStudents(batchId: string) {
  const rows = await prisma.batchEnrollment.findMany({
    where: { batchId, status: "ACTIVE" },
    select: { student: { select: { id: true, studentIdCode: true, enrollmentNumber: true, user: { select: { name: true, phone: true } } } } },
  });
  return rows
    .map((r) => ({
      id: r.student.id,
      name: r.student.user.name ?? "Student",
      code: r.student.studentIdCode ?? r.student.enrollmentNumber ?? "",
      phone: r.student.user.phone ?? "",
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function GET(request: NextRequest, { params }: { params: { chapterId: string } }) {
  try {
    const userId = await requireUserId();
    if (!(await canManageRecordedLectures(userId))) throw new ForbiddenError();
    const batchId = request.nextUrl.searchParams.get("batchId") ?? "";
    if (!batchId || !(await batchOfChapter(batchId, params.chapterId))) return apiError("This chapter is not in that batch.", 404);
    const [setting, students] = await Promise.all([chapterViewerSetting(batchId, params.chapterId), activeStudents(batchId)]);
    const chosen = new Set(setting.studentIds);
    return apiSuccess({ selectedOnly: setting.selectedOnly, students: students.map((s) => ({ ...s, selected: chosen.has(s.id) })) });
  } catch (error) {
    return recordedApiError(error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: { chapterId: string } }) {
  try {
    const userId = await requireUserId();
    if (!(await canManageRecordedLectures(userId))) throw new ForbiddenError();
    const input = saveSchema.parse(await request.json());
    if (!(await batchOfChapter(input.batchId, params.chapterId))) return apiError("This chapter is not in that batch.", 404);
    const inBatch = new Set((await activeStudents(input.batchId)).map((s) => s.id));
    const studentIds = Array.from(new Set(input.studentIds)).filter((id) => inBatch.has(id));
    if (input.selectedOnly && !studentIds.length) return apiError("Choose at least one student, or let every student of the batch watch.", 422);
    await saveChapterViewers({ batchId: input.batchId, chapterId: params.chapterId, selectedOnly: input.selectedOnly, studentIds, userId });
    await prisma.auditLog
      .create({
        data: {
          userId,
          action: "RECORDED_CHAPTER_VIEWERS",
          entityType: "Chapter",
          entityId: params.chapterId,
          metadata: { batchId: input.batchId, selectedOnly: input.selectedOnly, students: studentIds.length },
        },
      })
      .catch(() => null);
    return apiSuccess({ selectedOnly: input.selectedOnly, count: studentIds.length });
  } catch (error) {
    return recordedApiError(error);
  }
}
