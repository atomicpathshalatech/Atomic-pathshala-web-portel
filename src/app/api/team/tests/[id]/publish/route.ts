import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { canManageTest, getTestOr404 } from "@/lib/test-engine/access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/** Publishing is gated behind TEST_PUBLISH — admin tier only, even though a
 * teacher can create/edit a draft. This mirrors Question verification
 * (QUESTION_VERIFY is separate from QUESTION_CREATE): a second pair of eyes
 * before something goes live to students. */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEST_PUBLISH);

    const test = await getTestOr404(params.id);
    if (!test) return apiError("Test not found", 404);
    if (!(await canManageTest(session.user.id, test.batchScheduleId))) throw new ForbiddenError();
    if (test.status !== "DRAFT") return apiError("This test has already been published.", 409);

    const questionCount = await prisma.testQuestion.count({ where: { testId: params.id } });
    if (questionCount === 0) {
      return apiError("Add at least one question before publishing.", 400);
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
        metadata: { questionCount },
      },
    });

    return apiSuccess({ test: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
