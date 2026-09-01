import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { bilingualQuestionSchema } from "@/lib/validation/question-v2";
import { resolveSubjectChapterNames, legacyTagsToString } from "@/lib/questions/legacy";

function toOptionsJson(t: { optionA?: string; optionB?: string; optionC?: string; optionD?: string }) {
  const options: Record<string, string> = {};
  if (t.optionA) options.A = t.optionA;
  if (t.optionB) options.B = t.optionB;
  if (t.optionC) options.C = t.optionC;
  if (t.optionD) options.D = t.optionD;
  return options;
}

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

    const data = bilingualQuestionSchema.parse(await request.json());

    if (data.questionCode && data.questionCode !== existing.questionCode) {
      const dup = await prisma.question.findUnique({ where: { questionCode: data.questionCode } });
      if (dup) return apiError("This question code is already in use.", 409);
    }

    const { subject, chapter } = await resolveSubjectChapterNames(
      prisma,
      data.subjectId,
      data.chapterId || undefined
    );

    // Translations are replaced wholesale rather than diffed — simplest
    // safe approach given the edit form always submits the full set of
    // languages it's currently showing.
    const question = await prisma.$transaction(async (tx) => {
      await tx.questionTranslation.deleteMany({ where: { questionId: params.id } });
      return tx.question.update({
        where: { id: params.id },
        data: {
          subject,
          chapter,
          topic: data.topic || null,
          subTopic: data.subTopic || null,
          category: data.category || null,
          pyqSource: data.pyqSource || null,
          questionCode: data.questionCode || null,
          type: data.type,
          difficulty: data.difficulty,
          tags: legacyTagsToString(data.tags),
          translations: {
            create: data.translations.map((t) => ({
              language: t.language,
              statement: t.statement,
              options: toOptionsJson(t),
              correctOptionIds: t.correctOptionIds,
              solution: t.solution || null,
            })),
          },
        },
        include: { translations: true },
      });
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
