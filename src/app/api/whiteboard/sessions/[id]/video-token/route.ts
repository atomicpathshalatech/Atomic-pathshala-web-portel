import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import {
  createTeacherPublisherToken,
  createStudentViewerToken,
  videoRoomName,
} from "@/lib/livekit/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/**
 * Issues a LiveKit room-join token for this whiteboard session's video call.
 *
 * TEACHER → gets a publisher token (canPublish: true) so camera/mic stream
 * goes to the room for students to receive.
 *
 * STUDENT → gets a viewer token (canPublish: false) so they can only watch
 * without triggering a camera permission prompt. Students who have an
 * APPROVED hand-raise get a speaker token from /hand-raise/[id]/approve.
 *
 * For LIVE sessions, the 15-minute start window restriction is bypassed —
 * if the class is already LIVE, any authorized user can join the video room.
 * Returns 503 (not 500) if LiveKit is not configured.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access) throw new ForbiddenError();

    const wbSession = await prisma.whiteboardSession.findUnique({
      where: { id: params.id },
      include: { batchSchedule: true },
    });
    if (!wbSession) return apiError("Whiteboard session not found", 404);
    if (wbSession.status !== "ACTIVE") return apiError("This class isn't live right now.", 409);

    // For non-LIVE phases (pre-class prep), enforce the start window.
    // Once a class is LIVE, bypass the window — the session IS live.
    if (wbSession.livePhase !== "LIVE") {
      const { canStudentJoin, canTeacherStart } = await import("@/lib/schedule/access-rules");
      const scheduleTarget = wbSession.batchSchedule ?? {
        id: wbSession.id,
        startsAt: wbSession.scheduledStart ?? new Date(),
        endsAt: wbSession.scheduledEnd ?? new Date(Date.now() + 60 * 60 * 1000),
        status: ("SCHEDULED" as const),
        liveWhiteboardSession: wbSession,
      };

      const evaluation =
        access.role === "STUDENT"
          ? canStudentJoin(scheduleTarget, new Date())
          : canTeacherStart(scheduleTarget, new Date());

      if (!evaluation.allowed) {
        return apiError(
          evaluation.reason || "Video access is only allowed within 15 minutes of scheduled class start time.",
          403,
          {
            code: "JOIN_WINDOW_NOT_OPEN",
            details: {
              opensAt: evaluation.opensAt.toISOString(),
              secondsUntilWindowOpens: evaluation.secondsUntilWindowOpens,
            },
          }
        );
      }
    }

    const url = process.env.NEXT_PUBLIC_LIVEKIT_URL;
    if (!url) return apiError("Video calling isn't configured on this server yet.", 503);

    const roomName = videoRoomName(params.id);
    let token: string;
    try {
      if (access.role === "TEACHER") {
        token = await createTeacherPublisherToken({
          identity: session.user.id,
          name: access.name,
          roomName,
        });
      } else {
        // Student viewer: no camera/mic permission by default.
        // Approved speakers get their token from /hand-raise/[id]/approve.
        token = await createStudentViewerToken({
          identity: session.user.id,
          name: access.name,
          roomName,
        });
      }
    } catch {
      return apiError("Video calling isn't configured on this server yet.", 503);
    }

    return apiSuccess({ token, url, identity: session.user.id, role: access.role });
  } catch (error) {
    return handleApiError(error);
  }
}

