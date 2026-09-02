import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { testSeriesStatusUpdateSchema } from "@/lib/validation/test-series";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEST_PUBLISH);

    const series = await prisma.testSeries.findUnique({
      where: { id: params.id },
      include: { tests: true },
    });

    if (!series) {
      return apiError("Test series not found", 404);
    }

    const body = await request.json();
    const { status } = testSeriesStatusUpdateSchema.parse(body);

    if (status === "ACTIVE" && series.tests.length === 0) {
      return apiError("Cannot activate a test series without any attached tests", 400);
    }

    const updated = await prisma.testSeries.update({
      where: { id: params.id },
      data: { status },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "TEST_SERIES_STATUS_UPDATE",
        entityType: "TestSeries",
        entityId: params.id,
        metadata: {
          previousStatus: series.status,
          newStatus: status,
        },
      },
    });

    return apiSuccess({ series: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
