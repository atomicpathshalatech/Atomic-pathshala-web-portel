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

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_CREATE);

    const data = bilingualQuestionSchema.parse(await request.json());

    if (data.questionCode) {
      const dup = await prisma.question.findUnique({ where: { questionCode: data.questionCode } });
      if (dup) return apiError("This question code is already in use.", 409);
    }

    const { subject, chapter } = await resolveSubjectChapterNames(
      prisma,
      data.subjectId,
      data.chapterId || undefined
    );

    const question = await prisma.question.create({
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
        createdById: session.user.id,
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

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "QUESTION_CREATE",
        entityType: "Question",
        entityId: question.id,
      },
    });

    return apiSuccess({ question }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
