import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { canManageTest, getTestOr404 } from "@/lib/test-engine/access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; testQuestionId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEST_UPDATE);

    const test = await getTestOr404(params.id);
    if (!test) return apiError("Test not found", 404);
    if (!(await canManageTest(session.user.id, test.batchScheduleId))) throw new ForbiddenError();
    if (test.status !== "DRAFT") return apiError("Only draft tests can have questions removed.", 409);

    const deleted = await prisma.testQuestion.deleteMany({
      where: { id: params.testQuestionId, testId: params.id },
    });
    if (deleted.count === 0) return apiError("Question not found on this test", 404);

    return apiSuccess({ removed: true });
  } catch (error) {
    return handleApiError(error);
  }
}
