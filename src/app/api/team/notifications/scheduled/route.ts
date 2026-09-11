import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ScheduledNotificationStatus } from "@/lib/notifications/types";
import { z } from "zod";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const canRead = await hasPermission(session.user.id, PERMISSIONS.NOTIFICATION_READ);
    if (!canRead) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const statusParam = req.nextUrl.searchParams.get("status") as ScheduledNotificationStatus | null;

    const scheduled = await prisma.scheduledNotification.findMany({
      where: statusParam ? { status: statusParam } : undefined,
      orderBy: { executeAt: "desc" },
      take: 100,
    });

    return NextResponse.json({ success: true, scheduled });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}

const actionSchema = z.object({
  jobId: z.string(),
  action: z.enum(["cancel", "duplicate", "edit"]),
  executeAt: z.string().optional(),
  payload: z.record(z.any()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const canManage = await hasPermission(session.user.id, PERMISSIONS.NOTIFICATION_SEND);
    if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const data = actionSchema.parse(body);

    const job = await prisma.scheduledNotification.findUnique({ where: { id: data.jobId } });
    if (!job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    if (data.action === "cancel") {
      await prisma.scheduledNotification.update({
        where: { id: job.id },
        data: { status: ScheduledNotificationStatus.CANCELLED, updatedAt: new Date() },
      });
      return NextResponse.json({ success: true, message: "Scheduled notification cancelled" });
    }

    if (data.action === "duplicate") {
      const newJob = await prisma.scheduledNotification.create({
        data: {
          eventType: job.eventType,
          entityId: job.entityId,
          targetType: job.targetType,
          targetId: job.targetId,
          payload: job.payload as any,
          executeAt: data.executeAt ? new Date(data.executeAt) : new Date(Date.now() + 3600_000),
          idempotencyKey: `${job.eventType}:copy:${Date.now()}`,
          status: ScheduledNotificationStatus.PENDING,
        },
      });
      return NextResponse.json({ success: true, newJob });
    }

    if (data.action === "edit") {
      if (job.status !== ScheduledNotificationStatus.PENDING) {
        return NextResponse.json({ error: "Cannot edit an already processed/cancelled notification" }, { status: 400 });
      }

      const updated = await prisma.scheduledNotification.update({
        where: { id: job.id },
        data: {
          executeAt: data.executeAt ? new Date(data.executeAt) : job.executeAt,
          payload: data.payload ? (data.payload as any) : job.payload,
          updatedAt: new Date(),
        },
      });
      return NextResponse.json({ success: true, job: updated });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 400 });
  }
}
