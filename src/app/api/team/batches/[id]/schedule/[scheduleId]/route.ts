import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { batchScheduleUpdateSchema } from "@/lib/validation/batch";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; scheduleId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.BATCH_SCHEDULE_MANAGE);

    const existing = await prisma.batchSchedule.findFirst({
      where: { id: params.scheduleId, batchId: params.id },
    });
    if (!existing) return apiError("Schedule entry not found", 404);

    const input = batchScheduleUpdateSchema.parse(await request.json());

    if (input.teacherId) {
      const teacher = await prisma.teacher.findUnique({ where: { id: input.teacherId } });
      if (!teacher) return apiError("Teacher not found", 404);
    }

    const schedule = await prisma.batchSchedule.update({
      where: { id: params.scheduleId },
      data: {
        title: input.title,
        subject: input.subject || null,
        type: input.type,
        status: input.status,
        teacherId: input.teacherId || null,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        notes: input.notes || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "BATCH_SCHEDULE_UPDATED",
        entityType: "Batch",
        entityId: params.id,
        metadata: { scheduleId: schedule.id },
      },
    });

    return apiSuccess({ schedule });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; scheduleId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.BATCH_SCHEDULE_MANAGE);

    const deleted = await prisma.batchSchedule.deleteMany({
      where: { id: params.scheduleId, batchId: params.id },
    });
    if (deleted.count === 0) return apiError("Schedule entry not found", 404);

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "BATCH_SCHEDULE_DELETED",
        entityType: "Batch",
        entityId: params.id,
        metadata: { scheduleId: params.scheduleId },
      },
    });

    return apiSuccess({ removed: true });
  } catch (error) {
    return handleApiError(error);
  }
}
