import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { batchScheduleCreateSchema } from "@/lib/validation/batch";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    await requirePermission(session?.user?.id, PERMISSIONS.BATCH_READ);

    const schedules = await prisma.batchSchedule.findMany({
      where: { batchId: params.id },
      include: { teacher: { include: { user: true } } },
      orderBy: { startsAt: "asc" },
    });

    return apiSuccess({ schedules });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.BATCH_SCHEDULE_MANAGE);

    const batch = await prisma.batch.findUnique({ where: { id: params.id } });
    if (!batch) return apiError("Batch not found", 404);

    const input = batchScheduleCreateSchema.parse(await request.json());

    if (input.teacherId) {
      const teacher = await prisma.teacher.findUnique({ where: { id: input.teacherId } });
      if (!teacher) return apiError("Teacher not found", 404);
    }

    const schedule = await prisma.batchSchedule.create({
      data: {
        batchId: params.id,
        title: input.title,
        subject: input.subject || null,
        type: input.type,
        teacherId: input.teacherId || null,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        notes: input.notes || null,
        createdById: session.user.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "BATCH_SCHEDULE_CREATED",
        entityType: "Batch",
        entityId: params.id,
        metadata: { scheduleId: schedule.id, title: schedule.title },
      },
    });

    return apiSuccess({ schedule }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
