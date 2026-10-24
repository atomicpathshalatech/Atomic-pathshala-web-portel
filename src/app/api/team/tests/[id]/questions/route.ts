import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { canManageTest, getTestOr404 } from "@/lib/test-engine/access";
import { getOrCreateDefaultSection, listTestSectionQuestions, nextSectionQuestionOrder } from "@/lib/test-engine/sections";
import { contentFingerprint, testContents, withTestLock } from "@/lib/tests/test-question-guard";
import { testQuestionsAddSchema } from "@/lib/validation/test";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { testLockedReason } from "@/lib/tests/scheduled-publish";

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
    // Questions can be added and corrected until the test's set time (it stays a draft until then).
    const locked = testLockedReason(test);
    if (locked) return apiError(locked, 409);

    const input = testQuestionsAddSchema.parse(await request.json());

    const section = await getOrCreateDefaultSection(params.id);

    const candidates = await prisma.question.findMany({
      where: {
        OR: [
          { id: { in: input.questionIds } },
          { questionCode: { in: input.questionIds } },
        ],
      },
      include: { translations: { select: { language: true, statement: true, options: true } } },
    });
    const foundIds = new Set(candidates.map((q) => q.id));
    const foundCodes = new Set(candidates.map((q) => q.questionCode).filter(Boolean));
    const missing = input.questionIds.filter((id) => !foundIds.has(id) && !foundCodes.has(id));

    // A test holds each question once — in any section — and the same
    // question saved under two ids counts as one. Under the test's lock, so
    // two adds at the same moment cannot both get in.
    const { alreadyAdded, toAdd } = await withTestLock(prisma, params.id, async (tx) => {
      const held = await testContents(tx, params.id);
      const alreadyAdded: string[] = [];
      const toAdd: typeof candidates = [];
      for (const q of candidates) {
        const en = q.translations.find((t) => t.language === "ENGLISH") ?? q.translations[0];
        const fp = q.contentFingerprint ?? contentFingerprint(en?.statement, en?.options);
        if (held.ids.has(q.id) || (fp && held.fingerprints.has(fp))) {
          alreadyAdded.push(q.questionCode || q.id);
          continue;
        }
        held.ids.add(q.id);
        if (fp) held.fingerprints.add(fp);
        toAdd.push(q);
      }
      if (toAdd.length > 0) {
        let nextOrder = await nextSectionQuestionOrder(section.id, tx);
        await tx.sectionQuestion.createMany({
          data: toAdd.map((q) => ({ sectionId: section.id, questionId: q.id, order: nextOrder++ })),
        });
      }
      return { alreadyAdded, toAdd };
    });

    if (toAdd.length > 0) {

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
      rejected: { missing, notVerified: [], alreadyAdded },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
