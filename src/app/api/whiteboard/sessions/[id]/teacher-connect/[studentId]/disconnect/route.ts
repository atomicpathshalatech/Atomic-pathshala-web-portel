import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { pusherServer, sessionChannel, WB_EVENTS } from "@/lib/realtime/pusher-server";
import { videoRoomName } from "@/lib/livekit/server";
import { muteStudentPublishedTracks } from "@/lib/livekit/room-service";

/**
 * Teacher disconnects a student's audio/video. Never removes the student
 * from the classroom or the LiveKit room — only clears their publish
 * permission (the client's own setMicrophoneEnabled/setCameraEnabled(false),
 * triggered by the Pusher event below, is the primary mechanism; the
 * server-side mute call is a defense-in-depth backstop for a client that
 * ignores the event).
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string; studentId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access || access.role !== "TEACHER") throw new ForbiddenError();

    const existing = await prisma.teacherStudentConnection.findUnique({
      where: { whiteboardSessionId_studentId: { whiteboardSessionId: params.id, studentId: params.studentId } },
      include: { student: { include: { user: { select: { id: true } } } } },
    });
    if (!existing) return apiError("No active connection found for this student.", 404);

    const now = new Date();
    await prisma.teacherStudentConnection.update({
      where: { id: existing.id },
      data: { audioStatus: "DISCONNECTED", videoStatus: "DISCONNECTED", disconnectedAt: now },
    });

    try {
      await pusherServer.trigger(sessionChannel(params.id), WB_EVENTS.TEACHER_CONNECT_UPDATED, {
        studentId: params.studentId,
        studentUserId: existing.student.user.id,
        audioConnected: false,
        videoConnected: false,
        connectionToken: null,
      });
    } catch (err) {
      console.error("[teacher-connect/disconnect] Pusher trigger error:", err);
    }

    await muteStudentPublishedTracks(videoRoomName(params.id), existing.student.user.id);

    return apiSuccess({ disconnected: true });
  } catch (error) {
    return handleApiError(error);
  }
}
