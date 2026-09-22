import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { canManageTest, getTestOr404 } from "@/lib/test-engine/access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEST_UPDATE);

    const test = await getTestOr404(params.id);
    if (!test) return apiError("Test not found", 404);
    if (!(await canManageTest(session.user.id, test.batchScheduleId))) throw new ForbiddenError();

    const body = await request.json();
    const { openTime, closeTime, durationMin } = body;

    const parsedOpenTime = openTime ? new Date(openTime) : null;
    const parsedCloseTime = closeTime ? new Date(closeTime) : null;

    if (parsedOpenTime && isNaN(parsedOpenTime.getTime())) {
      return apiError("Invalid start time format", 400);
    }
    if (parsedCloseTime && isNaN(parsedCloseTime.getTime())) {
      return apiError("Invalid end time format", 400);
    }
    if (parsedOpenTime && parsedCloseTime && parsedCloseTime <= parsedOpenTime) {
      return apiError("Close time must be strictly after open time", 400);
    }

    const updateData: any = {};
    if (openTime !== undefined) updateData.openTime = parsedOpenTime;
    if (closeTime !== undefined) updateData.closeTime = parsedCloseTime;
    if (durationMin !== undefined && typeof durationMin === "number" && durationMin > 0) {
      updateData.durationMin = durationMin;
    }

    const updatedTest = await prisma.test.update({
      where: { id: params.id },
      data: updateData,
    });

    // If attached to a batch schedule, also update batch schedule startsAt / endsAt
    if (updatedTest.batchScheduleId && parsedOpenTime) {
      const scheduleEndsAt =
        parsedCloseTime ||
        new Date(parsedOpenTime.getTime() + (updatedTest.durationMin || 180) * 60_000);

      await prisma.batchSchedule.update({
        where: { id: updatedTest.batchScheduleId },
        data: {
          startsAt: parsedOpenTime,
          endsAt: scheduleEndsAt,
        },
      });
    }

    // Also update any other batch schedules that link to this test
    if (parsedOpenTime) {
      const scheduleEndsAt =
        parsedCloseTime ||
        new Date(parsedOpenTime.getTime() + (updatedTest.durationMin || 180) * 60_000);

      await prisma.batchSchedule.updateMany({
        where: { test: { id: updatedTest.id } },
        data: {
          startsAt: parsedOpenTime,
          endsAt: scheduleEndsAt,
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "TEST_RESCHEDULED",
        entityType: "Test",
        entityId: updatedTest.id,
        metadata: {
          openTime: parsedOpenTime?.toISOString(),
          closeTime: parsedCloseTime?.toISOString(),
          durationMin: updatedTest.durationMin,
        },
      },
    });

    return apiSuccess({
      test: updatedTest,
      message: "Test rescheduled successfully",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
