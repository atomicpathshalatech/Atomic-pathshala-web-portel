import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { canManageTest, getTestOr404 } from "@/lib/test-engine/access";
import { getOrCreateDefaultSection, listTestSectionQuestions, nextSectionQuestionOrder } from "@/lib/test-engine/sections";
import { contentFingerprint, testContents, withTestLock, type DuplicateDetailPayload } from "@/lib/tests/test-question-guard";
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
 * "General" section. Only published questions are accepted.
 * Enforces transactional idempotency and returns structured duplicate information.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEST_UPDATE);

    const test = await getTestOr404(params.id);
    if (!test) return apiError("Test not found", 404);
    if (!(await canManageTest(session.user.id, test.batchScheduleId))) throw new ForbiddenError();

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

    // A test holds each question once — in any section.
    // Under the test's lock, transactional insertion with testId ensures DB uniqueness.
    const { duplicateDetailsList, alreadyAdded, toAdd } = await withTestLock(prisma, params.id, async (tx) => {
      const held = await testContents(tx, params.id);
      const duplicateDetailsList: DuplicateDetailPayload[] = [];
      const alreadyAdded: string[] = [];
      const toAdd: typeof candidates = [];

      for (const q of candidates) {
        const en = q.translations.find((t) => t.language === "ENGLISH") ?? q.translations[0];
        const fp = q.contentFingerprint ?? contentFingerprint(en?.statement, en?.options);

        const existingById = held.ids.has(q.id);
        const existingByFp = fp ? held.fingerprints.has(fp) : false;

        if (existingById || existingByFp) {
          const detail = held.details.get(q.id) || (fp ? held.details.get(fp) : undefined);
          alreadyAdded.push(q.questionCode || q.id);
          duplicateDetailsList.push({
            message: existingById
              ? "Duplicate Question Detected: This question is already included in this test."
              : "Duplicate Question Detected: An identical question is already included in this test.",
            questionId: q.id,
            questionCode: q.questionCode,
            assignedQuestionNumber: detail ? `Q${detail.order}` : "Existing",
            section: detail?.section || section.name,
            subject: q.subject || detail?.subject || "General",
            chapter: q.chapter || detail?.chapter || "General",
            addedAt: detail?.addedAt ? detail.addedAt.toISOString() : null,
            kind: existingById ? "id" : "content",
          });
          continue;
        }

        held.ids.add(q.id);
        if (fp) held.fingerprints.add(fp);
        toAdd.push(q);
      }

      if (toAdd.length > 0) {
        let nextOrder = await nextSectionQuestionOrder(section.id, tx);
        await tx.sectionQuestion.createMany({
          data: toAdd.map((q) => ({
            testId: params.id,
            sectionId: section.id,
            questionId: q.id,
            order: nextOrder++,
          })),
        });

        // Mark any prior test audit reports as OUTDATED
        await tx.test.update({
          where: { id: params.id },
          data: { auditStatus: "OUTDATED" },
        });

        await tx.testAuditReport.updateMany({
          where: { testId: params.id, status: "COMPLETED" },
          data: { status: "OUTDATED" },
        });
      }

      return { duplicateDetailsList, alreadyAdded, toAdd };
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

    // If single addition was requested and it's a duplicate, return 409 with rich details
    if (toAdd.length === 0 && duplicateDetailsList.length === 1 && input.questionIds.length === 1) {
      const dup = duplicateDetailsList[0];
      return apiError(
        `${dup.message} (${dup.assignedQuestionNumber} in ${dup.section}, Chapter: ${dup.chapter})`,
        409,
        dup
      );
    }

    return apiSuccess({
      added: toAdd.length,
      rejected: {
        missing,
        notVerified: [],
        alreadyAdded,
        duplicates: duplicateDetailsList,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
