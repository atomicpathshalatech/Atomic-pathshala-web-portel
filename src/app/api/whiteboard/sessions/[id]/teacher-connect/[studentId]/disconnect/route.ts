import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { pusherServer, sessionChannel, WB_EVENTS } from "@/lib/realtime/pusher-server";
import { videoRoomName } from "@/lib/livekit/server";
import { muteStudentPublishedTracks, setParticipantPublishPermission } from "@/lib/livekit/room-service";

/**
 * Disconnects a student's teacher-initiated audio/video connection. Never
 * removes the student from the classroom or the LiveKit room — only clears
 * their publish permission (the client's own
 * setMicrophoneEnabled/setCameraEnabled(false), triggered by the Pusher
 * event below, is the primary mechanism; the server-side mute call is a
 * defense-in-depth backstop for a client that ignores the event).
 *
 * Either the teacher (any student, via the URL's studentId) or the student
 * themselves (their own connection only) can call this. Previously only the
 * teacher could — a student ending the call from their own end-call button
 * just cleared local UI state with no server call at all, so the
 * TeacherStudentConnection row stayed CONNECTED forever: the teacher's own
 * view never learned the call had ended, and the student's publish
 * permission was never actually revoked server-side ("call cut nahi ho
 * rahi" — the exact reported symptom). A student caller's own resolved
 * entityId is used as the target regardless of the URL's studentId, so
 * there's no way for a student to disconnect someone else's connection by
 * passing a different id.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string; studentId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access) throw new ForbiddenError();
    if (access.role !== "TEACHER" && access.role !== "STUDENT") throw new ForbiddenError();

    const targetStudentId = access.role === "STUDENT" ? access.entityId : params.studentId;

    const existing = await prisma.teacherStudentConnection.findUnique({
      where: { whiteboardSessionId_studentId: { whiteboardSessionId: params.id, studentId: targetStudentId } },
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
        studentId: targetStudentId,
        studentUserId: existing.student.user.id,
        audioConnected: false,
        videoConnected: false,
        connectionToken: null,
      });
    } catch (err) {
      console.error("[teacher-connect/disconnect] Pusher trigger error:", err);
    }

    await muteStudentPublishedTracks(videoRoomName(params.id), existing.student.user.id);
    await setParticipantPublishPermission(videoRoomName(params.id), existing.student.user.id, false);

    return apiSuccess({ disconnected: true });
  } catch (error) {
    return handleApiError(error);
  }
}
