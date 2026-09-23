import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { canManageTest, getTestOr404 } from "@/lib/test-engine/access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEST_UPDATE);

    const test = await prisma.test.findUnique({
      where: { id: params.id },
      include: {
        sections: {
          include: {
            questions: {
              include: {
                question: {
                  include: { translations: true },
                },
              },
            },
          },
        },
      },
    });

    if (!test) return apiError("Test not found", 404);
    if (!(await canManageTest(session.user.id, test.batchScheduleId))) throw new ForbiddenError();

    // 1. Build map of latest correct answers and marks per question
    const questionConfigMap = new Map<
      string,
      {
        correctOptionIds: string[];
        correctMarks: number;
        negativeMarks: number;
        type?: string;
      }
    >();

    const { extractCorrectOptionKeys, isAnswerCorrect } = await import("@/lib/test-engine/answer-evaluator");

    for (const section of test.sections) {
      for (const sq of section.questions) {
        const correctIds = extractCorrectOptionKeys(sq.question);
        const correctMarks = sq.marksOverride ?? section.marksPerQuestion ?? test.correctMarks ?? 4;
        const negativeMarks =
          sq.negativeMarksOverride ?? section.negativeMarks ?? test.incorrectMarks ?? -1;

        questionConfigMap.set(sq.questionId, {
          correctOptionIds: correctIds,
          correctMarks,
          negativeMarks,
          type: sq.question.type,
        });
      }
    }

    // 2. Fetch all completed attempts for this test
    const attempts = await prisma.attempt.findMany({
      where: {
        testId: test.id,
        status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] },
      },
      include: { answers: true },
    });

    let recalculatedCount = 0;

    for (const attempt of attempts) {
      let totalScore = 0;
      const answerUpdates: Array<{ id: string; isCorrect: boolean | null }> = [];

      for (const ans of attempt.answers) {
        const config = questionConfigMap.get(ans.questionId);
        if (!config) continue;

        const selected = Array.isArray(ans.selectedOptionIds) ? (ans.selectedOptionIds as string[]) : [];

        if (selected.length === 0) {
          answerUpdates.push({ id: ans.id, isCorrect: null });
          continue;
        }

        const { correctOptionIds, correctMarks, negativeMarks, type } = config as any;
        const isCorrect = isAnswerCorrect(correctOptionIds, selected, type);

        totalScore += isCorrect ? correctMarks : negativeMarks;
        answerUpdates.push({ id: ans.id, isCorrect });
      }

      // Execute updates in batch transaction
      await prisma.$transaction([
        ...answerUpdates.map((u) =>
          prisma.attemptAnswer.update({
            where: { id: u.id },
            data: { isCorrect: u.isCorrect },
          })
        ),
        prisma.attempt.update({
          where: { id: attempt.id },
          data: { score: totalScore },
        }),
      ]);

      // Re-run test attempt analytics to refresh score, accuracy, ranks
      try {
        const { calculateAndStoreTestAnalysis } = await import("@/lib/test-engine/analysis-engine");
        await calculateAndStoreTestAnalysis(attempt.id);
      } catch (err) {
        console.error(`[RecalculateScores] Failed to refresh analysis for attempt ${attempt.id}:`, err);
      }

      recalculatedCount++;
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "TEST_SCORES_RECALCULATED",
        entityType: "Test",
        entityId: test.id,
        metadata: {
          recalculatedAttempts: recalculatedCount,
          totalAttempts: attempts.length,
        },
      },
    });

    return apiSuccess({
      recalculatedCount,
      message:
        recalculatedCount > 0
          ? `Successfully recalculated scores for ${recalculatedCount} student attempt(s).`
          : "No student submissions found to recalculate.",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
