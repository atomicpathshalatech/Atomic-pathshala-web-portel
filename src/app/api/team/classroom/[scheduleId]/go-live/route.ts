import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { resolveTeacherForSchedule } from "@/lib/classroom/access";
import { transitionBroadcast } from "@/lib/classroom/youtube-broadcast";
import { pusherServer, classroomChannel, CLASSROOM_EVENTS } from "@/lib/realtime/pusher-server";

/**
 * Called once the teacher's video is confirmed reaching YouTube's ingest —
 * for BROWSER_RELAY, after the browser's WHIP publish connects (see
 * CameraPublisher.tsx); for EXTERNAL_ENCODER, the teacher clicks "I'm live
 * in OBS" once their encoder is connected. Transitions the YouTube broadcast
 * to `live` and flips ClassroomSession.phase to LIVE.
 */
export async function POST(_request: NextRequest, { params }: { params: { scheduleId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CLASSROOM_ACCESS);

    const { schedule, teacher } = await resolveTeacherForSchedule(session.user.id, params.scheduleId);
    if (!schedule) return apiError("Scheduled class not found", 404);
    if (!teacher) throw new ForbiddenError("You are not authorized to control this classroom.");

    const classroomSession = await prisma.classroomSession.findUnique({ where: { batchScheduleId: params.scheduleId } });
    if (!classroomSession) return apiError("Classroom has not been configured yet — call Start first.", 404);
    if (classroomSession.phase === "LIVE") {
      return apiSuccess({ classroomSession, alreadyLive: true });
    }
    if (!classroomSession.youtubeBroadcastId) {
      return apiError("YouTube broadcast has not been created for this classroom yet.", 409);
    }

    try {
      await transitionBroadcast(classroomSession.youtubeBroadcastId, "live");
    } catch (err) {
      console.error("[classroom_go_live_youtube_error]", err);
      return apiError(
        "YouTube did not confirm the stream is live yet — make sure your camera/OBS is actually publishing, then try again.",
        409
      );
    }

    const now = new Date();
    const updated = await prisma.classroomSession.update({
      where: { id: classroomSession.id },
      data: { phase: "LIVE", startedAt: classroomSession.startedAt ?? now, youtubeStatus: "live" },
    });

    try {
      await pusherServer.trigger(classroomChannel(updated.id), CLASSROOM_EVENTS.PHASE_CHANGED, {
        phase: "LIVE",
        youtubeVideoId: updated.youtubeVideoId,
        startedAt: updated.startedAt?.toISOString(),
      });
    } catch (err) {
      console.warn("[classroom_pusher_warning]", err);
    }

    return apiSuccess({ classroomSession: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
