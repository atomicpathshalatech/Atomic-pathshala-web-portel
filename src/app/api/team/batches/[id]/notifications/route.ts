import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { z } from "zod";
import { triggerNotificationEvent } from "@/lib/notifications/engine";
import {
  NotificationType,
  NotificationCategory,
  NotificationPriority,
} from "@/lib/notifications/types";

const createBatchNotificationSchema = z.object({
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  category: z.nativeEnum(NotificationCategory).default(NotificationCategory.SYSTEM),
  priority: z.nativeEnum(NotificationPriority).default(NotificationPriority.NORMAL),
  actionType: z.string().optional(),
  actionUrl: z.string().optional(),
  icon: z.string().optional(),
  image: z.string().optional(),
  scheduledFor: z.string().optional(), // ISO string if scheduled
});

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canRead =
      (await hasPermission(session.user.id, PERMISSIONS.BATCH_READ)) ||
      (await hasPermission(session.user.id, PERMISSIONS.NOTIFICATION_READ));

    if (!canRead) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 1. Calculate eligible active student count in this batch
    const eligibleCount = await prisma.batchEnrollment.count({
      where: { batchId: params.id, status: "ACTIVE" },
    });

    // 2. Fetch recent notifications targeted to this batch
    const notifications = await prisma.notification.findMany({
      where: { batchId: params.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      distinct: ["title", "createdAt"],
      select: {
        id: true,
        title: true,
        body: true,
        category: true,
        priority: true,
        actionType: true,
        actionUrl: true,
        createdAt: true,
        sentAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      eligibleCount,
      notifications,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const canSend =
      (await hasPermission(session.user.id, PERMISSIONS.BATCH_UPDATE)) ||
      (await hasPermission(session.user.id, PERMISSIONS.NOTIFICATION_SEND));

    if (!canSend) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const batch = await prisma.batch.findUnique({
      where: { id: params.id },
      select: { id: true, name: true },
    });
    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    const body = await req.json();
    const data = createBatchNotificationSchema.parse(body);

    const scheduledDate = data.scheduledFor ? new Date(data.scheduledFor) : undefined;
    const idempotencyKey = `batch-manual:${params.id}:${Date.now()}`;

    const result = await triggerNotificationEvent({
      eventType: NotificationType.BATCH_NOTIFICATION,
      category: data.category,
      priority: data.priority,
      batchId: params.id,
      title: data.title,
      body: data.message,
      deepLink: data.actionUrl || `/batches/${params.id}`,
      actionType: data.actionType || "VIEW_DETAILS",
      actionUrl: data.actionUrl || `/batches/${params.id}`,
      icon: data.icon,
      image: data.image,
      createdById: session.user.id,
      scheduledFor: scheduledDate,
      idempotencyKey,
      metadata: {
        batchId: params.id,
        batchName: batch.name,
      },
    });

    return NextResponse.json({
      success: true,
      scheduled: result.scheduled,
      dispatchedCount: result.dispatchedCount,
    });
  } catch (err: any) {
    console.error("[Batch Notification Create Error]", err);
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 400 });
  }
}
