import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { regenerateCreativeAwaited } from "@/lib/creative/engine";

export const runtime = "nodejs";

export async function DELETE(_req: NextRequest, { params }: { params: { id: string; teacherId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEST_UPDATE);

    const deleted = await prisma.testSeriesTeacher.deleteMany({
      where: { testSeriesId: params.id, teacherId: params.teacherId },
    });
    if (deleted.count === 0) return apiError("This teacher isn't assigned to this test series.", 404);

    // Removed educator drops out of the test-series creative automatically (spec section 7).
    await regenerateCreativeAwaited("TEST_SERIES", params.id);

    return apiSuccess({ removed: true });
  } catch (error) {
    return handleApiError(error);
  }
}
