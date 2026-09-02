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
    await requirePermission(session.user.id, PERMISSIONS.TEST_PUBLISH);

    const test = await prisma.test.findUnique({
      where: { id: params.id },
      include: {
        template: true,
        sections: {
          include: {
            questions: {
              include: { question: true },
            },
          },
        },
      },
    });

    if (!test) return apiError("Test not found", 404);
    if (!(await canManageTest(session.user.id, test.batchScheduleId))) throw new ForbiddenError();
    if (test.status !== "DRAFT") return apiError("This test has already been published.", 409);

    if (test.sections.length === 0) {
      return apiError("Cannot publish test without any sections or questions configured.", 400);
    }

    const totalQuestions = test.sections.reduce((sum, s) => sum + s.questions.length, 0);
    if (totalQuestions === 0) {
      return apiError("Add at least one question before publishing.", 400);
    }

    // Validation 1: Verify all sections have at least one question
    const emptySections = test.sections.filter((s) => s.questions.length === 0);
    if (emptySections.length > 0) {
      const secName = emptySections[0]?.name || "Unnamed Section";
      return apiError(
        `Section "${secName}" has no questions assigned. Every section must have questions.`,
        400
      );
    }

    // Validation 2: Verify all assigned questions are published/verified
    const unverifiedQuestions = test.sections.flatMap((s) =>
      s.questions.filter((sq) => !sq.question.isPublished).map((sq) => sq.questionId)
    );
    if (unverifiedQuestions.length > 0) {
      return apiError(
        `Cannot publish test: ${unverifiedQuestions.length} assigned question(s) are still in DRAFT status and not yet verified.`,
        400
      );
    }

    const updated = await prisma.test.update({
      where: { id: params.id },
      data: { status: "PUBLISHED" },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "TEST_PUBLISHED",
        entityType: "Test",
        entityId: params.id,
        metadata: {
          questionCount: totalQuestions,
          sectionsCount: test.sections.length,
          templateId: test.templateId,
        },
      },
    });

    return apiSuccess({ test: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
