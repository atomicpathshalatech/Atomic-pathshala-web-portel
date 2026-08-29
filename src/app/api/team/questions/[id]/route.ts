import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { questionSchema } from "@/lib/validation/question";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import {
  legacyToTranslationCreate,
  legacyTypeToQuestionType,
  legacyTagsToString,
  resolveSubjectChapterNames,
} from "@/lib/questions/legacy";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    await requirePermission(session?.user?.id, PERMISSIONS.QUESTION_READ);

    const question = await prisma.question.findUnique({
      where: { id: params.id },
      include: { translations: true },
    });
    if (!question) return apiError("Question not found", 404);

    return apiSuccess({ question });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_UPDATE);

    const existing = await prisma.question.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Question not found", 404);

    const body = await request.json();
    const data = questionSchema.parse(body);

    const { subject, chapter } = await resolveSubjectChapterNames(prisma, data.subjectId, data.chapterId);
    const translation = legacyToTranslationCreate(data);

    const question = await prisma.question.update({
      where: { id: params.id },
      data: {
        subject,
        chapter,
        type: legacyTypeToQuestionType(data.type),
        difficulty: data.difficulty,
        tags: legacyTagsToString(data.tags),
        translations: {
          upsert: {
            where: { questionId_language: { questionId: params.id, language: "ENGLISH" } },
            create: translation,
            update: translation,
          },
        },
      },
      include: { translations: true },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "QUESTION_UPDATE",
        entityType: "Question",
        entityId: question.id,
      },
    });

    return apiSuccess({ question });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_DELETE);

    const existing = await prisma.question.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Question not found", 404);

    await prisma.question.delete({ where: { id: params.id } });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "QUESTION_DELETE",
        entityType: "Question",
        entityId: params.id,
      },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
