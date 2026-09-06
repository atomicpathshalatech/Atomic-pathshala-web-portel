import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { batchScheduleUpdateSchema } from "@/lib/validation/batch";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { checkScheduleConflict } from "@/lib/batch/schedule-conflict";
import { applyLateReschedulePenaltyIfDue } from "@/lib/batch/reschedule-penalty";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; scheduleId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.BATCH_SCHEDULE_MANAGE);

    const existing = await prisma.batchSchedule.findFirst({
      where: { id: params.scheduleId, batchId: params.id },
    });
    if (!existing) return apiError("Schedule entry not found", 404);

    const input = batchScheduleUpdateSchema.parse(await request.json());

    if (input.teacherId) {
      const teacher = await prisma.teacher.findUnique({ where: { id: input.teacherId } });
      if (!teacher) return apiError("Teacher not found", 404);
    }

    // Only run conflict check if timings or teacher changed and status is not cancelled
    if (input.status !== "CANCELLED") {
      const conflict = await checkScheduleConflict({
        batchId: params.id,
        teacherId: input.teacherId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        excludeScheduleId: params.scheduleId,
      });

      if (conflict.hasConflict) {
        return apiError(conflict.message || "Schedule timing conflict detected.", 409);
      }
    }

    // A Live Class actually moving in time is a "reschedule" in the Phase D
    // sense (audit trail + notice-window penalty) — a same-time edit (just
    // the title/notes/teacher changing) or any non-LIVE_CLASS entry isn't.
    // This route is already admin-only (BATCH_SCHEDULE_MANAGE — held only
    // by ACADEMIC_HEAD/SUPER_ADMIN/FOUNDER, see permissions.ts), matching
    // the spec's "admin-only reschedule" requirement without a new
    // permission code.
    const isTimeChange =
      existing.startsAt.getTime() !== input.startsAt.getTime() || existing.endsAt.getTime() !== input.endsAt.getTime();
    const isLiveClassReschedule = existing.type === "LIVE_CLASS" && isTimeChange;

    const schedule = await prisma.batchSchedule.update({
      where: { id: params.scheduleId },
      data: {
        title: input.title,
        subject: input.subject || null,
        type: input.type,
        status: input.status,
        teacherId: input.teacherId || null,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        notes: input.notes || null,
        ...(isLiveClassReschedule && {
          rescheduleCount: { increment: 1 },
          rescheduledAt: new Date(),
          rescheduledById: session.user.id,
          previousStartsAt: existing.startsAt,
          previousEndsAt: existing.endsAt,
        }),
      },
    });

    if (isLiveClassReschedule) {
      await applyLateReschedulePenaltyIfDue({
        scheduleId: schedule.id,
        teacherId: existing.teacherId,
        originalStartsAt: existing.startsAt,
        rescheduledByUserId: session.user.id,
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "BATCH_SCHEDULE_UPDATED",
        entityType: "Batch",
        entityId: params.id,
        metadata: {
          scheduleId: schedule.id,
          title: schedule.title,
          startsAt: schedule.startsAt.toISOString(),
          endsAt: schedule.endsAt.toISOString(),
          rescheduled: isLiveClassReschedule,
        },
      },
    });

    // Central Notification Engine: Handle Reschedule & Cancellation
    try {
      const { triggerNotificationEvent } = await import("@/lib/notifications/engine");
      const { cancelScheduledNotifications } = await import("@/lib/notifications/scheduler");
      const { NotificationType } = await import("@/lib/notifications/types");

      if (input.status === "CANCELLED") {
        // Cancel all pending reminders for this class
        await cancelScheduledNotifications(NotificationType.CLASS_REMINDER_15_MIN, schedule.id);

        await triggerNotificationEvent({
          eventType: NotificationType.CLASS_CANCELLED,
          entityId: schedule.id,
          classId: schedule.id,
          batchId: params.id,
          title: `Class Cancelled: ${schedule.title}`,
          body: `Your class "${schedule.title}" has been cancelled. Please check your schedule for updates.`,
          deepLink: `/batches/${params.id}`,
        });
      } else if (isLiveClassReschedule) {
        // Invalidate old reminder jobs
        await cancelScheduledNotifications(NotificationType.CLASS_REMINDER_15_MIN, schedule.id);

        const timeStr = schedule.startsAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const dateStr = schedule.startsAt.toLocaleDateString("en-IN", { month: "short", day: "numeric" });

        await triggerNotificationEvent({
          eventType: NotificationType.CLASS_RESCHEDULED,
          entityId: schedule.id,
          classId: schedule.id,
          batchId: params.id,
          title: `Class Rescheduled: ${schedule.title}`,
          body: `Your class has been rescheduled to ${dateStr} at ${timeStr}.`,
          deepLink: `/batches/${params.id}`,
          metadata: {
            classId: schedule.id,
            className: schedule.title,
            startsAt: schedule.startsAt.toISOString(),
          },
        });
      }
    } catch (notifErr) {
      console.warn("[Schedule Update Notification Warning]", notifErr);
    }

    return apiSuccess({ schedule });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; scheduleId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.BATCH_SCHEDULE_MANAGE);

    // Deleting cascades onto the WhiteboardSession row (see onDelete:
    // Cascade on WhiteboardSession.batchSchedule in schema.prisma) — fine
    // for a schedule entry nobody has started class on yet, but deleting
    // one out from under a class that's currently live would yank the
    // room out from under everyone mid-session with no warning. Ended/
    // never-started sessions are still deletable, matching existing
    // behavior; only an ACTIVE one blocks the delete.
    const liveSession = await prisma.whiteboardSession.findFirst({
      where: { batchScheduleId: params.scheduleId, status: "ACTIVE" },
      select: { id: true },
    });
    if (liveSession) {
      return apiError("This class is currently live — end it before deleting the schedule entry.", 409);
    }

    const deleted = await prisma.batchSchedule.deleteMany({
      where: { id: params.scheduleId, batchId: params.id },
    });
    if (deleted.count === 0) return apiError("Schedule entry not found", 404);

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "BATCH_SCHEDULE_DELETED",
        entityType: "Batch",
        entityId: params.id,
        metadata: { scheduleId: params.scheduleId },
      },
    });

    try {
      const { cancelScheduledNotifications } = await import("@/lib/notifications/scheduler");
      const { NotificationType } = await import("@/lib/notifications/types");
      await cancelScheduledNotifications(NotificationType.CLASS_REMINDER_15_MIN, params.scheduleId);
    } catch (notifErr) {
      console.warn("[Schedule Delete Reminder Cancellation Warning]", notifErr);
    }

    return apiSuccess({ removed: true });
  } catch (error) {
    return handleApiError(error);
  }
}
