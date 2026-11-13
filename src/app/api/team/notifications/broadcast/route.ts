import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { broadcastCreateSchema } from "@/lib/validation/notification";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { dispatchNotification } from "@/lib/notifications/whatsapp";
import { enqueueScheduledNotification } from "@/lib/notifications/scheduler";
import { triggerNotificationEvent } from "@/lib/notifications/engine";
import {
  NotificationType,
  NotificationCategory,
  NotificationPriority,
  NotificationTargetType,
} from "@/lib/notifications/types";

/** Past broadcasts — the audit trail, not the individual Notification rows. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.NOTIFICATION_READ);

    const broadcasts = await prisma.notificationBroadcast.findMany({
      include: { sentBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 25,
    });

    return apiSuccess({ broadcasts });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Resolves a segment to the list of Student userIds it targets, then
 * writes Notification rows and triggers multi-channel dispatch (In-App, WhatsApp, Email).
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.NOTIFICATION_SEND);

    const input = broadcastCreateSchema.parse(await request.json());

    let recipientUserIds: string[] = [];

    if (input.segmentType === "ALL") {
      const students = await prisma.student.findMany({ select: { userId: true } });
      recipientUserIds = students.map((s) => s.userId);
    } else if (input.segmentType === "STUDENTS") {
      if (input.selectedUserIds && input.selectedUserIds.length > 0) {
        recipientUserIds = Array.from(new Set(input.selectedUserIds));
      } else if (input.segmentValue) {
        recipientUserIds = [input.segmentValue];
      }
    } else if (input.segmentType === "BATCH") {
      const batch = await prisma.batch.findUnique({ where: { id: input.segmentValue! } });
      if (!batch) return apiError("Unknown batch.", 404);
      const enrollments = await prisma.batchEnrollment.findMany({
        where: { batchId: batch.id, status: "ACTIVE" },
        include: { student: { select: { userId: true } } },
      });
      recipientUserIds = enrollments.map((e) => e.student.userId);
    } else if (input.segmentType === "CLASS") {
      const students = await prisma.student.findMany({
        where: { class: input.segmentValue! },
        select: { userId: true },
      });
      recipientUserIds = students.map((s) => s.userId);
    } else {
      const students = await prisma.student.findMany({
        where: { targetExam: input.segmentValue! },
        select: { userId: true },
      });
      recipientUserIds = students.map((s) => s.userId);
    }

    if (recipientUserIds.length === 0) {
      return apiError("No students match this segment — nothing was sent.", 422);
    }

    const scheduledFor = input.executeAt ? new Date(input.executeAt) : null;
    const now = new Date();
    const isFutureSchedule = scheduledFor !== null && scheduledFor.getTime() > now.getTime() + 10_000;

    // A. Future Delivery: Persist in ScheduledNotification Queue
    if (isFutureSchedule) {
      const job = await enqueueScheduledNotification({
        eventType: NotificationType.ANNOUNCEMENT_CREATED,
        targetType: input.segmentType === "BATCH" ? NotificationTargetType.BATCH : NotificationTargetType.USER,
        targetId: input.segmentType === "BATCH" ? input.segmentValue ?? undefined : undefined,
        payload: {
          title: input.title,
          body: input.body,
          deepLink: input.deepLink || "/notifications",
          image: input.image || undefined,
          actionType: input.actionType || "VIEW_NOTIFICATION",
          actionUrl: input.actionUrl || input.deepLink || "/notifications",
          category: (input.category as unknown as NotificationCategory) || NotificationCategory.SYSTEM,
          priority: (input.priority as unknown as NotificationPriority) || NotificationPriority.NORMAL,
          batchId: input.segmentType === "BATCH" ? input.segmentValue ?? undefined : undefined,
          metadata: {
            recipientUserIds,
            segmentType: input.segmentType,
            segmentValue: input.segmentValue ?? null,
            createdByName: session.user.name || "Admin",
          },
        },
        executeAt: scheduledFor,
        idempotencyKey: `custom-scheduled:${session.user.id}:${scheduledFor.getTime()}:${Date.now()}`,
      });

      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "NOTIFICATION_SCHEDULED",
          entityType: "ScheduledNotification",
          entityId: job.id,
          metadata: {
            title: input.title,
            executeAt: scheduledFor.toISOString(),
            recipientCount: recipientUserIds.length,
            segmentType: input.segmentType,
          },
        },
      });

      return apiSuccess(
        {
          scheduled: true,
          jobId: job.id,
          executeAt: scheduledFor.toISOString(),
          recipientCount: recipientUserIds.length,
          message: `Notification scheduled for ${scheduledFor.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}`,
        },
        201
      );
    }

    // B. Immediate Delivery: Send Now
    const dbSegmentType = input.segmentType === "STUDENTS" ? "ALL" : input.segmentType;
    const broadcast = await prisma.notificationBroadcast.create({
      data: {
        title: input.title,
        body: input.body,
        segmentType: dbSegmentType,
        segmentValue: input.segmentValue ?? null,
        recipientCount: recipientUserIds.length,
        sentById: session.user.id,
      },
    });

    // Dispatch via Central Notification Engine (FCM, In-App, Pusher Realtime)
    await triggerNotificationEvent({
      eventType: NotificationType.ANNOUNCEMENT_CREATED,
      category: (input.category as unknown as NotificationCategory) || NotificationCategory.SYSTEM,
      priority: (input.priority as unknown as NotificationPriority) || NotificationPriority.NORMAL,
      entityId: broadcast.id,
      recipientUserIds,
      title: input.title,
      body: input.body,
      image: input.image || undefined,
      deepLink: input.deepLink || "/notifications",
      actionType: input.actionType || "VIEW_NOTIFICATION",
      actionUrl: input.actionUrl || input.deepLink || "/notifications",
      idempotencyKey: `broadcast:${broadcast.id}`,
    }).catch((err) => {
      console.error("[Broadcast Engine Dispatch Error]", err);
    });

    // If WhatsApp/Email channel was requested, also trigger external dispatch
    if (input.channel === "WHATSAPP" || input.channel === "ALL_CHANNELS") {
      for (const userId of recipientUserIds.slice(0, 100)) {
        await dispatchNotification({
          userId,
          title: input.title,
          body: input.body,
          channel: input.channel,
        }).catch(() => null);
      }
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "NOTIFICATION_BROADCAST_SENT",
        entityType: "NotificationBroadcast",
        entityId: broadcast.id,
        metadata: {
          segmentType: input.segmentType,
          segmentValue: input.segmentValue ?? null,
          recipientCount: recipientUserIds.length,
          channel: input.channel,
        },
      },
    });

    return apiSuccess({ broadcast, recipientCount: recipientUserIds.length }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
