import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { batchEnrollmentStatusSchema } from "@/lib/validation/batch";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; studentId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.BATCH_ENROLLMENT_MANAGE);

    const existing = await prisma.batchEnrollment.findUnique({
      where: { batchId_studentId: { batchId: params.id, studentId: params.studentId } },
    });
    if (!existing) return apiError("This student isn't enrolled in this batch.", 404);

    const { status } = batchEnrollmentStatusSchema.parse(await request.json());

    const enrollment = await prisma.batchEnrollment.update({
      where: { id: existing.id },
      data: {
        status,
        droppedAt: status === "DROPPED" ? new Date() : null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "BATCH_ENROLLMENT_STATUS_CHANGED",
        entityType: "Batch",
        entityId: params.id,
        metadata: { studentId: params.studentId, status },
      },
    });

    return apiSuccess({ enrollment });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; studentId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.BATCH_ENROLLMENT_MANAGE);

    const deleted = await prisma.batchEnrollment.deleteMany({
      where: { batchId: params.id, studentId: params.studentId },
    });
    if (deleted.count === 0) {
      return apiError("This student isn't enrolled in this batch.", 404);
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "BATCH_STUDENT_UNENROLLED",
        entityType: "Batch",
        entityId: params.id,
        metadata: { studentId: params.studentId },
      },
    });

    return apiSuccess({ removed: true });
  } catch (error) {
    return handleApiError(error);
  }
}
