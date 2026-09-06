import { prisma } from "@/lib/db";
import {
  NotificationType,
  NotificationChannel,
  EventTriggerInput,
  EngineDispatchResult,
  NotificationTargetType,
} from "./types";
import { sendPushToTokens } from "./fcm";
import { sendUserRealtimeNotification } from "./realtime";
import { enqueueScheduledNotification, cancelScheduledNotifications } from "./scheduler";

/**
 * Resolves recipient user IDs based on batch, course, or explicit IDs.
 */
export async function resolveRecipients(input: EventTriggerInput): Promise<string[]> {
  if (input.recipientUserIds && input.recipientUserIds.length > 0) {
    return Array.from(new Set(input.recipientUserIds));
  }

  // If batchId is provided, fetch all actively enrolled students
  if (input.batchId) {
    const enrollments = await prisma.batchEnrollment.findMany({
      where: { batchId: input.batchId, status: "ACTIVE" },
      include: { student: { select: { userId: true } } },
    });
    return enrollments.map((e) => e.student.userId).filter(Boolean);
  }

  // If classId/scheduleId is provided, resolve through BatchSchedule
  if (input.classId || (input.eventType.startsWith("CLASS_") && input.entityId)) {
    const scheduleId = input.classId || input.entityId;
    if (scheduleId) {
      const schedule = await prisma.batchSchedule.findUnique({
        where: { id: scheduleId },
        select: { batchId: true },
      });
      if (schedule?.batchId) {
        const enrollments = await prisma.batchEnrollment.findMany({
          where: { batchId: schedule.batchId, status: "ACTIVE" },
          include: { student: { select: { userId: true } } },
        });
        return enrollments.map((e) => e.student.userId).filter(Boolean);
      }
    }
  }

  // If testId is provided, resolve through Test / BatchSchedule
  if (input.testId || (input.eventType.startsWith("TEST_") && input.entityId)) {
    const testId = input.testId || input.entityId;
    if (testId) {
      const test = await prisma.test.findUnique({
        where: { id: testId },
        select: { batchScheduleId: true },
      });
      if (test?.batchScheduleId) {
        const schedule = await prisma.batchSchedule.findUnique({
          where: { id: test.batchScheduleId },
          select: { batchId: true },
        });
        if (schedule?.batchId) {
          const enrollments = await prisma.batchEnrollment.findMany({
            where: { batchId: schedule.batchId, status: "ACTIVE" },
            include: { student: { select: { userId: true } } },
          });
          return enrollments.map((e) => e.student.userId).filter(Boolean);
        }
      }
    }
  }

  // If chapterId is provided (e.g. for DPPs or Notices), resolve through course/batches
  if (input.chapterId) {
    const chapter = await prisma.chapter.findUnique({
      where: { id: input.chapterId },
      include: {
        subject: {
          include: {
            course: {
              include: {
                batches: {
                  include: {
                    enrollments: {
                      where: { status: "ACTIVE" },
                      include: { student: { select: { userId: true } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (chapter?.subject?.course?.batches) {
      const userIds = new Set<string>();
      for (const b of chapter.subject.course.batches) {
        for (const enr of b.enrollments) {
          if (enr.student?.userId) {
            userIds.add(enr.student.userId);
          }
        }
      }
      return Array.from(userIds);
    }
  }

  return [];
}

/**
 * Filter recipient IDs according to their NotificationPreferences and quiet hours.
 */
async function filterByPreferences(
  userIds: string[],
  eventType: NotificationType
): Promise<{ inAppRecipients: string[]; pushRecipients: string[] }> {
  if (userIds.length === 0) {
    return { inAppRecipients: [], pushRecipients: [] };
  }

  const prefs = await prisma.notificationPreference.findMany({
    where: { userId: { in: userIds } },
  });

  const prefMap = new Map(prefs.map((p) => [p.userId, p]));
  const inAppRecipients: string[] = [];
  const pushRecipients: string[] = [];

  const now = new Date();
  const currentHoursMinutes = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  for (const userId of userIds) {
    const p = prefMap.get(userId);

    // If no preference saved yet, default is everything allowed
    if (!p) {
      inAppRecipients.push(userId);
      pushRecipients.push(userId);
      continue;
    }

    // Check category preferences
    let categoryAllowed = true;
    if (eventType.startsWith("CLASS_") && !p.classes) categoryAllowed = false;
    else if (eventType.startsWith("TEST_") && !p.tests) categoryAllowed = false;
    else if (eventType.startsWith("DPP_") && !p.dpps) categoryAllowed = false;
    else if ((eventType === NotificationType.ANNOUNCEMENT_CREATED || eventType === NotificationType.NOTICE_CREATED) && !p.announcements) categoryAllowed = false;
    else if (eventType === NotificationType.DAILY_TARGET && !p.dailyTargets) categoryAllowed = false;

    if (!categoryAllowed) continue;

    if (p.inAppEnabled) {
      inAppRecipients.push(userId);
    }

    // Check quiet hours for push
    let quietActive = false;
    if (p.quietHoursEnabled && p.quietHoursStart && p.quietHoursEnd) {
      if (p.quietHoursStart <= p.quietHoursEnd) {
        quietActive = currentHoursMinutes >= p.quietHoursStart && currentHoursMinutes <= p.quietHoursEnd;
      } else {
        // e.g. 22:00 to 07:00
        quietActive = currentHoursMinutes >= p.quietHoursStart || currentHoursMinutes <= p.quietHoursEnd;
      }
    }

    if (p.pushEnabled && !quietActive) {
      pushRecipients.push(userId);
    }
  }

  return { inAppRecipients, pushRecipients };
}

/**
 * The Central Notification Engine.
 * Decouples business events from delivery channels, recipient resolution, and scheduling.
 */
export async function triggerNotificationEvent(
  input: EventTriggerInput
): Promise<EngineDispatchResult> {
  const now = new Date();

  // 1. If this event is scheduled for the future, enqueue into backend scheduler queue
  if (input.scheduledFor && input.scheduledFor.getTime() > now.getTime() + 1000) {
    await enqueueScheduledNotification({
      eventType: input.eventType,
      entityId: input.entityId,
      targetType: input.batchId ? NotificationTargetType.BATCH : NotificationTargetType.USER,
      targetId: input.batchId || input.recipientUserIds?.[0],
      payload: {
        title: input.title,
        body: input.body,
        deepLink: input.deepLink,
        metadata: input.metadata,
        batchId: input.batchId,
        courseId: input.courseId,
        channel: typeof input.channel === "string" ? input.channel : undefined,
      },
      executeAt: input.scheduledFor,
      idempotencyKey: input.idempotencyKey,
    });

    return { dispatchedCount: 0, scheduled: true, skipped: false };
  }

  // 2. Resolve target recipients
  const recipientUserIds = await resolveRecipients(input);
  if (recipientUserIds.length === 0) {
    return { dispatchedCount: 0, scheduled: false, skipped: true, reason: "No eligible recipients resolved" };
  }

  // 3. Filter recipients based on user preferences
  const { inAppRecipients, pushRecipients } = await filterByPreferences(
    recipientUserIds,
    input.eventType
  );

  let createdNotifications: Array<{ id: string; userId: string }> = [];

  // 4. Create In-App Notification records (with duplicate prevention)
  if (inAppRecipients.length > 0) {
    const notificationsToCreate = inAppRecipients.map((userId) => ({
      userId,
      title: input.title,
      body: input.body,
      type: input.eventType,
      channel: NotificationChannel.IN_APP,
      deepLink: input.deepLink || null,
      metadata: input.metadata ? input.metadata : undefined,
      idempotencyKey: input.idempotencyKey ? `${input.idempotencyKey}:${userId}` : undefined,
    }));

    for (const item of notificationsToCreate) {
      try {
        if (item.idempotencyKey) {
          const existing = await prisma.notification.findUnique({
            where: { idempotencyKey: item.idempotencyKey },
            select: { id: true, userId: true },
          });
          if (existing) continue; // Skip duplicate
        }

        const created = await prisma.notification.create({
          data: item,
          select: { id: true, userId: true },
        });
        createdNotifications.push(created);
      } catch (err: any) {
        // Unique constraint violation on idempotencyKey handled gracefully
        if (err?.code !== "P2002") {
          console.error("[Notification DB Create Error]", err);
        }
      }
    }
  }

  // 5. Trigger Pusher in-app realtime updates
  for (const created of createdNotifications) {
    const unreadCount = await prisma.notification.count({
      where: { userId: created.userId, isRead: false },
    });

    sendUserRealtimeNotification(created.userId, {
      id: created.id,
      title: input.title,
      body: input.body,
      type: input.eventType,
      deepLink: input.deepLink,
      createdAt: now.toISOString(),
      unreadCount,
      metadata: input.metadata,
    }).catch(() => null);
  }

  // 6. Deliver Push Notifications via FCM
  if (pushRecipients.length > 0) {
    const devices = await prisma.userDevice.findMany({
      where: {
        userId: { in: pushRecipients },
        isActive: true,
      },
      select: { fcmToken: true },
    });

    const tokens = devices.map((d) => d.fcmToken);
    if (tokens.length > 0) {
      sendPushToTokens(tokens, {
        title: input.title,
        body: input.body,
        deepLink: input.deepLink,
        priority: input.priority || "high",
        metadata: input.metadata,
        data: {
          eventType: input.eventType,
          deepLink: input.deepLink || "",
          entityId: input.entityId || "",
        },
      }).catch((fcmErr) => {
        console.error("[Engine FCM Push Error]", fcmErr);
      });
    }
  }

  // 7. Automatic companion scheduling:
  // When a class is scheduled, automatically queue its 15m reminder!
  if (input.eventType === NotificationType.CLASS_SCHEDULED && input.entityId && input.metadata?.startsAt) {
    const startsAt = new Date(input.metadata.startsAt);
    const reminderTime = new Date(startsAt.getTime() - 15 * 60 * 1000);

    if (reminderTime.getTime() > now.getTime()) {
      await enqueueScheduledNotification({
        eventType: NotificationType.CLASS_REMINDER_15_MIN,
        entityId: input.entityId,
        targetType: input.batchId ? NotificationTargetType.BATCH : NotificationTargetType.USER,
        targetId: input.batchId,
        payload: {
          title: `Class starting in 15 minutes: ${input.metadata.className || input.title}`,
          body: "Get ready! Keep your notebook and pen handy. Class starts soon.",
          deepLink: input.deepLink,
          batchId: input.batchId,
          metadata: {
            classId: input.entityId,
            startsAt: startsAt.toISOString(),
          },
        },
        executeAt: reminderTime,
        idempotencyKey: `class-reminder-15m:${input.entityId}`,
      });
    }
  }

  // When a test is scheduled, automatically queue its 15m reminder!
  if (input.eventType === NotificationType.TEST_SCHEDULED && input.entityId && input.metadata?.openTime) {
    const openTime = new Date(input.metadata.openTime);
    const reminderTime = new Date(openTime.getTime() - 15 * 60 * 1000);

    if (reminderTime.getTime() > now.getTime()) {
      await enqueueScheduledNotification({
        eventType: NotificationType.TEST_REMINDER_15_MIN,
        entityId: input.entityId,
        targetType: input.batchId ? NotificationTargetType.BATCH : NotificationTargetType.USER,
        targetId: input.batchId,
        payload: {
          title: `Test starting in 15 minutes: ${input.metadata.testName || input.title}`,
          body: "Stay in a quiet place and ensure your device is charged. Your test begins shortly.",
          deepLink: input.deepLink,
          metadata: {
            testId: input.entityId,
            openTime: openTime.toISOString(),
          },
        },
        executeAt: reminderTime,
        idempotencyKey: `test-reminder-15m:${input.entityId}`,
      });
    }
  }

  return {
    dispatchedCount: inAppRecipients.length,
    scheduled: false,
    skipped: false,
  };
}
