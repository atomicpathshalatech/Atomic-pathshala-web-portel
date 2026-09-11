import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { ScheduledNotificationStatus } from "@/lib/notifications/types";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const canRead = await hasPermission(session.user.id, PERMISSIONS.NOTIFICATION_READ);
    if (!canRead) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      totalNotifications,
      sentToday,
      scheduledCount,
      failedCount,
      unreadCount,
      totalDeliveries,
      clickedDeliveries,
      activeRulesCount,
    ] = await Promise.all([
      prisma.notification.count(),
      prisma.notification.count({ where: { createdAt: { gte: startOfToday } } }),
      prisma.scheduledNotification.count({ where: { status: ScheduledNotificationStatus.PENDING } }),
      prisma.notificationDelivery.count({ where: { status: "FAILED" } }),
      prisma.notification.count({ where: { isRead: false } }),
      prisma.notificationDelivery.count(),
      prisma.notificationDelivery.count({ where: { status: "CLICKED" } }),
      prisma.notificationRule.count({ where: { isEnabled: true } }),
    ]);

    const clickRate =
      totalDeliveries > 0 ? ((clickedDeliveries / totalDeliveries) * 100).toFixed(1) : "0.0";

    // Recent action logs breakdown
    const actionStats = await prisma.notificationActionLog.groupBy({
      by: ["actionType"],
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 5,
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalNotifications,
        sentToday,
        scheduledCount,
        failedCount,
        unreadCount,
        clickRate: `${clickRate}%`,
        activeRulesCount,
        totalDeliveries,
        clickedDeliveries,
        actionStats: actionStats.map((a) => ({ action: a.actionType, count: a._count.id })),
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}
