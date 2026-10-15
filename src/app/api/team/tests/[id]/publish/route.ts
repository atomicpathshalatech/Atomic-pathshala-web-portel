import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { canManageTest } from "@/lib/test-engine/access";
import { publishTestNow } from "@/lib/tests/scheduled-publish";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEST_PUBLISH);

    const test = await prisma.test.findUnique({ where: { id: params.id }, select: { batchScheduleId: true } });
    if (!test) return apiError("Test not found", 404);
    if (!(await canManageTest(session.user.id, test.batchScheduleId))) throw new ForbiddenError();

    // Same rules as the automatic publish at a test's set time (src/lib/tests/scheduled-publish.ts).
    const result = await publishTestNow(params.id, session.user.id);
    if (!result.ok) return apiError(result.error, result.status);
    const updated = await prisma.test.findUnique({ where: { id: params.id } });

    return apiSuccess({ test: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
