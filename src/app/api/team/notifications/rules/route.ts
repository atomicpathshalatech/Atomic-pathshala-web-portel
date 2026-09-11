import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { NotificationType, NotificationPriority } from "@/lib/notifications/types";
import { z } from "zod";

const DEFAULT_RULES = [
  { eventType: NotificationType.CLASS_SCHEDULED, label: "Class Scheduled", priority: NotificationPriority.NORMAL },
  { eventType: NotificationType.CLASS_RESCHEDULED, label: "Class Rescheduled", priority: NotificationPriority.HIGH },
  { eventType: NotificationType.CLASS_CANCELLED, label: "Class Cancelled", priority: NotificationPriority.HIGH },
  { eventType: NotificationType.CLASS_REMINDER_15_MIN, label: "Class Starting in 15 Min", priority: NotificationPriority.HIGH },
  { eventType: NotificationType.CLASS_STARTED, label: "Class Started", priority: NotificationPriority.HIGH },
  { eventType: NotificationType.LIVE_CLASS_STARTED, label: "Teacher Started Live Class", priority: NotificationPriority.HIGH },
  { eventType: NotificationType.TEST_SCHEDULED, label: "Test Scheduled", priority: NotificationPriority.NORMAL },
  { eventType: NotificationType.TEST_REMINDER_15_MIN, label: "Test Starting in 15 Min", priority: NotificationPriority.HIGH },
  { eventType: NotificationType.TEST_STARTED, label: "Test Started", priority: NotificationPriority.HIGH },
  { eventType: NotificationType.NEW_DPP, label: "New DPP Added", priority: NotificationPriority.NORMAL },
  { eventType: NotificationType.NEW_PDF, label: "New PDF Added", priority: NotificationPriority.NORMAL },
  { eventType: NotificationType.NEW_PPT, label: "New PPT Added", priority: NotificationPriority.NORMAL },
  { eventType: NotificationType.NEW_STUDY_MATERIAL, label: "New Study Material", priority: NotificationPriority.NORMAL },
  { eventType: NotificationType.OFFER_CREATED, label: "New Offer / Promotion", priority: NotificationPriority.NORMAL },
  { eventType: NotificationType.DAILY_MOTIVATION, label: "Daily Motivation", priority: NotificationPriority.LOW },
];

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const canRead = await hasPermission(session.user.id, PERMISSIONS.NOTIFICATION_READ);
    if (!canRead) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    let rules = await prisma.notificationRule.findMany({
      include: { template: { select: { id: true, templateName: true } } },
      orderBy: { eventType: "asc" },
    });

    // Auto-seed default rules if database is empty
    if (rules.length === 0) {
      for (const def of DEFAULT_RULES) {
        await prisma.notificationRule.upsert({
          where: { eventType: def.eventType },
          update: {},
          create: {
            eventType: def.eventType,
            isEnabled: true,
            priority: def.priority,
            channels: ["IN_APP", "PUSH"],
          },
        });
      }
      rules = await prisma.notificationRule.findMany({
        include: { template: { select: { id: true, templateName: true } } },
        orderBy: { eventType: "asc" },
      });
    }

    return NextResponse.json({ success: true, rules });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}

const updateRuleSchema = z.object({
  id: z.string(),
  isEnabled: z.boolean(),
  priority: z.nativeEnum(NotificationPriority).optional(),
  channels: z.array(z.string()).optional(),
  templateId: z.string().optional().nullable(),
});

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const canManage = await hasPermission(session.user.id, PERMISSIONS.NOTIFICATION_SEND);
    if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const data = updateRuleSchema.parse(body);

    const updated = await prisma.notificationRule.update({
      where: { id: data.id },
      data: {
        isEnabled: data.isEnabled,
        priority: data.priority,
        channels: data.channels ? (data.channels as any) : undefined,
        templateId: data.templateId || null,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, rule: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 400 });
  }
}
