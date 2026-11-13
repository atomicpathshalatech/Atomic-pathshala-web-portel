import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { triggerNotificationEvent } from "@/lib/notifications/engine";
import { enqueueScheduledNotification } from "@/lib/notifications/scheduler";
import {
  NotificationType,
  NotificationCategory,
  NotificationPriority,
  NotificationTargetType,
} from "@/lib/notifications/types";
import { z } from "zod";

const quizActionSchema = z.object({
  testId: z.string(),
  action: z.enum(["REMIND_NOW", "ANNOUNCE_LIVE", "PUBLISH_RESULT", "SCHEDULE_REMINDER"]),
  reminderMinutesBefore: z.number().int().optional().default(15),
  scheduledTime: z.string().optional(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.NOTIFICATION_READ);

    const tests = await prisma.test.findMany({
      take: 30,
      orderBy: { createdAt: "desc" },
      include: {
        batchSchedule: {
          include: {
            batch: { select: { id: true, name: true, code: true } },
          },
        },
        _count: { select: { attempts: true } },
      },
    });

    return apiSuccess({ tests });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.NOTIFICATION_SEND);

    const body = await req.json();
    const { testId, action, reminderMinutesBefore, scheduledTime } = quizActionSchema.parse(body);

    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        batchSchedule: { select: { id: true, batchId: true, startsAt: true, title: true } },
      },
    });

    if (!test) return apiError("Test not found", 404);

    const batchId = test.batchSchedule?.batchId;
    const testName = test.name;

    if (action === "REMIND_NOW") {
      await triggerNotificationEvent({
        eventType: NotificationType.TEST_REMINDER_15_MIN,
        category: NotificationCategory.TESTS,
        priority: NotificationPriority.HIGH,
        entityId: test.id,
        testId: test.id,
        batchId: batchId || undefined,
        title: `Test Reminder: ${testName}`,
        body: `Your scheduled test "${testName}" is approaching. Ensure good connectivity.`,
        deepLink: `/test/${test.id}`,
        actionType: "VIEW_TEST",
        actionUrl: `/test/${test.id}`,
      });
      return apiSuccess({ message: "Test reminder sent successfully" });
    }

    if (action === "ANNOUNCE_LIVE") {
      await triggerNotificationEvent({
        eventType: NotificationType.TEST_STARTED,
        category: NotificationCategory.TESTS,
        priority: NotificationPriority.HIGH,
        entityId: test.id,
        testId: test.id,
        batchId: batchId || undefined,
        title: `🔴 Test is LIVE: ${testName}`,
        body: `Test "${testName}" is now active. Tap to start your attempt!`,
        deepLink: `/test/${test.id}`,
        actionType: "START_TEST",
        actionUrl: `/test/${test.id}`,
      });
      return apiSuccess({ message: "Test live alert sent to students" });
    }

    if (action === "PUBLISH_RESULT") {
      await triggerNotificationEvent({
        eventType: NotificationType.TEST_RESULT_AVAILABLE,
        category: NotificationCategory.TESTS,
        priority: NotificationPriority.HIGH,
        entityId: test.id,
        testId: test.id,
        batchId: batchId || undefined,
        title: `📊 Test Results Out: ${testName}`,
        body: `Results and detailed performance analysis for "${testName}" are now available. Check your scorecard!`,
        deepLink: `/test/${test.id}`,
        actionType: "VIEW_RESULTS",
        actionUrl: `/test/${test.id}`,
      });
      return apiSuccess({ message: "Test results announcement sent" });
    }

    if (action === "SCHEDULE_REMINDER" && scheduledTime) {
      const executeAt = new Date(scheduledTime);
      await enqueueScheduledNotification({
        eventType: NotificationType.TEST_REMINDER_15_MIN,
        entityId: test.id,
        targetType: batchId ? NotificationTargetType.BATCH : NotificationTargetType.USER,
        targetId: batchId,
        payload: {
          title: `Upcoming Test: ${testName}`,
          body: `Test starts in ${reminderMinutesBefore} minutes. Get ready!`,
          deepLink: `/test/${test.id}`,
          actionType: "VIEW_TEST",
          actionUrl: `/test/${test.id}`,
          category: NotificationCategory.TESTS,
          priority: NotificationPriority.HIGH,
          batchId: batchId || undefined,
        },
        executeAt,
        idempotencyKey: `custom-test-reminder:${test.id}:${executeAt.getTime()}`,
      });
      return apiSuccess({ message: `Reminder scheduled for ${executeAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}` });
    }

    return apiError("Invalid action requested", 400);
  } catch (err) {
    return handleApiError(err);
  }
}
