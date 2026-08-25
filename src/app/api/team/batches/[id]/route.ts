import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { batchUpdateSchema } from "@/lib/validation/batch";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    await requirePermission(session?.user?.id, PERMISSIONS.BATCH_READ);

    const batch = await prisma.batch.findUnique({
      where: { id: params.id },
      include: {
        course: { select: { id: true, title: true } },
        teachers: { include: { teacher: { include: { user: true } } } },
        enrollments: {
          include: { student: { include: { user: true } } },
          orderBy: { enrolledAt: "desc" },
        },
        schedules: {
          include: { teacher: { include: { user: true } } },
          orderBy: { startsAt: "asc" },
        },
      },
    });
    if (!batch) return apiError("Batch not found", 404);

    return apiSuccess({ batch });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.BATCH_UPDATE);

    const existing = await prisma.batch.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Batch not found", 404);

    const data = batchUpdateSchema.parse(await request.json());
    const code = data.code.toUpperCase();

    if (code !== existing.code) {
      const codeTaken = await prisma.batch.findUnique({
        where: { code },
        select: { id: true },
      });
      if (codeTaken) return apiError("A batch with this code already exists.", 409);
    }

    const batch = await prisma.batch.update({
      where: { id: params.id },
      data: {
        name: data.name,
        code,
        description: data.description || null,
        targetExam: data.targetExam || null,
        courseId: data.courseId || null,
        status: data.status,
        startDate: data.startDate ?? null,
        endDate: data.endDate ?? null,
        capacity: data.capacity ?? null,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "BATCH_UPDATED",
        entityType: "Batch",
        entityId: batch.id,
      },
    });

    return apiSuccess({ batch });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.BATCH_DELETE);

    const existing = await prisma.batch.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Batch not found", 404);

    await prisma.batch.delete({ where: { id: params.id } });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "BATCH_DELETED",
        entityType: "Batch",
        entityId: params.id,
        metadata: { code: existing.code },
      },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
