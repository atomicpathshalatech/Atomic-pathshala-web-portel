import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { broadcastCreateSchema } from "@/lib/validation/notification";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

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
 * writes one Notification row per recipient (IN_APP only — this build has
 * no EMAIL/WHATSAPP dispatch pipeline for notifications, same limitation
 * as everywhere else "channel" is more aspirational than wired up) plus a
 * NotificationBroadcast summary row for the history list.
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

    const [, broadcast] = await prisma.$transaction([
      prisma.notification.createMany({
        data: recipientUserIds.map((userId) => ({
          userId,
          title: input.title,
          body: input.body,
          channel: "IN_APP" as const,
        })),
      }),
      prisma.notificationBroadcast.create({
        data: {
          title: input.title,
          body: input.body,
          segmentType: input.segmentType,
          segmentValue: input.segmentValue ?? null,
          recipientCount: recipientUserIds.length,
          sentById: session.user.id,
        },
      }),
    ]);

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
        },
      },
    });

    return apiSuccess({ broadcast, recipientCount: recipientUserIds.length }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
