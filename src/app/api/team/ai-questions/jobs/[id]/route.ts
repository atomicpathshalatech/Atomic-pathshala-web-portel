import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_READ);

    const batch = await prisma.aiGenerationBatch.findUnique({
      where: { id: params.id },
      include: {
        sourcePdf: {
          select: {
            id: true,
            resourceId: true,
            fileName: true,
            fileUrl: true,
            pageCount: true,
          },
        },
        questions: {
          orderBy: { questionIndex: "asc" },
        },
      },
    });

    if (!batch) {
      return apiError("Generation batch not found.", 404);
    }

    return apiSuccess({ batch });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_CREATE);

    const body = await request.json();
    const { questionId, ...fieldsToUpdate } = body;

    if (!questionId) {
      return apiError("questionId is required.", 400);
    }

    const question = await prisma.aiGeneratedQuestion.findFirst({
      where: { id: questionId, batchId: params.id },
    });

    if (!question) {
      return apiError("Generated question not found in this batch.", 404);
    }

    const updated = await prisma.aiGeneratedQuestion.update({
      where: { id: questionId },
      data: {
        statementEn: fieldsToUpdate.statementEn ?? question.statementEn,
        statementHi: fieldsToUpdate.statementHi ?? question.statementHi,
        optionsEn: fieldsToUpdate.optionsEn ?? question.optionsEn,
        optionsHi: fieldsToUpdate.optionsHi ?? question.optionsHi,
        correctAnswer: fieldsToUpdate.correctAnswer ?? question.correctAnswer,
        solutionEn: fieldsToUpdate.solutionEn ?? question.solutionEn,
        solutionHi: fieldsToUpdate.solutionHi ?? question.solutionHi,
        topic: fieldsToUpdate.topic ?? question.topic,
        subTopic: fieldsToUpdate.subTopic ?? question.subTopic,
        difficulty: fieldsToUpdate.difficulty ?? question.difficulty,
        questionType: fieldsToUpdate.questionType ?? question.questionType,
        editSource: "HUMAN",
      },
    });

    return apiSuccess({ question: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
