import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { z } from "zod";
import { triggerNotificationEvent } from "@/lib/notifications/engine";
import { enqueueScheduledNotification } from "@/lib/notifications/scheduler";
import {
  NotificationType,
  NotificationCategory,
  NotificationPriority,
  NotificationTargetType,
} from "@/lib/notifications/types";

const bulkSchema = z.object({
  messages: z
    .array(
      z.object({
        title: z.string().min(2).max(150),
        body: z.string().min(2).max(2000),
        segmentType: z.enum(["ALL", "BATCH", "CLASS", "TARGET_EXAM", "STUDENTS"]),
        segmentValue: z.string().optional().nullable(),
        selectedUserIds: z.array(z.string()).optional(),
        priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
        category: z.string().optional(),
        image: z.string().optional().nullable(),
        deepLink: z.string().optional().nullable(),
        executeAt: z.string().optional().nullable(),
      })
    )
    .min(1)
    .max(25),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.NOTIFICATION_SEND);

    const body = await req.json();
    const { messages } = bulkSchema.parse(body);

    const results: any[] = [];
    const now = new Date();

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]!;
      let recipientUserIds: string[] = [];

      if (msg.segmentType === "ALL") {
        const students = await prisma.student.findMany({ select: { userId: true } });
        recipientUserIds = students.map((s) => s.userId);
      } else if (msg.segmentType === "STUDENTS") {
        recipientUserIds = msg.selectedUserIds || (msg.segmentValue ? [msg.segmentValue] : []);
      } else if (msg.segmentType === "BATCH" && msg.segmentValue) {
        const enrollments = await prisma.batchEnrollment.findMany({
          where: { batchId: msg.segmentValue, status: "ACTIVE" },
          include: { student: { select: { userId: true } } },
        });
        recipientUserIds = enrollments.map((e) => e.student.userId);
      } else if (msg.segmentType === "CLASS" && msg.segmentValue) {
        const students = await prisma.student.findMany({
          where: { class: msg.segmentValue },
          select: { userId: true },
        });
        recipientUserIds = students.map((s) => s.userId);
      } else if (msg.segmentType === "TARGET_EXAM" && msg.segmentValue) {
        const students = await prisma.student.findMany({
          where: { targetExam: msg.segmentValue },
          select: { userId: true },
        });
        recipientUserIds = students.map((s) => s.userId);
      }

      if (recipientUserIds.length === 0) {
        results.push({
          index: i,
          title: msg.title,
          success: false,
          error: "No matching students in segment",
        });
        continue;
      }

      const scheduledFor = msg.executeAt ? new Date(msg.executeAt) : null;
      const isFuture = scheduledFor !== null && scheduledFor.getTime() > now.getTime() + 10_000;

      if (isFuture) {
        const job = await enqueueScheduledNotification({
          eventType: NotificationType.ANNOUNCEMENT_CREATED,
          targetType: msg.segmentType === "BATCH" ? NotificationTargetType.BATCH : NotificationTargetType.USER,
          targetId: msg.segmentType === "BATCH" ? msg.segmentValue ?? undefined : undefined,
          payload: {
            title: msg.title,
            body: msg.body,
            deepLink: msg.deepLink || "/notifications",
            image: msg.image || undefined,
            category: (msg.category as unknown as NotificationCategory) || NotificationCategory.SYSTEM,
            priority: (msg.priority as unknown as NotificationPriority) || NotificationPriority.NORMAL,
            batchId: msg.segmentType === "BATCH" ? msg.segmentValue ?? undefined : undefined,
            metadata: {
              recipientUserIds,
              segmentType: msg.segmentType,
              segmentValue: msg.segmentValue ?? null,
              bulkBatchIndex: i,
            },
          },
          executeAt: scheduledFor,
          idempotencyKey: `bulk-job:${session.user.id}:${scheduledFor.getTime()}:${i}:${Date.now()}`,
        });

        results.push({
          index: i,
          title: msg.title,
          scheduled: true,
          jobId: job.id,
          executeAt: scheduledFor.toISOString(),
          recipientCount: recipientUserIds.length,
        });
      } else {
        const broadcast = await prisma.notificationBroadcast.create({
          data: {
            title: msg.title,
            body: msg.body,
            segmentType: msg.segmentType === "STUDENTS" ? "ALL" : (msg.segmentType as any),
            segmentValue: msg.segmentValue ?? null,
            recipientCount: recipientUserIds.length,
            sentById: session.user.id,
          },
        });

        await triggerNotificationEvent({
          eventType: NotificationType.ANNOUNCEMENT_CREATED,
          category: (msg.category as unknown as NotificationCategory) || NotificationCategory.SYSTEM,
          priority: (msg.priority as unknown as NotificationPriority) || NotificationPriority.NORMAL,
          entityId: broadcast.id,
          recipientUserIds,
          title: msg.title,
          body: msg.body,
          image: msg.image || undefined,
          deepLink: msg.deepLink || "/notifications",
          idempotencyKey: `bulk-broadcast:${broadcast.id}`,
        }).catch((err) => {
          console.error(`[Bulk Message Dispatch Error idx=${i}]`, err);
        });

        results.push({
          index: i,
          title: msg.title,
          scheduled: false,
          broadcastId: broadcast.id,
          recipientCount: recipientUserIds.length,
        });
      }
    }

    return apiSuccess({ count: messages.length, results }, 201);
  } catch (err) {
    return handleApiError(err);
  }
}
