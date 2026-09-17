import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { pusherServer, sessionChannel, WB_EVENTS } from "@/lib/realtime/pusher-server";
import { createApprovedSpeakerToken, videoRoomName } from "@/lib/livekit/server";

const connectSchema = z.object({
  studentId: z.string().min(1),
  mediaType: z.enum(["AUDIO", "VIDEO"]),
});

/**
 * Teacher-initiated connect — the reverse direction of hand-raise (teacher
 * grants directly, no student request needed). Mirrors the hand-raise
 * approval route's token-mint + Pusher-broadcast shape
 * (see hand-raise/[handRaiseId]/route.ts) but keyed by an independent
 * TeacherStudentConnection row instead of a HandRaiseEvent, since this is a
 * standing grant, not a resolved request.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access || access.role !== "TEACHER") throw new ForbiddenError();

    const { studentId, mediaType } = connectSchema.parse(await request.json());

    const wbSession = await prisma.whiteboardSession.findUnique({
      where: { id: params.id },
      select: { id: true, batchSchedule: { select: { batchId: true } } },
    });
    if (!wbSession) return apiError("Whiteboard session not found.", 404);

    const targetStudent = await prisma.student.findUnique({
      where: { id: studentId },
      include: { user: { select: { id: true, name: true } } },
    });
    if (!targetStudent) return apiError("Student not found.", 404);

    const enrollment = await prisma.batchEnrollment.findFirst({
      where: { studentId, batchId: wbSession.batchSchedule.batchId, status: "ACTIVE" },
    });
    if (!enrollment) {
      return apiError("This student is not actively enrolled in this class.", 403);
    }

    const existing = await prisma.teacherStudentConnection.findUnique({
      where: { whiteboardSessionId_studentId: { whiteboardSessionId: params.id, studentId } },
    });

    // Video implies audio (spec: audio works simultaneously once video
    // connects); a pure audio connect leaves an existing video grant as-is
    // rather than downgrading it.
    const nextAudioStatus = "CONNECTED" as const;
    const nextVideoStatus = mediaType === "VIDEO" ? ("CONNECTED" as const) : existing?.videoStatus ?? ("NOT_CONNECTED" as const);

    let connectionToken: string | null = null;
    try {
      connectionToken = await createApprovedSpeakerToken({
        identity: targetStudent.user.id,
        name: targetStudent.user.name,
        roomName: videoRoomName(params.id),
        audioOnly: nextVideoStatus !== "CONNECTED",
      });
    } catch (err) {
      console.warn("[teacher-connect] LiveKit token generation warning:", err);
    }

    const now = new Date();
    const connection = await prisma.teacherStudentConnection.upsert({
      where: { whiteboardSessionId_studentId: { whiteboardSessionId: params.id, studentId } },
      create: {
        whiteboardSessionId: params.id,
        studentId,
        audioStatus: nextAudioStatus,
        videoStatus: nextVideoStatus,
        requestedById: session.user.id,
        connectedAt: now,
      },
      update: {
        audioStatus: nextAudioStatus,
        videoStatus: nextVideoStatus,
        requestedById: session.user.id,
        connectedAt: now,
        disconnectedAt: null,
      },
    });

    try {
      await pusherServer.trigger(sessionChannel(params.id), WB_EVENTS.TEACHER_CONNECT_UPDATED, {
        studentId,
        studentUserId: targetStudent.user.id,
        studentName: targetStudent.user.name,
        audioConnected: connection.audioStatus === "CONNECTED",
        videoConnected: connection.videoStatus === "CONNECTED",
        connectionToken,
      });
    } catch (err) {
      console.error("[teacher-connect] Pusher trigger error:", err);
    }

    return apiSuccess({
      connection: {
        studentId: connection.studentId,
        audioConnected: connection.audioStatus === "CONNECTED",
        videoConnected: connection.videoStatus === "CONNECTED",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Status snapshot — avoids a UI flash of "not connected" before the first
 * Pusher event arrives, and lets a student who refreshed mid-connection
 * restore state without waiting for the next teacher action (server state
 * is authoritative, per spec).
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access) throw new ForbiddenError();

    if (access.role === "TEACHER") {
      const connections = await prisma.teacherStudentConnection.findMany({
        where: { whiteboardSessionId: params.id, OR: [{ audioStatus: "CONNECTED" }, { videoStatus: "CONNECTED" }] },
        select: { studentId: true, audioStatus: true, videoStatus: true },
      });
      return apiSuccess({
        connections: connections.map((c) => ({
          studentId: c.studentId,
          audioConnected: c.audioStatus === "CONNECTED",
          videoConnected: c.videoStatus === "CONNECTED",
        })),
      });
    }

    const own = await prisma.teacherStudentConnection.findUnique({
      where: { whiteboardSessionId_studentId: { whiteboardSessionId: params.id, studentId: access.entityId } },
      select: { audioStatus: true, videoStatus: true },
    });

    const audioConnected = own?.audioStatus === "CONNECTED";
    const videoConnected = own?.videoStatus === "CONNECTED";

    // Refresh mid-connection: re-mint the speaker token so the client can
    // actually resume publishing instead of just knowing that it should.
    // Server state (the row above) stays authoritative either way.
    let connectionToken: string | null = null;
    if (audioConnected || videoConnected) {
      try {
        connectionToken = await createApprovedSpeakerToken({
          identity: session.user.id,
          name: access.name,
          roomName: videoRoomName(params.id),
          audioOnly: !videoConnected,
        });
      } catch (err) {
        console.warn("[teacher-connect] LiveKit token refresh warning:", err);
      }
    }

    return apiSuccess({ audioConnected, videoConnected, connectionToken });
  } catch (error) {
    return handleApiError(error);
  }
}
