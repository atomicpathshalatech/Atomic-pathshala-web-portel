import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { createVideoAccessToken } from "@/lib/livekit/server";
import { pusherServer, sessionChannel, WB_EVENTS } from "@/lib/realtime/pusher-server";
import { canTeacherStartClass } from "@/lib/schedule/access-rules";
import crypto from "crypto";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    const teacher = await prisma.teacher.findUnique({
      where: { userId: session.user.id },
    });

    if (!teacher && session.user.role !== "ADMIN") {
      return apiError("Only teachers can start a live class.", 403);
    }

    // Lookup LiveClass or BatchSchedule
    let liveClass = await prisma.liveClass.findUnique({
      where: { id: params.id },
    });

    // If not found by direct ID, check if params.id is a batchScheduleId
    if (!liveClass) {
      liveClass = await prisma.liveClass.findUnique({
        where: { batchScheduleId: params.id },
      });
    }

    let schedule = null;
    if (liveClass?.batchScheduleId) {
      schedule = await prisma.batchSchedule.findUnique({
        where: { id: liveClass.batchScheduleId },
        include: { liveWhiteboardSession: true },
      });
    } else {
      schedule = await prisma.batchSchedule.findUnique({
        where: { id: params.id },
        include: { liveWhiteboardSession: true },
      });
    }

    const now = new Date();

    const scheduleTarget = schedule ?? {
      id: liveClass?.id || params.id,
      startsAt: liveClass?.scheduledStart || now,
      endsAt: liveClass?.scheduledEnd || new Date(now.getTime() + 60 * 60 * 1000),
      status: liveClass?.status || "SCHEDULED",
    };

    // Authoritative T-5 Window Validation
    const evaluation = canTeacherStartClass(scheduleTarget, now);
    if (!evaluation.allowed) {
      return apiError(
        evaluation.reason || "Live class cannot be started yet. Starting is allowed within 5 minutes of scheduled start time.",
        403,
        {
          code: evaluation.code || "START_TOO_EARLY",
          details: {
            opensAt: evaluation.opensAt.toISOString(),
            startOpensAt: evaluation.startOpensAt.toISOString(),
            secondsUntilStartOpens: evaluation.secondsUntilStartOpens,
            serverTime: now.toISOString(),
          },
        }
      );
    }

    // If still not found, create/link LiveClass record
    if (!liveClass && schedule) {
      const roomName = `atomic-live-${crypto.randomUUID()}`;
      liveClass = await prisma.liveClass.create({
        data: {
          batchScheduleId: schedule.id,
          roomName,
          teacherId: teacher?.id || schedule.teacherId || session.user.id,
          status: "SCHEDULED",
          scheduledStart: schedule.startsAt,
          scheduledEnd: schedule.endsAt,
        },
      });
    }

    if (!liveClass) {
      return apiError("Live class session not found", 404);
    }

    // Transition state to LIVE
    const updatedClass = await prisma.liveClass.update({
      where: { id: liveClass.id },
      data: {
        status: "LIVE",
        actualStart: liveClass.actualStart || now,
      },
    });

    // Sync BatchSchedule & WhiteboardSession
    if (liveClass.batchScheduleId) {
      await prisma.batchSchedule.update({
        where: { id: liveClass.batchScheduleId },
        data: { status: "LIVE" },
      }).catch(() => null);

      await prisma.whiteboardSession.upsert({
        where: { batchScheduleId: liveClass.batchScheduleId },
        update: { livePhase: "LIVE", status: "ACTIVE", actualStartedAt: now },
        create: {
          batchScheduleId: liveClass.batchScheduleId,
          teacherId: liveClass.teacherId,
          title: "Live Class",
          status: "ACTIVE",
          livePhase: "LIVE",
          actualStartedAt: now,
        },
      }).catch(() => null);
    }

    // Generate LiveKit access token
    const token = await createVideoAccessToken({
      identity: session.user.id,
      name: session.user.name || "Teacher",
      roomName: updatedClass.roomName,
    });

    // Broadcast realtime event
    try {
      if (liveClass.batchScheduleId) {
        await pusherServer.trigger(
          sessionChannel(liveClass.batchScheduleId),
          WB_EVENTS.LIVE_PHASE_CHANGED,
          { phase: "LIVE", actualStartedAt: now.toISOString(), serverTime: now.toISOString() }
        );
      }
    } catch (pushErr) {
      console.warn("[LiveClass] Realtime broadcast warning:", pushErr);
    }

    return apiSuccess({
      liveClassId: updatedClass.id,
      roomName: updatedClass.roomName,
      status: updatedClass.status,
      token,
      url: process.env.NEXT_PUBLIC_LIVEKIT_URL || process.env.LIVEKIT_URL,
      serverTime: now.toISOString(),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
