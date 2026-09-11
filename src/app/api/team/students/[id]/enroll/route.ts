import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { notifyEnrollment } from "@/lib/email/enrollment";

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
      include: { user: { select: { name: true, email: true } } },
    });
    if (!student) return apiError("Student not found", 404);

    const batch = await prisma.batch.findUnique({
      where: { id: batchId },
    });
    if (!batch) return apiError("Batch not found", 404);

    // Read before the upsert so we know whether this call actually *changes*
    // anything (new enrollment, or reactivating a dropped one) vs. is a
    // no-op re-submission of an already-ACTIVE enrollment — only the former
    // should trigger a welcome email.
    const existing = await prisma.batchEnrollment.findUnique({
      where: { batchId_studentId: { batchId, studentId: student.id } },
      select: { status: true },
    });
    const wasAlreadyActive = existing?.status === "ACTIVE";

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

    if (!wasAlreadyActive) {
      // Keyed by the BatchEnrollment row's own id, so a retried/duplicate
      // POST for the same activation is deduped; a later drop + re-enroll
      // reuses this same row (and so this same key) and is intentionally
      // treated as "already notified for this enrollment", not a fresh event.
      await notifyEnrollment({
        idempotencyKey: `enrollment:${enrollment.id}`,
        kind: "BATCH",
        studentUserId: student.userId,
        studentName: student.user.name,
        studentEmail: student.user.email,
        productName: enrollment.batch.name,
      });
    }

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
