import { prisma } from "@/lib/db";
import {
  NotificationType,
  NotificationCategory,
  NotificationPriority,
  NotificationTargetType,
  ScheduledNotificationStatus,
} from "./types";
import { triggerNotificationEvent } from "./engine";

export interface EnqueueOptions {
  eventType: NotificationType;
  entityId?: string;
  targetType: NotificationTargetType;
  targetId?: string;
  payload: {
    title: string;
    body: string;
    deepLink?: string;
    icon?: string;
    image?: string;
    actionType?: string;
    actionUrl?: string;
    category?: NotificationCategory;
    priority?: NotificationPriority | "normal" | "high";
    metadata?: Record<string, any>;
    batchId?: string;
    courseId?: string;
    channel?: string;
  };
  executeAt: Date;
  idempotencyKey?: string;
}

/**
 * Enqueue a scheduled notification into Postgres.
 */
export async function enqueueScheduledNotification(opts: EnqueueOptions) {
  const idempotencyKey =
    opts.idempotencyKey ||
    `${opts.eventType}:${opts.entityId || "none"}:${opts.targetType}:${opts.targetId || "all"}:${opts.executeAt.getTime()}`;

  return await prisma.scheduledNotification.upsert({
    where: { idempotencyKey },
    update: {
      executeAt: opts.executeAt,
      payload: opts.payload as any,
      status: ScheduledNotificationStatus.PENDING,
      updatedAt: new Date(),
    },
    create: {
      eventType: opts.eventType,
      entityId: opts.entityId,
      targetType: opts.targetType,
      targetId: opts.targetId,
      payload: opts.payload as any,
      executeAt: opts.executeAt,
      idempotencyKey,
      status: ScheduledNotificationStatus.PENDING,
    },
  });
}

/**
 * Cancel pending scheduled notifications for a given event type and entityId.
 * e.g. when a live class is rescheduled, deleted, or cancelled.
 */
export async function cancelScheduledNotifications(
  eventType: NotificationType,
  entityId: string
): Promise<number> {
  const result = await prisma.scheduledNotification.updateMany({
    where: {
      eventType,
      entityId,
      status: { in: [ScheduledNotificationStatus.PENDING, ScheduledNotificationStatus.PROCESSING] },
    },
    data: {
      status: ScheduledNotificationStatus.CANCELLED,
      updatedAt: new Date(),
    },
  });

  return result.count;
}

/**
 * Process Daily Motivational notification rotation from database template.
 */
export async function processDailyMotivationRotation(): Promise<{ sent: boolean; message?: string }> {
  const template = await prisma.notificationTemplate.findFirst({
    where: { category: "MOTIVATION", isActive: true },
  });

  if (!template) {
    return { sent: false, message: "No active motivation template found" };
  }

  const rawMessages = template.rotationMessages;
  const messages: string[] = Array.isArray(rawMessages) ? (rawMessages as string[]) : [];

  if (messages.length === 0) {
    return { sent: false, message: "No rotation messages in template" };
  }

  const currentIndex = template.currentRotationIndex % messages.length;
  const todayMessage = messages[currentIndex] || template.message || "Keep pushing towards your dreams!";
  const nextIndex = template.restartOnComplete
    ? (currentIndex + 1) % messages.length
    : Math.min(currentIndex + 1, messages.length - 1);

  // Update rotation state in DB
  await prisma.notificationTemplate.update({
    where: { id: template.id },
    data: { currentRotationIndex: nextIndex, updatedAt: new Date() },
  });

  // Resolve all active students
  const students = await prisma.student.findMany({
    where: { user: { status: "ACTIVE" } },
    select: { userId: true },
  });
  const userIds = students.map((s) => s.userId).filter(Boolean);

  if (userIds.length === 0) {
    return { sent: false, message: "No active students found" };
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  await triggerNotificationEvent({
    eventType: NotificationType.DAILY_MOTIVATION,
    category: NotificationCategory.MOTIVATION,
    priority: NotificationPriority.LOW,
    recipientUserIds: userIds,
    title: template.title || "Daily Motivation 💡",
    body: todayMessage,
    deepLink: template.actionUrl || "/",
    actionType: template.actionType || "VIEW_MOTIVATION",
    actionUrl: template.actionUrl || "/",
    idempotencyKey: `daily-motivation:${template.id}:${dateStr}:${currentIndex}`,
  });

  return { sent: true, message: todayMessage };
}

/**
 * Process due scheduled notifications (called periodically by the cron worker).
 */
export async function processDueNotifications(): Promise<{
  processed: number;
  failed: number;
  skipped: number;
}> {
  const now = new Date();

  // Find due pending notifications
  const dueJobs = await prisma.scheduledNotification.findMany({
    where: {
      status: ScheduledNotificationStatus.PENDING,
      executeAt: { lte: now },
    },
    take: 50,
    orderBy: { executeAt: "asc" },
  });

  let processed = 0;
  let failed = 0;
  let skipped = 0;

  for (const job of dueJobs) {
    // Atomically claim the job to prevent concurrent worker execution
    const claim = await prisma.scheduledNotification.updateMany({
      where: {
        id: job.id,
        status: ScheduledNotificationStatus.PENDING,
      },
      data: {
        status: ScheduledNotificationStatus.PROCESSING,
        attemptCount: { increment: 1 },
        updatedAt: now,
      },
    });

    if (claim.count === 0) {
      skipped++;
      continue;
    }

    try {
      // 1. Authoritative check for CLASS_REMINDER_15_MIN:
      // If class is CANCELLED, COMPLETED, or already LIVE, skip sending!
      if (job.eventType === NotificationType.CLASS_REMINDER_15_MIN && job.entityId) {
        const schedule = await prisma.batchSchedule.findUnique({
          where: { id: job.entityId },
          select: { status: true },
        });

        if (!schedule || schedule.status === "CANCELLED" || schedule.status === "LIVE" || schedule.status === "COMPLETED") {
          await prisma.scheduledNotification.update({
            where: { id: job.id },
            data: { status: ScheduledNotificationStatus.CANCELLED, updatedAt: new Date() },
          });
          skipped++;
          continue;
        }
      }

      // 2. Authoritative check for CLASS_STARTED:
      // If class is CANCELLED, skip!
      if (job.eventType === NotificationType.CLASS_STARTED && job.entityId) {
        const schedule = await prisma.batchSchedule.findUnique({
          where: { id: job.entityId },
          select: { status: true },
        });

        if (!schedule || schedule.status === "CANCELLED") {
          await prisma.scheduledNotification.update({
            where: { id: job.id },
            data: { status: ScheduledNotificationStatus.CANCELLED, updatedAt: new Date() },
          });
          skipped++;
          continue;
        }
      }

      // 3. Authoritative check for TEST_REMINDER_15_MIN:
      if (job.eventType === NotificationType.TEST_REMINDER_15_MIN && job.entityId) {
        const test = await prisma.test.findUnique({
          where: { id: job.entityId },
          select: { status: true },
        });

        if (!test || test.status !== "PUBLISHED") {
          await prisma.scheduledNotification.update({
            where: { id: job.id },
            data: { status: ScheduledNotificationStatus.CANCELLED, updatedAt: new Date() },
          });
          skipped++;
          continue;
        }
      }

      // 4. Special handler for DAILY_MOTIVATION:
      if (job.eventType === NotificationType.DAILY_MOTIVATION) {
        await processDailyMotivationRotation();
        await prisma.scheduledNotification.update({
          where: { id: job.id },
          data: { status: ScheduledNotificationStatus.PROCESSED, updatedAt: new Date() },
        });
        processed++;
        continue;
      }

      const payload = (job.payload as any) || {};

      // Execute dispatch through Central Notification Engine
      await triggerNotificationEvent({
        eventType: job.eventType,
        category: payload.category,
        priority: payload.priority,
        entityId: job.entityId || undefined,
        batchId: payload.batchId || (job.targetType === NotificationTargetType.BATCH ? job.targetId || undefined : undefined),
        courseId: payload.courseId,
        title: payload.title,
        body: payload.body,
        deepLink: payload.deepLink,
        icon: payload.icon,
        image: payload.image,
        actionType: payload.actionType,
        actionUrl: payload.actionUrl,
        metadata: payload.metadata,
        idempotencyKey: job.idempotencyKey || undefined,
        channel: payload.channel || "ALL",
      });

      await prisma.scheduledNotification.update({
        where: { id: job.id },
        data: {
          status: ScheduledNotificationStatus.PROCESSED,
          updatedAt: new Date(),
        },
      });

      processed++;
    } catch (err: any) {
      console.error(`[Scheduler Error] Job ${job.id} failed:`, err);
      failed++;

      const isExhausted = job.attemptCount >= 3;
      await prisma.scheduledNotification.update({
        where: { id: job.id },
        data: {
          status: isExhausted
            ? ScheduledNotificationStatus.FAILED
            : ScheduledNotificationStatus.PENDING,
          lastError: err?.message || String(err),
          updatedAt: new Date(),
        },
      });
    }
  }

  return { processed, failed, skipped };
}
