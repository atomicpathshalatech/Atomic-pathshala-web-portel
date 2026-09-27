import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UnauthorizedError } from "@/lib/rbac/guard";
import { assertCanControlLiveClass } from "@/lib/live-class/ownership";
import { endWhiteboardSession } from "@/lib/whiteboard/lifecycle";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/**
 * Ends a live class. Also auto-resolves any still-PENDING hand raises and
 * closes any still-open quiz so nothing is left dangling in a "live" state
 * after the teacher has walked away — see endWhiteboardSession, the same
 * logic the lazy backend auto-end check (resolveWhiteboardAccess) reuses.
 *
 * Only the class's controlling teacher or a LIVE_CLASS_ADMIN may end it
 * (not any teacher of the batch).
 */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const { scheduleId } = await assertCanControlLiveClass(session.user.id, params.id);
    if (!scheduleId) return apiError("Whiteboard session not found", 404);

    const ended = await endWhiteboardSession(params.id, { endedByUserId: session.user.id, reason: "manual" });
    if (!ended) return apiError("Whiteboard session not found", 404);

    return apiSuccess({ whiteboardSession: ended });
  } catch (error) {
    return handleApiError(error);
  }
}
