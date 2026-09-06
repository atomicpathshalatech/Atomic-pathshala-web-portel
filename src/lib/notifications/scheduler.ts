import { prisma } from "@/lib/db";
import {
  NotificationType,
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
      payload: opts.payload,
      status: ScheduledNotificationStatus.PENDING,
      updatedAt: new Date(),
    },
    create: {
      eventType: opts.eventType,
      entityId: opts.entityId,
      targetType: opts.targetType,
      targetId: opts.targetId,
      payload: opts.payload,
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
      // Authoritative race condition check before sending:
      // If it's a CLASS_REMINDER_15_MIN, verify that the class is not CANCELLED or already LIVE!
      if (job.eventType === NotificationType.CLASS_REMINDER_15_MIN && job.entityId) {
        const schedule = await prisma.batchSchedule.findUnique({
          where: { id: job.entityId },
          select: { status: true },
        });

        if (!schedule || schedule.status === "CANCELLED" || schedule.status === "LIVE" || schedule.status === "COMPLETED") {
          console.info(`[Scheduler] Skipping 15m reminder for schedule ${job.entityId} because status is ${schedule?.status || "NOT_FOUND"}`);
          await prisma.scheduledNotification.update({
            where: { id: job.id },
            data: { status: ScheduledNotificationStatus.CANCELLED, updatedAt: new Date() },
          });
          skipped++;
          continue;
        }
      }

      // If it's a TEST_REMINDER_15_MIN, verify that the test is still PUBLISHED
      if (job.eventType === NotificationType.TEST_REMINDER_15_MIN && job.entityId) {
        const test = await prisma.test.findUnique({
          where: { id: job.entityId },
          select: { status: true },
        });

        if (!test || test.status !== "PUBLISHED") {
          console.info(`[Scheduler] Skipping 15m reminder for test ${job.entityId} because status is ${test?.status || "NOT_FOUND"}`);
          await prisma.scheduledNotification.update({
            where: { id: job.id },
            data: { status: ScheduledNotificationStatus.CANCELLED, updatedAt: new Date() },
          });
          skipped++;
          continue;
        }
      }

      const payload = (job.payload as any) || {};

      // Execute dispatch through Central Notification Engine
      await triggerNotificationEvent({
        eventType: job.eventType,
        entityId: job.entityId || undefined,
        batchId: payload.batchId || (job.targetType === NotificationTargetType.BATCH ? job.targetId || undefined : undefined),
        courseId: payload.courseId,
        title: payload.title,
        body: payload.body,
        deepLink: payload.deepLink,
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
