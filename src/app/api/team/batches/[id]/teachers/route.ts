import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { batchTeacherAssignSchema } from "@/lib/validation/batch";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.BATCH_UPDATE);

    const batch = await prisma.batch.findUnique({ where: { id: params.id } });
    if (!batch) return apiError("Batch not found", 404);

    const input = batchTeacherAssignSchema.parse(await request.json());

    const teacher = await prisma.teacher.findUnique({ where: { id: input.teacherId } });
    if (!teacher) return apiError("Teacher not found", 404);

    const already = await prisma.batchTeacher.findFirst({
      where: { batchId: params.id, teacherId: input.teacherId, subject: input.subject || null },
    });
    if (already) {
      return apiError("This teacher is already assigned to this batch for this subject.", 409);
    }

    const assignment = await prisma.batchTeacher.create({
      data: {
        batchId: params.id,
        teacherId: input.teacherId,
        subject: input.subject || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "BATCH_TEACHER_ASSIGNED",
        entityType: "Batch",
        entityId: params.id,
        metadata: { teacherId: input.teacherId, subject: input.subject ?? null },
      },
    });

    return apiSuccess({ assignment }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
