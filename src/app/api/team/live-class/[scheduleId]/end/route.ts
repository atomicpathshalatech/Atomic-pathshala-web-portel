import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { pusherServer, sessionChannel, WB_EVENTS } from "@/lib/realtime/pusher-server";
import { stopRoomRecording } from "@/lib/livekit/egress";

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

    const wbSession = schedule.liveWhiteboardSession;
    if (!wbSession) return apiError("Whiteboard session not found", 404);

    const now = new Date();

    // Stop the recording BEFORE flipping session state, best-effort. The
    // final "recording is ready, here's the file" transition happens later,
    // async, via the egress_ended webhook (src/app/api/webhooks/livekit) -
    // this call just tells LiveKit to finalize and upload.
    if (wbSession.recordingStatus === "RECORDING" && wbSession.recordingEgressId) {
      try {
        await stopRoomRecording(wbSession.recordingEgressId);
        await prisma.whiteboardSession
          .update({ where: { id: wbSession.id }, data: { recordingStatus: "PROCESSING" } })
          .catch(() => null);
      } catch (recordingError) {
        console.error("[live_class_recording_stop_error]", recordingError);
      }
    }

    const updatedSession = await prisma.whiteboardSession.update({
      where: { id: wbSession.id },
      data: {
        livePhase: "ENDED",
        status: "ENDED",
        endedAt: now,
        actualEndedAt: now,
      },
    });

    await prisma.batchSchedule.update({
      where: { id: params.scheduleId },
      data: { status: "COMPLETED" },
    });

    // Notify all participants that class has ended
    try {
      await pusherServer.trigger(sessionChannel(wbSession.id), WB_EVENTS.SESSION_ENDED, {
        endedAt: now.toISOString(),
      });
      await pusherServer.trigger(sessionChannel(wbSession.id), WB_EVENTS.LIVE_PHASE_CHANGED, {
        phase: "ENDED",
        endedAt: now.toISOString(),
      });
    } catch (pushErr) {
      console.warn("Realtime end broadcast warning:", pushErr);
    }

    return apiSuccess({
      message: "Class ended successfully.",
      whiteboardSession: updatedSession,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
