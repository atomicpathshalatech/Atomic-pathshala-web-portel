import { prisma } from "@/lib/db";
import {
  NotificationType,
  NotificationCategory,
  NotificationPriority,
  NotificationStatus,
  NotificationChannel,
  EventTriggerInput,
  EngineDispatchResult,
  NotificationTargetType,
} from "./types";
import { sendPushToTokens } from "./fcm";
import { sendUserRealtimeNotification } from "./realtime";
import { sendWebPushToUser } from "./webPushServer";
import { enqueueScheduledNotification, cancelScheduledNotifications } from "./scheduler";

export function deriveCategory(type: NotificationType): NotificationCategory {
  if (
    type === NotificationType.CLASS_SCHEDULED ||
    type === NotificationType.CLASS_REMINDER_15_MIN ||
    type === NotificationType.CLASS_LIVE ||
    type === NotificationType.CLASS_STARTED ||
    type === NotificationType.LIVE_CLASS_STARTED ||
    type === NotificationType.CLASS_RESCHEDULED ||
    type === NotificationType.CLASS_CANCELLED ||
    type === NotificationType.CLASS_DELETED ||
    type === NotificationType.CLASS_ENDED
  ) {
    return NotificationCategory.CLASSES;
  }
  if (
    type === NotificationType.TEST_SCHEDULED ||
    type === NotificationType.TEST_REMINDER_15_MIN ||
    type === NotificationType.TEST_LIVE ||
    type === NotificationType.TEST_STARTED ||
    type === NotificationType.TEST_ENDED ||
    type === NotificationType.TEST_RESULT_AVAILABLE
  ) {
    return NotificationCategory.TESTS;
  }
  if (
    type === NotificationType.DPP_UPLOADED ||
    type === NotificationType.DPP_QUESTION_ADDED ||
    type === NotificationType.DPP_SUBMITTED ||
    type === NotificationType.NEW_DPP ||
    type === NotificationType.NEW_PDF ||
    type === NotificationType.NEW_PPT ||
    type === NotificationType.NEW_STUDY_MATERIAL ||
    type === NotificationType.PDF_UPLOADED ||
    type === NotificationType.MODULE_UPLOADED
  ) {
    return NotificationCategory.STUDY_MATERIAL;
  }
  if (
    type === NotificationType.OFFER_CREATED ||
    type === NotificationType.PROMOTIONAL_SCHEDULED
  ) {
    return NotificationCategory.OFFERS;
  }
  if (type === NotificationType.DAILY_MOTIVATION) {
    return NotificationCategory.MOTIVATION;
  }
  return NotificationCategory.SYSTEM;
}

export function derivePriority(
  type: NotificationType,
  requested?: NotificationPriority | "normal" | "high" | "low" | "urgent" | string
): NotificationPriority {
  const reqStr = requested ? String(requested).toUpperCase() : undefined;
  if (reqStr === "URGENT") return NotificationPriority.URGENT;
  if (reqStr === "HIGH") return NotificationPriority.HIGH;
  if (reqStr === "LOW") return NotificationPriority.LOW;
  if (
    type === NotificationType.LIVE_CLASS_STARTED ||
    type === NotificationType.CLASS_LIVE ||
    type === NotificationType.CLASS_REMINDER_15_MIN ||
    type === NotificationType.TEST_REMINDER_15_MIN
  ) {
    return NotificationPriority.HIGH;
  }
  if (type === NotificationType.SYSTEM_ANNOUNCEMENT) {
    return NotificationPriority.URGENT;
  }
  return NotificationPriority.NORMAL;
}

export function interpolateVariables(
  text: string,
  vars: Record<string, string | undefined>
): string {
  let result = text;
  for (const [key, value] of Object.entries(vars)) {
    if (value !== undefined) {
      result = result.replace(new RegExp(`{{\\s*${key}\\s*}}`, "g"), value);
    }
  }
  return result;
}

/**
 * Resolves recipient user IDs strictly scoped to batch, course, or role.
 */
export async function resolveRecipients(input: EventTriggerInput): Promise<string[]> {
  if (input.recipientUserIds && input.recipientUserIds.length > 0) {
    return Array.from(new Set(input.recipientUserIds));
  }

  // If batchId is provided, fetch all actively enrolled students of that batch ONLY
  if (input.batchId) {
    const enrollments = await prisma.batchEnrollment.findMany({
      where: { batchId: input.batchId, status: "ACTIVE" },
      include: { student: { select: { userId: true } } },
    });
    return Array.from(new Set(enrollments.map((e) => e.student.userId).filter(Boolean)));
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
        return Array.from(new Set(enrollments.map((e) => e.student.userId).filter(Boolean)));
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
          return Array.from(new Set(enrollments.map((e) => e.student.userId).filter(Boolean)));
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
  category: NotificationCategory,
  priority: NotificationPriority
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

    if (!p) {
      inAppRecipients.push(userId);
      pushRecipients.push(userId);
      continue;
    }

    // URGENT priority bypasses category mute
    let categoryAllowed = priority === NotificationPriority.URGENT;
    if (!categoryAllowed) {
      if (category === NotificationCategory.CLASSES && p.classes) categoryAllowed = true;
      else if (category === NotificationCategory.TESTS && p.tests) categoryAllowed = true;
      else if (category === NotificationCategory.STUDY_MATERIAL && (p.studyMaterial ?? p.dpps)) categoryAllowed = true;
      else if (category === NotificationCategory.OFFERS && (p.offers ?? true)) categoryAllowed = true;
      else if (category === NotificationCategory.MOTIVATION && (p.motivation ?? true)) categoryAllowed = true;
      else if (category === NotificationCategory.SYSTEM && p.announcements) categoryAllowed = true;
    }

    if (!categoryAllowed) continue;

    if (p.inAppEnabled) {
      inAppRecipients.push(userId);
    }

    let quietActive = false;
    if (p.quietHoursEnabled && p.quietHoursStart && p.quietHoursEnd) {
      if (p.quietHoursStart <= p.quietHoursEnd) {
        quietActive = currentHoursMinutes >= p.quietHoursStart && currentHoursMinutes <= p.quietHoursEnd;
      } else {
        quietActive = currentHoursMinutes >= p.quietHoursStart || currentHoursMinutes <= p.quietHoursEnd;
      }
    }

    if (p.pushEnabled && (!quietActive || priority === NotificationPriority.URGENT)) {
      pushRecipients.push(userId);
    }
  }

  return { inAppRecipients, pushRecipients };
}

/**
 * The Central Notification Engine.
 */
export async function triggerNotificationEvent(
  input: EventTriggerInput
): Promise<EngineDispatchResult> {
  const now = new Date();
  const category = input.category || deriveCategory(input.eventType);
  const priority = derivePriority(input.eventType, input.priority);

  // Check rule table: if rule is disabled, skip dispatch
  try {
    const rule = await prisma.notificationRule.findUnique({
      where: { eventType: input.eventType },
    });
    if (rule && !rule.isEnabled) {
      return { dispatchedCount: 0, scheduled: false, skipped: true, reason: `Rule ${input.eventType} is disabled` };
    }
  } catch {
    // Ignore if rule table query fails
  }

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
        icon: input.icon,
        image: input.image,
        actionType: input.actionType,
        actionUrl: input.actionUrl || input.deepLink,
        category,
        priority,
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

  // 3. Filter recipients based on user preferences & quiet hours
  const { inAppRecipients, pushRecipients } = await filterByPreferences(
    recipientUserIds,
    category,
    priority
  );

  // Fetch student/user names for dynamic variable replacement
  const users = await prisma.user.findMany({
    where: { id: { in: recipientUserIds } },
    select: { id: true, name: true },
  });
  const userNameMap = new Map(users.map((u) => [u.id, u.name]));

  let createdNotifications: Array<{ id: string; userId: string; title: string; body: string }> = [];

  // 4. Create In-App Notification records (with duplicate prevention via idempotency keys)
  if (inAppRecipients.length > 0) {
    for (const userId of inAppRecipients) {
      const studentName = userNameMap.get(userId) || "Student";
      const vars = {
        student_name: studentName,
        batch_name: input.metadata?.batchName || "",
        teacher_name: input.metadata?.teacherName || "",
        class_name: input.metadata?.className || input.title,
        class_date: input.metadata?.startsAt ? new Date(input.metadata.startsAt).toLocaleDateString("en-IN") : "",
        class_time: input.metadata?.startsAt ? new Date(input.metadata.startsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
        test_name: input.metadata?.testName || input.title,
        test_time: input.metadata?.openTime ? new Date(input.metadata.openTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "",
        course_name: input.metadata?.courseName || "",
      };

      const title = interpolateVariables(input.title, vars);
      const body = interpolateVariables(input.body, vars);
      const userKey = input.idempotencyKey ? `${input.idempotencyKey}:${userId}` : undefined;

      try {
        if (userKey) {
          const existing = await prisma.notification.findUnique({
            where: { idempotencyKey: userKey },
            select: { id: true, userId: true },
          });
          if (existing) continue; // Skip duplicate!
        }

        const created = await prisma.notification.create({
          data: {
            userId,
            title,
            body,
            type: input.eventType,
            category,
            priority,
            channel: NotificationChannel.IN_APP,
            deepLink: input.deepLink || input.actionUrl || null,
            icon: input.icon || null,
            image: input.image || null,
            actionType: input.actionType || null,
            actionUrl: input.actionUrl || input.deepLink || null,
            entityType: input.classId ? "BatchSchedule" : input.testId ? "Test" : input.batchId ? "Batch" : null,
            entityId: input.entityId || input.classId || input.testId || null,
            batchId: input.batchId || null,
            courseId: input.courseId || null,
            createdById: input.createdById || null,
            sentAt: now,
            status: NotificationStatus.SENT,
            metadata: input.metadata || undefined,
            idempotencyKey: userKey,
          },
          select: { id: true, userId: true },
        });

        // Audit in notification deliveries table
        await prisma.notificationDelivery.create({
          data: {
            notificationId: created.id,
            userId,
            channel: "IN_APP",
            status: "DELIVERED",
            deliveredAt: now,
          },
        }).catch(() => {});

        createdNotifications.push({ id: created.id, userId, title, body });
      } catch (err: any) {
        if (err?.code !== "P2002") {
          console.error("[Notification DB Create Error]", err);
        }
      }
    }
  }

  // 5. Trigger Pusher in-app realtime updates (non-blocking toast & counter)
  for (const item of createdNotifications) {
    const unreadCount = await prisma.notification.count({
      where: { userId: item.userId, isRead: false },
    });

    sendUserRealtimeNotification(item.userId, {
      id: item.id,
      title: item.title,
      body: item.body,
      type: input.eventType,
      deepLink: input.deepLink || input.actionUrl || null,
      createdAt: now.toISOString(),
      unreadCount,
      metadata: {
        ...input.metadata,
        category,
        priority,
        icon: input.icon,
        actionType: input.actionType,
        actionUrl: input.actionUrl || input.deepLink,
      },
    }).catch(() => null);
  }

  // 6. Deliver Browser Web Push & FCM
  if (pushRecipients.length > 0) {
    // Deliver via standard Web Push (VAPID) to browser clients
    for (const userId of pushRecipients) {
      sendWebPushToUser(userId, {
        title: input.title,
        body: input.body,
        deepLink: input.deepLink || input.actionUrl || "/",
        icon: input.icon || "/icons/icon-192.png",
        priority,
      }).catch((err) => console.warn("[WebPush Dispatch Error]", err));
    }

    // Deliver via FCM to mobile devices
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
        deepLink: input.deepLink || input.actionUrl || "/",
        priority: priority === NotificationPriority.HIGH || priority === NotificationPriority.URGENT ? "high" : "normal",
        metadata: input.metadata,
        data: {
          eventType: input.eventType,
          deepLink: input.deepLink || input.actionUrl || "",
          entityId: input.entityId || "",
          actionType: input.actionType || "",
          category,
        },
      }).catch((fcmErr) => {
        console.error("[Engine FCM Push Error]", fcmErr);
      });
    }
  }

  // 7. Automatic companion scheduling:
  // When a class is scheduled, automatically queue:
  // a) its 15m reminder!
  // b) its start notification at startsAt!
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
          title: `Class starting in 15 minutes!`,
          body: `${input.metadata.className || input.title} starts in 15 minutes. Keep your notes ready.`,
          deepLink: input.deepLink || `/live-class/${input.entityId}`,
          actionType: "JOIN_CLASS",
          actionUrl: input.deepLink || `/live-class/${input.entityId}`,
          category: NotificationCategory.CLASSES,
          priority: NotificationPriority.HIGH,
          batchId: input.batchId,
          metadata: {
            classId: input.entityId,
            className: input.metadata.className || input.title,
            startsAt: startsAt.toISOString(),
          },
        },
        executeAt: reminderTime,
        idempotencyKey: `class-reminder-15m:${input.entityId}`,
      });
    }

    if (startsAt.getTime() > now.getTime()) {
      await enqueueScheduledNotification({
        eventType: NotificationType.CLASS_STARTED,
        entityId: input.entityId,
        targetType: input.batchId ? NotificationTargetType.BATCH : NotificationTargetType.USER,
        targetId: input.batchId,
        payload: {
          title: `Class started!`,
          body: `Your live class "${input.metadata.className || input.title}" has started. Join now!`,
          deepLink: input.deepLink || `/live-class/${input.entityId}`,
          actionType: "JOIN_CLASS",
          actionUrl: input.deepLink || `/live-class/${input.entityId}`,
          category: NotificationCategory.CLASSES,
          priority: NotificationPriority.HIGH,
          batchId: input.batchId,
          metadata: {
            classId: input.entityId,
            className: input.metadata.className || input.title,
            startsAt: startsAt.toISOString(),
          },
        },
        executeAt: startsAt,
        idempotencyKey: `class-started:${input.entityId}`,
      });
    }
  }

  // When a test is scheduled, queue 15m reminder and test started notification!
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
          title: `Test starts in 15 minutes!`,
          body: `${input.metadata.testName || input.title} starts shortly. Ensure a quiet study environment.`,
          deepLink: input.deepLink || `/test/${input.entityId}`,
          actionType: "VIEW_TEST",
          actionUrl: input.deepLink || `/test/${input.entityId}`,
          category: NotificationCategory.TESTS,
          priority: NotificationPriority.HIGH,
          metadata: {
            testId: input.entityId,
            testName: input.metadata.testName || input.title,
            openTime: openTime.toISOString(),
          },
        },
        executeAt: reminderTime,
        idempotencyKey: `test-reminder-15m:${input.entityId}`,
      });
    }

    if (openTime.getTime() > now.getTime()) {
      await enqueueScheduledNotification({
        eventType: NotificationType.TEST_STARTED,
        entityId: input.entityId,
        targetType: input.batchId ? NotificationTargetType.BATCH : NotificationTargetType.USER,
        targetId: input.batchId,
        payload: {
          title: `Test is now LIVE!`,
          body: `${input.metadata.testName || input.title} is now open. Start your test.`,
          deepLink: input.deepLink || `/test/${input.entityId}`,
          actionType: "START_TEST",
          actionUrl: input.deepLink || `/test/${input.entityId}`,
          category: NotificationCategory.TESTS,
          priority: NotificationPriority.HIGH,
          metadata: {
            testId: input.entityId,
            testName: input.metadata.testName || input.title,
            openTime: openTime.toISOString(),
          },
        },
        executeAt: openTime,
        idempotencyKey: `test-started:${input.entityId}`,
      });
    }
  }

  // If teacher manually starts a live class before scheduled time:
  // Cancel pending scheduled start alerts for this class so duplicates don't occur!
  if (input.eventType === NotificationType.LIVE_CLASS_STARTED && input.entityId) {
    cancelScheduledNotifications(NotificationType.CLASS_STARTED, input.entityId).catch(() => {});
    cancelScheduledNotifications(NotificationType.CLASS_REMINDER_15_MIN, input.entityId).catch(() => {});
  }

  return {
    dispatchedCount: inAppRecipients.length,
    scheduled: false,
    skipped: false,
  };
}
