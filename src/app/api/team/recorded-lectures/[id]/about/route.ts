import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/api/response";
import { ForbiddenError } from "@/lib/rbac/guard";
import { canEditLectureContent } from "@/lib/recorded-lectures/access";
import { aboutSaveSchema } from "@/lib/recorded-lectures/schemas";
import { saveAbout } from "@/lib/recorded-lectures/service";
import { recordedApiError, requireUserId } from "@/lib/recorded-lectures/api";

export const dynamic = "force-dynamic";

/**
 * Saves the lecture's About (what the teacher taught). Works without any
 * PDF/PPT. The lecture's own teacher or an admin; never another teacher.
 */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    const lecture = await prisma.lecture.findUnique({ where: { id: params.id }, select: { teacherId: true } });
    if (!lecture) return apiError("Lecture not found.", 404);
    if (!(await canEditLectureContent(userId, lecture))) throw new ForbiddenError("Only this lecture's teacher or an admin can edit its About.");

    const { content, baseRevision } = aboutSaveSchema.parse(await request.json());
    const about = await saveAbout(params.id, content.trim(), baseRevision, userId);
    const outdated = await prisma.lectureSummary.count({ where: { lectureId: params.id, outdated: true, status: { not: "SUPERSEDED" } } });
    return apiSuccess({ about: { content: about.content, revision: about.revision, updatedAt: about.updatedAt }, outdatedSummaries: outdated });
  } catch (error) {
    return recordedApiError(error);
  }
}
