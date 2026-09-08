import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    const canEnroll =
      (await hasPermission(session.user.id, PERMISSIONS.BATCH_UPDATE)) ||
      (await hasPermission(session.user.id, PERMISSIONS.STUDENT_UPDATE)) ||
      (await hasPermission(session.user.id, PERMISSIONS.USER_UPDATE));
    if (!canEnroll) return apiError("Forbidden: Enrollment permission required", 403);

    const body = await req.json();
    const { batchId } = body;

    if (!batchId) return apiError("Batch ID is required", 400);

    const student = await prisma.student.findUnique({
      where: { id: params.id },
    });
    if (!student) return apiError("Student not found", 404);

    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
    });
    if (!batch) return apiError("Batch not found", 404);

    const enrollment = await prisma.batchEnrollment.upsert({
      where: {
        batchId_studentId: {
          batchId,
          studentId: student.id,
        },
      },
      update: {
        status: "ACTIVE",
        droppedAt: null,
      },
      create: {
        batchId,
        studentId: student.id,
        status: "ACTIVE",
        enrolledById: session.user.id,
      },
      include: {
        batch: {
          select: {
            id: true,
            name: true,
            code: true,
            targetExam: true,
          },
        },
      },
    });

    return apiSuccess(enrollment);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    const canRevoke =
      (await hasPermission(session.user.id, PERMISSIONS.BATCH_UPDATE)) ||
      (await hasPermission(session.user.id, PERMISSIONS.STUDENT_UPDATE)) ||
      (await hasPermission(session.user.id, PERMISSIONS.USER_UPDATE));
    if (!canRevoke) return apiError("Forbidden: Permission required to revoke enrollment", 403);

    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get("batchId");

    if (!batchId) return apiError("Batch ID is required", 400);

    const student = await prisma.student.findUnique({
      where: { id: params.id },
    });
    if (!student) return apiError("Student not found", 404);

    const enrollment = await prisma.batchEnrollment.update({
      where: {
        batchId_studentId: {
          batchId,
          studentId: student.id,
        },
      },
      data: {
        status: "DROPPED",
        droppedAt: new Date(),
      },
    });

    return apiSuccess(enrollment);
  } catch (error) {
    return handleApiError(error);
  }
}
