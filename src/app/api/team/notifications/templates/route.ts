import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { NotificationCategory, NotificationPriority } from "@/lib/notifications/types";
import { z } from "zod";

const templateSchema = z.object({
  id: z.string().optional(),
  templateName: z.string().min(1).max(100),
  category: z.nativeEnum(NotificationCategory).default(NotificationCategory.SYSTEM),
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(1000),
  icon: z.string().optional().nullable(),
  image: z.string().optional().nullable(),
  actionType: z.string().optional().nullable(),
  actionUrl: z.string().optional().nullable(),
  priority: z.nativeEnum(NotificationPriority).default(NotificationPriority.NORMAL),
  targetAudience: z.string().default("ALL_STUDENTS"),
  schedule: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
  rotationMessages: z.array(z.string()).optional().nullable(),
  currentRotationIndex: z.number().int().default(0),
  restartOnComplete: z.boolean().default(true),
});

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const canRead = await hasPermission(session.user.id, PERMISSIONS.NOTIFICATION_READ);
    if (!canRead) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const templates = await prisma.notificationTemplate.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, templates });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const canManage = await hasPermission(session.user.id, PERMISSIONS.NOTIFICATION_SEND);
    if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const data = templateSchema.parse(body);

    const created = await prisma.notificationTemplate.create({
      data: {
        templateName: data.templateName,
        category: data.category,
        title: data.title,
        message: data.message,
        icon: data.icon || null,
        image: data.image || null,
        actionType: data.actionType || null,
        actionUrl: data.actionUrl || null,
        priority: data.priority,
        targetAudience: data.targetAudience,
        schedule: data.schedule || null,
        isActive: data.isActive,
        rotationMessages: data.rotationMessages ? (data.rotationMessages as any) : undefined,
        currentRotationIndex: data.currentRotationIndex,
        restartOnComplete: data.restartOnComplete,
        createdById: session.user.id,
      },
    });

    return NextResponse.json({ success: true, template: created }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 400 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const canManage = await hasPermission(session.user.id, PERMISSIONS.NOTIFICATION_SEND);
    if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json();
    const data = templateSchema.parse(body);

    if (!data.id) {
      return NextResponse.json({ error: "Template ID required for update" }, { status: 400 });
    }

    const updated = await prisma.notificationTemplate.update({
      where: { id: data.id },
      data: {
        templateName: data.templateName,
        category: data.category,
        title: data.title,
        message: data.message,
        icon: data.icon || null,
        image: data.image || null,
        actionType: data.actionType || null,
        actionUrl: data.actionUrl || null,
        priority: data.priority,
        targetAudience: data.targetAudience,
        schedule: data.schedule || null,
        isActive: data.isActive,
        rotationMessages: data.rotationMessages ? (data.rotationMessages as any) : undefined,
        currentRotationIndex: data.currentRotationIndex,
        restartOnComplete: data.restartOnComplete,
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, template: updated });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const canManage = await hasPermission(session.user.id, PERMISSIONS.NOTIFICATION_SEND);
    if (!canManage) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Template ID required" }, { status: 400 });

    await prisma.notificationTemplate.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Internal error" }, { status: 400 });
  }
}
