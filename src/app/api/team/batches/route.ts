import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { batchCreateSchema } from "@/lib/validation/batch";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import type { Prisma, BatchStatus } from "@prisma/client";
import { BATCH_STATUS_OPTIONS } from "@/lib/validation/batch";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    await requirePermission(session?.user?.id, PERMISSIONS.BATCH_READ);

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    const status =
      statusParam && (BATCH_STATUS_OPTIONS as readonly string[]).includes(statusParam)
        ? (statusParam as BatchStatus)
        : null;
    const q = searchParams.get("q")?.trim();

    const where: Prisma.BatchWhereInput = {
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { code: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const batches = await prisma.batch.findMany({
      where,
      include: {
        course: { select: { id: true, title: true } },
        _count: { select: { enrollments: true, teachers: true, schedules: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess({ batches });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.BATCH_CREATE);

    const input = batchCreateSchema.parse(await request.json());
    const code = input.code.toUpperCase();

    const codeTaken = await prisma.batch.findUnique({
      where: { code },
      select: { id: true },
    });
    if (codeTaken) {
      return apiError("A batch with this code already exists.", 409);
    }

    const batch = await prisma.$transaction(async (tx) => {
      const created = await tx.batch.create({
        data: {
          name: input.name,
          code,
          description: input.description || null,
          targetExam: input.targetExam || null,
          courseId: input.courseId || null,
          status: input.status,
          startDate: input.startDate ?? null,
          endDate: input.endDate ?? null,
          capacity: input.capacity ?? null,
          createdById: session.user.id,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: "BATCH_CREATED",
          entityType: "Batch",
          entityId: created.id,
          metadata: { code: created.code },
        },
      });

      return created;
    });

    return apiSuccess({ batch }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
