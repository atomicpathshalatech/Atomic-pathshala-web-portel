import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { dppSchema } from "@/lib/validation/dpp";
import { resolveSubjectChapterNames } from "@/lib/questions/legacy";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    await requirePermission(session?.user?.id, PERMISSIONS.DPP_READ);

    const dpp = await prisma.dpp.findUnique({
      where: { id: params.id },
      include: {
        questions: {
          include: { question: { include: { translations: true } } },
          orderBy: { order: "asc" },
        },
      },
    });
    if (!dpp) return apiError("DPP not found", 404);

    return apiSuccess({ dpp });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.DPP_UPDATE);

    const existing = await prisma.dpp.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("DPP not found", 404);

    const data = dppSchema.partial().parse(await request.json());

    let subject = existing.subject;
    let chapter: string | null = existing.chapter;
    if (data.subjectId || data.chapterId) {
      const resolved = await resolveSubjectChapterNames(prisma, data.subjectId, data.chapterId || undefined);
      subject = resolved.subject;
      chapter = resolved.chapter ?? chapter;
    }

    const dpp = await prisma.dpp.update({
      where: { id: params.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        subject,
        chapter,
        ...(data.facultyName !== undefined ? { facultyName: data.facultyName || null } : {}),
        ...(data.difficulty !== undefined ? { difficulty: data.difficulty } : {}),
        ...(data.languageMode !== undefined ? { languageMode: data.languageMode } : {}),
        ...(data.description !== undefined ? { description: data.description || null } : {}),
        ...(data.tags !== undefined ? { tags: data.tags.length > 0 ? data.tags.join(",") : null } : {}),
        ...(data.instructions !== undefined ? { instructions: data.instructions || null } : {}),
        ...(data.estimatedTimeMin !== undefined ? { estimatedTimeMin: data.estimatedTimeMin } : {}),
        ...(data.correctMarks !== undefined ? { correctMarks: data.correctMarks } : {}),
        ...(data.incorrectMarks !== undefined ? { incorrectMarks: data.incorrectMarks } : {}),
        ...(data.negativeMarkingEnabled !== undefined
          ? { negativeMarkingEnabled: data.negativeMarkingEnabled }
          : {}),
        ...(data.questionTargetCount !== undefined ? { questionTargetCount: data.questionTargetCount } : {}),
        ...(data.level !== undefined ? { level: data.level ?? null } : {}),
        ...(data.topics !== undefined ? { topics: data.topics } : {}),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DPP_UPDATE",
        entityType: "Dpp",
        entityId: dpp.id,
      },
    });

    return apiSuccess({ dpp });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.DPP_DELETE);

    const existing = await prisma.dpp.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("DPP not found", 404);

    const attemptCount = await prisma.attempt.count({ where: { dppId: params.id } });
    if (attemptCount > 0) {
      return apiError(
        "This DPP already has student attempts and can't be deleted. Unpublish it instead.",
        409
      );
    }

    await prisma.dpp.delete({ where: { id: params.id } });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DPP_DELETE",
        entityType: "Dpp",
        entityId: params.id,
      },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
