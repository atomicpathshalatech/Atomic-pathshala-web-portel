import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { pushHandRaiseQueue } from "@/lib/whiteboard/hand-raise";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

import { pusherServer, sessionChannel, WB_EVENTS } from "@/lib/realtime/pusher-server";
import { createApprovedSpeakerToken, videoRoomName } from "@/lib/livekit/server";

/** Teacher acts on one raised hand: APPROVE, REJECT, or CLEAR/RESOLVE. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; handRaiseId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access || access.role !== "TEACHER") throw new ForbiddenError();

    let action = "RESOLVE";
    try {
      const body = await request.json();
      if (body?.action) action = body.action.toUpperCase();
    } catch {
      // default to resolve
    }

    const handRaise = await prisma.handRaiseEvent.findUnique({
      where: { id: params.handRaiseId },
      include: { student: { include: { user: true } } },
    });

    if (!handRaise || handRaise.whiteboardSessionId !== params.id) {
      return apiError("Hand raise not found.", 404);
    }

    const now = new Date();

    if (action === "APPROVE") {
      let speakerToken: string | null = null;
      try {
        speakerToken = await createApprovedSpeakerToken({
          identity: handRaise.student.userId,
          name: handRaise.student.user.name,
          roomName: videoRoomName(params.id),
          audioOnly: handRaise.requestType === "AUDIO",
        });
      } catch (err) {
        console.warn("LiveKit speaker token generation warning:", err);
      }

      await prisma.handRaiseEvent.update({
        where: { id: params.handRaiseId },
        data: {
          status: "APPROVED",
          approvedAt: now,
          liveKitGranted: true,
        },
      });

      // Broadcast to all participants that this student is now an approved speaker
      try {
        await pusherServer.trigger(sessionChannel(params.id), WB_EVENTS.SPEAKER_APPROVED, {
          handRaiseId: handRaise.id,
          studentId: handRaise.studentId,
          studentUserId: handRaise.student.userId,
          studentName: handRaise.student.user.name,
          requestType: handRaise.requestType,
          speakerToken,
        });
      } catch (err) {
        console.error("Pusher trigger error:", err);
      }
    } else if (action === "REJECT") {
      await prisma.handRaiseEvent.update({
        where: { id: params.handRaiseId },
        data: {
          status: "REJECTED",
          rejectedAt: now,
          resolvedAt: now,
          liveKitGranted: false,
        },
      });

      try {
        await pusherServer.trigger(sessionChannel(params.id), WB_EVENTS.SPEAKER_REVOKED, {
          handRaiseId: handRaise.id,
          studentId: handRaise.studentId,
          studentUserId: handRaise.student.userId,
          reason: "rejected",
        });
      } catch (err) {
        console.error("Pusher trigger error:", err);
      }
    } else {
      // Default: RESOLVE / CLEAR
      await prisma.handRaiseEvent.update({
        where: { id: params.handRaiseId },
        data: {
          status: "RESOLVED",
          resolvedAt: now,
          liveKitGranted: false,
        },
      });

      try {
        await pusherServer.trigger(sessionChannel(params.id), WB_EVENTS.SPEAKER_REVOKED, {
          handRaiseId: handRaise.id,
          studentId: handRaise.studentId,
          studentUserId: handRaise.student.userId,
          reason: "cleared",
        });
      } catch (err) {
        console.error("Pusher trigger error:", err);
      }
    }

    const queue = await pushHandRaiseQueue(params.id);
    return apiSuccess({ queue });
  } catch (error) {
    return handleApiError(error);
  }
}

