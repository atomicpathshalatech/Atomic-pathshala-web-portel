import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; teacherId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.BATCH_UPDATE);

    const deleted = await prisma.batchTeacher.deleteMany({
      where: { batchId: params.id, teacherId: params.teacherId },
    });
    if (deleted.count === 0) {
      return apiError("This teacher isn't assigned to this batch.", 404);
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "BATCH_TEACHER_REMOVED",
        entityType: "Batch",
        entityId: params.id,
        metadata: { teacherId: params.teacherId },
      },
    });

    return apiSuccess({ removed: true });
  } catch (error) {
    return handleApiError(error);
  }
}
