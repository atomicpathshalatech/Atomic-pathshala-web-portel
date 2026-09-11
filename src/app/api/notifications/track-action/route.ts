import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const trackActionSchema = z.object({
  notificationId: z.string().optional(),
  classId: z.string().optional(),
  testId: z.string().optional(),
  batchId: z.string().optional(),
  actionType: z.string().min(1),
  source: z.string().optional(), // "POPUP", "NOTIFICATION_CENTER", "BROWSER_PUSH"
  metadata: z.record(z.any()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const data = trackActionSchema.parse(body);

    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    const now = new Date();

    // 1. Record Action Log
    const actionLog = await prisma.notificationActionLog.create({
      data: {
        notificationId: data.notificationId || null,
        studentId: student?.id || null,
        userId: session.user.id,
        classId: data.classId || null,
        testId: data.testId || null,
        batchId: data.batchId || null,
        actionType: data.actionType,
        source: data.source || "POPUP",
        metadata: data.metadata || undefined,
        timestamp: now,
      },
    });

    // 2. Update notification delivery record if notificationId provided
    if (data.notificationId) {
      await prisma.notification.updateMany({
        where: { id: data.notificationId, userId: session.user.id },
        data: { clickedAt: now, isRead: true, readAt: now },
      }).catch(() => {});

      await prisma.notificationDelivery.updateMany({
        where: { notificationId: data.notificationId, userId: session.user.id },
        data: { status: "CLICKED", clickedAt: now, readAt: now },
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, actionLogId: actionLog.id });
  } catch (err: any) {
    console.error("[Track Action Error]", err);
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 400 });
  }
}
