import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { pusherServer, sessionChannel, WB_EVENTS } from "@/lib/realtime/pusher-server";
import { videoRoomName } from "@/lib/livekit/server";
import { startRoomRecording, recordingStorageKey } from "@/lib/livekit/egress";

export async function POST(
  _request: NextRequest,
  { params }: { params: { scheduleId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.WHITEBOARD_ACCESS);

    const schedule = await prisma.batchSchedule.findUnique({
      where: { id: params.scheduleId },
      include: { liveWhiteboardSession: true },
    });

    if (!schedule) return apiError("Scheduled class not found", 404);

    const now = new Date();

    // A class already has an actualStartedAt once /start has ever succeeded
    // for it. Re-invoking /start after that (teacher reconnects, retries
    // after an error, clicks Start again) must NOT reset it - the Elapsed
    // timer is derived from actualStartedAt, so overwriting it here made
    // Elapsed jump backwards on every re-start while Remaining (derived
    // from the untouched scheduledEnd) kept counting down normally.
    const alreadyStarted = Boolean(schedule.liveWhiteboardSession?.actualStartedAt);

    const { canTeacherStart } = await import("@/lib/schedule/access-rules");
    const evaluation = canTeacherStart(schedule, now);
    if (!evaluation.allowed) {
      return apiError(
        evaluation.reason || "Live class cannot be started yet. Starting is allowed within 15 minutes of scheduled time.",
        403,
        {
          code: "START_WINDOW_NOT_OPEN",
          details: {
            opensAt: evaluation.opensAt.toISOString(),
            secondsUntilWindowOpens: evaluation.secondsUntilWindowOpens,
          },
        }
      );
    }

    let teacher = await prisma.teacher.findFirst({
      where: { userId: session.user.id },
    });

    if (!teacher) {
      // Check if user is an admin / super admin
      const { hasPermission } = await import("@/lib/rbac/guard");
      const { PERMISSIONS } = await import("@/lib/rbac/permissions");
      const canManage = await hasPermission(session.user.id, PERMISSIONS.BATCH_UPDATE);
      if (canManage) {
        if (schedule.teacherId) {
          teacher = await prisma.teacher.findUnique({ where: { id: schedule.teacherId } });
        }
        if (!teacher) {
          const code = Date.now().toString().slice(-6);
          teacher = await prisma.teacher.create({
            data: {
              userId: session.user.id,
              employeeCode: `ADM-INST-${code}`,
              department: "Academic Operations",
              subjects: ["General", "All Subjects"],
              bio: "Academic Administrator and Instructor",
            },
          });
        }
      }
    }

    if (!teacher) return apiError("Teacher profile not found", 403);

    const wbSession = await prisma.whiteboardSession.upsert({
      where: { batchScheduleId: params.scheduleId },
      update: {
        livePhase: "LIVE",
        status: "ACTIVE",
        ...(alreadyStarted ? {} : { actualStartedAt: now, startedAt: now }),
      },
      create: {
        batchScheduleId: schedule.id,
        teacherId: teacher.id,
        title: schedule.title,
        status: "ACTIVE",
        livePhase: "LIVE",
        actualStartedAt: now,
        startedAt: now,
        scheduledStart: schedule.startsAt ? new Date(schedule.startsAt) : now,
        scheduledEnd: schedule.endsAt ? new Date(schedule.endsAt) : new Date(now.getTime() + 60 * 60 * 1000),
        pages: {
          create: {
            pageNumber: 1,
            objects: [],
          },
        },
      },
    });

    await prisma.batchSchedule.update({
      where: { id: params.scheduleId },
      data: { status: "LIVE" },
    });

    // Start recording this session (Room Composite Egress -> R2). Best-effort:
    // a recording failure (LiveKit/R2 misconfigured, quota, etc.) must never
    // block the class itself from starting - the teacher and students don't
    // care why catch-up playback won't be available today, only that class
    // starting on time is not held hostage by it.
    if (wbSession.recordingStatus === "NONE" || !wbSession.recordingEgressId) {
      try {
        const storageKey = recordingStorageKey(wbSession.id);
        const egress = await startRoomRecording(videoRoomName(wbSession.id), storageKey);
        await prisma.whiteboardSession.update({
          where: { id: wbSession.id },
          data: { recordingEgressId: egress.egressId, recordingStatus: "RECORDING" },
        });
      } catch (recordingError) {
        console.error("[live_class_recording_start_error]", recordingError);
        await prisma.whiteboardSession
          .update({ where: { id: wbSession.id }, data: { recordingStatus: "FAILED" } })
          .catch(() => null);
      }
    }

    // Notify all participants that class is now LIVE
    try {
      await pusherServer.trigger(sessionChannel(wbSession.id), WB_EVENTS.LIVE_PHASE_CHANGED, {
        phase: "LIVE",
        livePhase: "LIVE",
        actualStartedAt: now.toISOString(),
      });
    } catch (pushErr) {
      console.warn("Realtime broadcast warning:", pushErr);
    }

    // Dispatch authoritative CLASS_LIVE notification event to enrolled students
    if (!alreadyStarted) {
      const { triggerNotificationEvent } = await import("@/lib/notifications/engine");
      const { NotificationType } = await import("@/lib/notifications/types");

      await triggerNotificationEvent({
        eventType: NotificationType.CLASS_LIVE,
        entityId: schedule.id,
        classId: schedule.id,
        batchId: schedule.batchId,
        title: `🔴 Class is LIVE: ${schedule.title}`,
        body: `Your live class has started. Join your classroom now!`,
        deepLink: `/live-class/${schedule.id}`,
        metadata: {
          classId: schedule.id,
          liveStartedAt: now.toISOString(),
          batchId: schedule.batchId,
        },
        priority: "high",
        idempotencyKey: `class-live:${schedule.id}`,
      }).catch((err) => {
        console.error("[CLASS_LIVE notification error]", err);
      });
    }

    return apiSuccess({
      message: "Class started successfully.",
      whiteboardSession: wbSession,
      serverTime: now.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
