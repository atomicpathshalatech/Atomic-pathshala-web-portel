import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { resolveTeacherForSchedule } from "@/lib/classroom/access";
import { transitionBroadcast } from "@/lib/classroom/youtube-broadcast";
import { deleteRelayPath, mediaRelayConfigured } from "@/lib/classroom/media-relay";
import { pusherServer, classroomChannel, CLASSROOM_EVENTS } from "@/lib/realtime/pusher-server";

export async function POST(_request: NextRequest, { params }: { params: { scheduleId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CLASSROOM_ACCESS);

    const { schedule, teacher } = await resolveTeacherForSchedule(session.user.id, params.scheduleId);
    if (!schedule) return apiError("Scheduled class not found", 404);
    if (!teacher) throw new ForbiddenError("You are not authorized to control this classroom.");

    const classroomSession = await prisma.classroomSession.findUnique({ where: { batchScheduleId: params.scheduleId } });
    if (!classroomSession) return apiError("Classroom session not found", 404);
    if (classroomSession.phase === "ENDED" || classroomSession.phase === "RECORDED") {
      return apiSuccess({ classroomSession, alreadyEnded: true });
    }

    if (classroomSession.youtubeBroadcastId) {
      try {
        await transitionBroadcast(classroomSession.youtubeBroadcastId, "complete");
      } catch (err) {
        // Non-fatal — a broadcast that never actually went live (teacher
        // started, never went live, then ended) may already be in a state
        // that rejects `complete`; the class still ends locally either way.
        console.warn("[classroom_end_youtube_transition_warning]", err);
      }
    }

    const now = new Date();
    const updated = await prisma.classroomSession.update({
      where: { id: classroomSession.id },
      data: {
        phase: "PROCESSING_RECORDING",
        endedAt: now,
        recordingStatus: classroomSession.youtubeBroadcastId ? "PROCESSING" : "NOT_AVAILABLE",
      },
    });

    if (classroomSession.streamMethod === "BROWSER_RELAY" && classroomSession.relayPath && mediaRelayConfigured()) {
      // Grace-delayed rather than immediate, in case of a brief reconnect
      // right around "End Classroom" being clicked.
      setTimeout(() => {
        deleteRelayPath(classroomSession.relayPath!).catch((err) =>
          console.error("[classroom_relay_cleanup_error]", err)
        );
      }, 30_000);
    }

    try {
      await pusherServer.trigger(classroomChannel(updated.id), CLASSROOM_EVENTS.PHASE_CHANGED, {
        phase: "PROCESSING_RECORDING",
        endedAt: updated.endedAt?.toISOString(),
      });
    } catch (err) {
      console.warn("[classroom_pusher_warning]", err);
    }

    return apiSuccess({ classroomSession: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
