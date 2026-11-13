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

    // Automatically sync updated test schedule & syllabus to all batches where this test series was imported
    if (updatedTest.testSeriesId) {
      try {
        const { syncTestSyllabusToBatches } = await import("@/lib/batch/test-syllabus-sync");
        await syncTestSyllabusToBatches({
          testId: updatedTest.id,
          testSeriesId: updatedTest.testSeriesId,
        });
      } catch (syncErr) {
        console.error("[RescheduleTest] Syllabus sync error:", syncErr);
      }
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

    // Central Notification Engine: Trigger TEST_RESCHEDULED and update 15m reminder
    if (parsedOpenTime) {
      try {
        const { triggerNotificationEvent } = await import("@/lib/notifications/engine");
        const { cancelScheduledNotifications, enqueueScheduledNotification } = await import("@/lib/notifications/scheduler");
        const { NotificationType, NotificationCategory, NotificationPriority, NotificationTargetType } = await import("@/lib/notifications/types");

        // Cancel old scheduled reminders
        await cancelScheduledNotifications(NotificationType.TEST_REMINDER_15_MIN, updatedTest.id);
        await cancelScheduledNotifications(NotificationType.TEST_STARTED, updatedTest.id);

        const timeStr = parsedOpenTime.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
        const dateStr = parsedOpenTime.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", month: "short", day: "numeric" });

        // Trigger reschedule alert
        await triggerNotificationEvent({
          eventType: NotificationType.TEST_SCHEDULED,
          category: NotificationCategory.TESTS,
          priority: NotificationPriority.HIGH,
          entityId: updatedTest.id,
          testId: updatedTest.id,
          title: `Test Rescheduled: ${updatedTest.name}`,
          body: `Test "${updatedTest.name}" timing updated to ${dateStr} at ${timeStr}.`,
          deepLink: `/test/${updatedTest.id}`,
          actionType: "VIEW_TEST",
          actionUrl: `/test/${updatedTest.id}`,
          metadata: {
            testId: updatedTest.id,
            testName: updatedTest.name,
            openTime: parsedOpenTime.toISOString(),
          },
        });

        // Re-enqueue new 15m reminder
        const now = new Date();
        const reminderTime = new Date(parsedOpenTime.getTime() - 15 * 60 * 1000);
        if (reminderTime.getTime() > now.getTime()) {
          await enqueueScheduledNotification({
            eventType: NotificationType.TEST_REMINDER_15_MIN,
            entityId: updatedTest.id,
            targetType: NotificationTargetType.USER,
            payload: {
              title: `Test starts in 15 minutes!`,
              body: `${updatedTest.name} starts shortly. Ensure a quiet study environment.`,
              deepLink: `/test/${updatedTest.id}`,
              actionType: "VIEW_TEST",
              actionUrl: `/test/${updatedTest.id}`,
              category: NotificationCategory.TESTS,
              priority: NotificationPriority.HIGH,
              metadata: {
                testId: updatedTest.id,
                testName: updatedTest.name,
                openTime: parsedOpenTime.toISOString(),
              },
            },
            executeAt: reminderTime,
            idempotencyKey: `test-reminder-15m:${updatedTest.id}:${parsedOpenTime.getTime()}`,
          });
        }
      } catch (notifErr) {
        console.warn("[TestRescheduleNotification Warning]", notifErr);
      }
    }

    return apiSuccess({
      test: updatedTest,
      message: "Test rescheduled successfully",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
