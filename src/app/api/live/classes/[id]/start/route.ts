import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { createVideoAccessToken } from "@/lib/livekit/server";
import { pusherServer, sessionChannel, WB_EVENTS } from "@/lib/realtime/pusher-server";
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

    // If still not found, check BatchSchedule to create/link LiveClass record
    if (!liveClass) {
      const schedule = await prisma.batchSchedule.findUnique({
        where: { id: params.id },
      });

      if (!schedule) return apiError("Live class session not found", 404);

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

    const now = new Date();

    // Verify T-15 start window
    const opensAt = new Date(liveClass.scheduledStart.getTime() - 15 * 60 * 1000);
    if (now.getTime() < opensAt.getTime()) {
      return apiError("Live class can only be started within 15 minutes of scheduled start time.", 403, {
        code: "START_WINDOW_NOT_OPEN",
        details: { opensAt: opensAt.toISOString() },
      });
    }

    // Transition state to LIVE
    const updatedClass = await prisma.liveClass.update({
      where: { id: liveClass.id },
      data: {
        status: "LIVE",
        actualStart: liveClass.actualStart || now,
      },
    });

    // Also sync BatchSchedule & WhiteboardSession if linked
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

    // Generate short-lived LiveKit access token
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
          { phase: "LIVE", actualStartedAt: now.toISOString() }
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
    });
  } catch (error) {
    return handleApiError(error);
  }
}
