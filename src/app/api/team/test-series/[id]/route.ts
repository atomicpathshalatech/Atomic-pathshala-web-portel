import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { testSeriesSchema } from "@/lib/validation/test-series";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    await requirePermission(session?.user?.id, PERMISSIONS.TEST_READ);

    const series = await prisma.testSeries.findUnique({
      where: { id: params.id },
      include: { tests: { orderBy: { createdAt: "desc" } } },
    });
    if (!series) return apiError("Test series not found", 404);

    return apiSuccess({ series });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEST_PUBLISH);

    const existing = await prisma.testSeries.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Test series not found", 404);

    const data = testSeriesSchema.partial().parse(await request.json());

    const series = await prisma.testSeries.update({
      where: { id: params.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description || null } : {}),
        ...(data.targetBatch !== undefined ? { targetBatch: data.targetBatch || null } : {}),
        ...(data.className !== undefined ? { className: data.className || null } : {}),
        ...(data.course !== undefined ? { course: data.course || null } : {}),
        ...(data.examType !== undefined ? { examType: data.examType || null } : {}),
        ...(data.tags !== undefined ? { tags: data.tags.length > 0 ? data.tags.join(",") : null } : {}),
        ...(data.visibility !== undefined ? { visibility: data.visibility } : {}),
        ...(data.startDate !== undefined ? { startDate: data.startDate ? new Date(data.startDate) : null } : {}),
        ...(data.endDate !== undefined ? { endDate: data.endDate ? new Date(data.endDate) : null } : {}),
      },
    });

    return apiSuccess({ series });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEST_PUBLISH);

    const existing = await prisma.testSeries.findUnique({
      where: { id: params.id },
      include: { _count: { select: { tests: true } } },
    });
    if (!existing) return apiError("Test series not found", 404);
    if (existing._count.tests > 0) {
      return apiError("Remove or reassign this series' tests before deleting it.", 409);
    }

    await prisma.testSeries.delete({ where: { id: params.id } });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
