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
import { setParticipantPublishPermission } from "@/lib/livekit/room-service";
import { deleteFile, keyFromPublicUrl } from "@/lib/storage";

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

    // Every mode (LIVEKIT, YOUTUBE, BOTH) now grants a real, on-demand,
    // audio-only LiveKit connection when a hand raise is approved — in
    // YOUTUBE mode specifically, the teacher and this one approved student
    // are the only participants who ever join LiveKit at all (see
    // forceLocalOnly in TeacherLiveClassRoom and the isApprovedSpeaker gate
    // in StudentLiveClassRoom), so this stays effectively free the rest of
    // the time. Previously this was skipped entirely for YOUTUBE/BOTH,
    // which meant "approving" a hand raise never actually connected any
    // audio between teacher and student.
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

      // The student is already connected to the room (subscribe-only) by
      // the time they raise a hand — swapping the token client-side after
      // that is a no-op (see the comment on setParticipantPublishPermission
      // in room-service.ts). This is what actually unlocks their mic/camera.
      await setParticipantPublishPermission(videoRoomName(params.id), handRaise.student.userId, true);

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
      // Default: RESOLVE / CLEAR — ending an already-approved speaking turn
      // (REJECT above only ever applies to a still-pending, never-approved
      // request, so there is nothing to revoke there).
      if (handRaise.liveKitGranted) {
        await setParticipantPublishPermission(videoRoomName(params.id), handRaise.student.userId, false);
      }
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

/**
 * Teacher-only: permanently removes one hand-raise entry (e.g. a picked or
 * no-longer-needed photographed doubt) — distinct from PATCH's
 * REJECT/RESOLVE, which keep the row around as RESOLVED/REJECTED history.
 * Cleans up the attached doubt image in R2, if any.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; handRaiseId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access || access.role !== "TEACHER") throw new ForbiddenError();

    const handRaise = await prisma.handRaiseEvent.findUnique({ where: { id: params.handRaiseId } });
    if (!handRaise || handRaise.whiteboardSessionId !== params.id) {
      return apiError("Hand raise not found.", 404);
    }

    await prisma.handRaiseEvent.delete({ where: { id: params.handRaiseId } });

    const imageKey = handRaise.imageUrl ? keyFromPublicUrl(handRaise.imageUrl) : null;
    if (imageKey) deleteFile(imageKey).catch(() => undefined);

    const queue = await pushHandRaiseQueue(params.id);
    return apiSuccess({ deleted: true, queue });
  } catch (error) {
    return handleApiError(error);
  }
}

