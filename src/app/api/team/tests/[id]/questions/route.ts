import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { canManageTest, getTestOr404 } from "@/lib/test-engine/access";
import { getOrCreateDefaultSection, listTestSectionQuestions, nextSectionQuestionOrder } from "@/lib/test-engine/sections";
import { testQuestionsAddSchema } from "@/lib/validation/test";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEST_READ);

    const test = await getTestOr404(params.id);
    if (!test) return apiError("Test not found", 404);
    if (!(await canManageTest(session.user.id, test.batchScheduleId))) throw new ForbiddenError();

    const questions = await listTestSectionQuestions(params.id);
    return apiSuccess({ questions });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Bulk-adds questions from the Question Bank into the test's single default
 * "General" section. Only published questions are accepted — a question
 * still awaiting review hasn't cleared the workflow the rest of this
 * codebase already enforces (see Question.isPublished / QUESTION_VERIFY),
 * so letting one slip into a real test would bypass that safeguard. Any
 * rejected ids are reported back, not silently dropped.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEST_UPDATE);

    const test = await getTestOr404(params.id);
    if (!test) return apiError("Test not found", 404);
    if (!(await canManageTest(session.user.id, test.batchScheduleId))) throw new ForbiddenError();
    if (test.status !== "DRAFT") return apiError("Only draft tests can have questions added.", 409);

    const input = testQuestionsAddSchema.parse(await request.json());

    const section = await getOrCreateDefaultSection(params.id);

    const [candidates, existingLinks] = await Promise.all([
      prisma.question.findMany({ where: { id: { in: input.questionIds } } }),
      prisma.sectionQuestion.findMany({ where: { sectionId: section.id }, select: { questionId: true } }),
    ]);

    const existingIds = new Set(existingLinks.map((l) => l.questionId));
    const foundIds = new Set(candidates.map((q) => q.id));
    const missing = input.questionIds.filter((id) => !foundIds.has(id));
    const notVerified = candidates.filter((q) => !q.isPublished).map((q) => q.id);
    const alreadyAdded = input.questionIds.filter((id) => existingIds.has(id));

    const toAdd = candidates.filter((q) => q.isPublished && !existingIds.has(q.id));

    let nextOrder = await nextSectionQuestionOrder(section.id);
    if (toAdd.length > 0) {
      await prisma.sectionQuestion.createMany({
        data: toAdd.map((q) => ({ sectionId: section.id, questionId: q.id, order: nextOrder++ })),
      });

      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "TEST_QUESTIONS_ADDED",
          entityType: "Test",
          entityId: params.id,
          metadata: { count: toAdd.length },
        },
      });
    }

    return apiSuccess({
      added: toAdd.length,
      rejected: { missing, notVerified, alreadyAdded },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
