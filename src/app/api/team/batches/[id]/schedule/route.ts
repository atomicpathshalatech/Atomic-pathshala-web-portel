import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { batchScheduleCreateSchema } from "@/lib/validation/batch";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { checkScheduleConflict } from "@/lib/batch/schedule-conflict";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    await requirePermission(session?.user?.id, PERMISSIONS.BATCH_READ);

    const schedules = await prisma.batchSchedule.findMany({
      where: { batchId: params.id },
      include: {
        teacher: { include: { user: true } },
        liveWhiteboardSession: {
          select: {
            id: true,
            status: true,
            livePhase: true,
            videoTransport: true,
            youtubeVideoId: true,
            actualStartedAt: true,
            actualEndedAt: true,
          },
        },
      },
      orderBy: { startsAt: "asc" },
    });

    return apiSuccess({ schedules });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.BATCH_SCHEDULE_MANAGE);

    const batch = await prisma.batch.findUnique({ where: { id: params.id } });
    if (!batch) return apiError("Batch not found", 404);

    const input = batchScheduleCreateSchema.parse(await request.json());

    if (input.teacherId) {
      const teacher = await prisma.teacher.findUnique({ where: { id: input.teacherId } });
      if (!teacher) return apiError("Teacher not found", 404);
    }

    // Server-Side Conflict Check (Batch & Teacher Overlap)
    const conflict = await checkScheduleConflict({
      batchId: params.id,
      teacherId: input.teacherId,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
    });

    if (conflict.hasConflict) {
      return apiError(conflict.message || "Schedule timing conflict detected.", 409);
    }

    const schedule = await prisma.batchSchedule.create({
      data: {
        batchId: params.id,
        title: input.title,
        subject: input.subject || null,
        type: input.type,
        teacherId: input.teacherId || null,
        chapterId: input.chapterId || null,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        notes: input.notes || null,
        createdById: session.user.id,
      },
      include: {
        teacher: { include: { user: true } },
        chapter: { include: { subject: { include: { course: true } } } },
      },
    });

    // Initialize WhiteboardSession for LIVE_CLASS with selected transport
    if (input.type === "LIVE_CLASS") {
      let tid = input.teacherId;
      if (!tid) {
        const t = await prisma.teacher.findFirst({ where: { userId: session.user.id } });
        tid = t?.id;
      }
      if (tid) {
        const wb = await prisma.whiteboardSession.upsert({
          where: { batchScheduleId: schedule.id },
          update: {
            videoTransport: input.videoTransport || "LIVEKIT",
            youtubeVideoId: input.youtubeVideoId || null,
          },
          create: {
            batchScheduleId: schedule.id,
            teacherId: tid,
            title: schedule.title,
            videoTransport: input.videoTransport || "LIVEKIT",
            youtubeVideoId: input.youtubeVideoId || null,
          },
        });

        // For Model 1 (Application Class streaming to YouTube): pre-create unlisted broadcast if YouTube is configured
        if (wb.videoTransport === "YOUTUBE" && !wb.youtubeVideoId) {
          const { youtubeLiveClassConfigured, ensureYoutubeBroadcastForWhiteboard } = await import(
            "@/lib/live-class/youtube-broadcast"
          );
          if (youtubeLiveClassConfigured()) {
            ensureYoutubeBroadcastForWhiteboard(wb.id, schedule.title, schedule.startsAt).catch((err) => {
              console.warn("[BatchSchedule] Auto YouTube broadcast creation warning:", err);
            });
          }
        }
      }
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "BATCH_SCHEDULE_CREATED",
        entityType: "Batch",
        entityId: params.id,
        metadata: {
          scheduleId: schedule.id,
          title: schedule.title,
          startsAt: schedule.startsAt.toISOString(),
          endsAt: schedule.endsAt.toISOString(),
        },
      },
    });

    // Trigger CLASS_SCHEDULED or TEST_SCHEDULED notification & automatically queue 15m reminder + start alerts
    try {
      const { triggerNotificationEvent } = await import("@/lib/notifications/engine");
      const { NotificationType, NotificationCategory, NotificationPriority } = await import("@/lib/notifications/types");

      const timeStr = schedule.startsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const dateStr = schedule.startsAt.toLocaleDateString("en-IN", { month: "short", day: "numeric" });

      if (schedule.type === "TEST") {
        await triggerNotificationEvent({
          eventType: NotificationType.TEST_SCHEDULED,
          category: NotificationCategory.TESTS,
          priority: NotificationPriority.NORMAL,
          entityId: schedule.id,
          testId: schedule.id,
          batchId: params.id,
          title: `New Test Scheduled: ${schedule.title}`,
          body: `Test is scheduled for ${dateStr} at ${timeStr}.`,
          deepLink: `/batches/${params.id}`,
          actionType: "VIEW_TEST",
          actionUrl: `/batches/${params.id}`,
          metadata: {
            testId: schedule.id,
            testName: schedule.title,
            openTime: schedule.startsAt.toISOString(),
          },
          idempotencyKey: `test-scheduled:${schedule.id}`,
        });
      } else {
        await triggerNotificationEvent({
          eventType: NotificationType.CLASS_SCHEDULED,
          category: NotificationCategory.CLASSES,
          priority: NotificationPriority.NORMAL,
          entityId: schedule.id,
          classId: schedule.id,
          batchId: params.id,
          title: `New Class Scheduled: ${schedule.title}`,
          body: `Your ${schedule.subject || "live"} class is scheduled for ${dateStr} at ${timeStr}.`,
          deepLink: `/live-class/${schedule.id}`,
          actionType: "VIEW_CLASS",
          actionUrl: `/live-class/${schedule.id}`,
          metadata: {
            classId: schedule.id,
            className: schedule.title,
            startsAt: schedule.startsAt.toISOString(),
          },
          idempotencyKey: `class-scheduled:${schedule.id}`,
        });
      }
    } catch (notifErr) {
      console.warn("[SCHEDULE_NOTIFICATION_WARNING]", notifErr);
    }

    return apiSuccess({ schedule }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
