import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { chapterSchema } from "@/lib/validation/chapter";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    await requirePermission(session?.user?.id, PERMISSIONS.CHAPTER_READ);

    const chapter = await prisma.chapter.findUnique({
      where: { id: params.id },
      include: {
        subject: { include: { course: true } },
        lectures: { orderBy: { order: "asc" }, include: { teacher: { include: { user: { select: { name: true } } } } } },
        dpps: { orderBy: { level: "asc" } },
        tests: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!chapter) return apiError("Chapter not found", 404);

    return apiSuccess({ chapter });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CHAPTER_UPDATE);

    const existing = await prisma.chapter.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Chapter not found", 404);

    const data = chapterSchema.partial().parse(await request.json());

    if (data.subjectId) {
      const subject = await prisma.subject.findUnique({
        where: { id: data.subjectId },
        include: { course: true },
      });
      if (!subject) return apiError("Subject not found", 404);
      if (data.courseId && subject.courseId !== data.courseId) {
        return apiError("The selected Subject does not belong to the selected Course/Exam", 400);
      }
    }

    const chapter = await prisma.chapter.update({
      where: { id: params.id },
      data: {
        ...(data.title !== undefined ? { title: data.title } : {}),
        ...(data.subjectId !== undefined ? { subjectId: data.subjectId } : {}),
        ...(data.medium !== undefined ? { medium: data.medium } : {}),
        ...(data.order !== undefined ? { order: data.order } : {}),
        ...(data.description !== undefined ? { description: data.description || null } : {}),
        ...(data.learningObjectives !== undefined ? { learningObjectives: data.learningObjectives || null } : {}),
        ...(data.prerequisites !== undefined ? { prerequisites: data.prerequisites || null } : {}),
      },
      include: {
        subject: { include: { course: true } },
      },
    });

    return apiSuccess({ chapter });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CHAPTER_DELETE);

    const existing = await prisma.chapter.findUnique({
      where: { id: params.id },
      include: { _count: { select: { lectures: true, dpps: true, tests: true } } },
    });
    if (!existing) return apiError("Chapter not found", 404);

    const NON_DELETABLE_STATUSES = ["PUBLISHED", "SUBMITTED", "UNDER_REVIEW", "APPROVED"];
    if (NON_DELETABLE_STATUSES.includes(existing.status)) {
      return apiError(
        `Cannot delete a chapter that is ${existing.status.replace(/_/g, " ").toLowerCase()}. Move it back to DRAFT/ARCHIVED first.`,
        409
      );
    }
    if (existing._count.lectures > 0 || existing._count.dpps > 0 || existing._count.tests > 0) {
      return apiError("Remove this chapter's lectures, DPPs, and tests before deleting it.", 409);
    }

    await prisma.chapter.delete({ where: { id: params.id } });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
