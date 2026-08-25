import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { batchEnrollSchema } from "@/lib/validation/batch";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    await requirePermission(session?.user?.id, PERMISSIONS.BATCH_READ);

    const enrollments = await prisma.batchEnrollment.findMany({
      where: { batchId: params.id },
      include: { student: { include: { user: true } } },
      orderBy: { enrolledAt: "desc" },
    });

    return apiSuccess({ enrollments });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.BATCH_ENROLLMENT_MANAGE);

    const batch = await prisma.batch.findUnique({ where: { id: params.id } });
    if (!batch) return apiError("Batch not found", 404);

    const input = batchEnrollSchema.parse(await request.json());

    const student = await prisma.student.findUnique({ where: { id: input.studentId } });
    if (!student) return apiError("Student not found", 404);

    const existing = await prisma.batchEnrollment.findUnique({
      where: { batchId_studentId: { batchId: params.id, studentId: input.studentId } },
    });

    if (existing) {
      if (existing.status === "ACTIVE") {
        return apiError("This student is already enrolled in this batch.", 409);
      }
      // Re-enrolling a previously dropped/completed student — reactivate the same row
      // rather than violating the (batchId, studentId) unique constraint with a new one.
      const reactivated = await prisma.batchEnrollment.update({
        where: { id: existing.id },
        data: {
          status: "ACTIVE",
          enrolledById: session.user.id,
          enrolledAt: new Date(),
          droppedAt: null,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "BATCH_STUDENT_ENROLLED",
          entityType: "Batch",
          entityId: params.id,
          metadata: { studentId: input.studentId, reactivated: true },
        },
      });

      return apiSuccess({ enrollment: reactivated });
    }

    if (batch.capacity) {
      const activeCount = await prisma.batchEnrollment.count({
        where: { batchId: params.id, status: "ACTIVE" },
      });
      if (activeCount >= batch.capacity) {
        return apiError("This batch is at full capacity.", 409);
      }
    }

    const enrollment = await prisma.batchEnrollment.create({
      data: {
        batchId: params.id,
        studentId: input.studentId,
        enrolledById: session.user.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "BATCH_STUDENT_ENROLLED",
        entityType: "Batch",
        entityId: params.id,
        metadata: { studentId: input.studentId },
      },
    });

    return apiSuccess({ enrollment }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
