import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveClassroomAccess } from "@/lib/classroom/access";
import { pusherServer, classroomChannel } from "@/lib/realtime/pusher-server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/** Shared teacher/student read: session state + live student count. Never returns youtubeStreamKey/relayWhipUrl to a STUDENT. */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveClassroomAccess(session.user.id, params.id);
    if (!access) throw new ForbiddenError();

    const classroomSession = await prisma.classroomSession.findUnique({ where: { id: params.id } });
    if (!classroomSession) return apiError("Classroom session not found", 404);

    let studentCount = 0;
    try {
      const result = await pusherServer.get({
        path: `/channels/${classroomChannel(params.id)}`,
        params: { info: "subscription_count" },
      });
      const json = await result.json();
      studentCount = json?.subscription_count ?? 0;
    } catch {
      // Presence-channel lookup is best-effort; the badge falls back to 0 rather than failing the whole request.
    }

    const base = {
      id: classroomSession.id,
      title: classroomSession.title,
      phase: classroomSession.phase,
      chatEnabled: classroomSession.chatEnabled,
      handRaiseEnabled: classroomSession.handRaiseEnabled,
      youtubeVideoId: classroomSession.youtubeVideoId,
      recordingVideoId: classroomSession.recordingVideoId,
      recordingStatus: classroomSession.recordingStatus,
      startedAt: classroomSession.startedAt,
      endedAt: classroomSession.endedAt,
      studentCount,
    };

    if (access.role !== "TEACHER") return apiSuccess({ classroomSession: base, role: access.role });

    return apiSuccess({
      classroomSession: {
        ...base,
        streamMethod: classroomSession.streamMethod,
        relayWhipUrl: classroomSession.relayWhipUrl,
        youtubeIngestUrl: classroomSession.youtubeIngestUrl,
        youtubeStreamKey: classroomSession.youtubeStreamKey,
      },
      role: access.role,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
