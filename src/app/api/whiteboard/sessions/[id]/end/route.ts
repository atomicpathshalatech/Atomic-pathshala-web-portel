import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { endWhiteboardSession } from "@/lib/whiteboard/lifecycle";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/**
 * Ends a live class. Also auto-resolves any still-PENDING hand raises and
 * closes any still-open quiz so nothing is left dangling in a "live" state
 * after the teacher has walked away — see endWhiteboardSession, the same
 * logic the lazy backend auto-end check (resolveWhiteboardAccess) reuses.
 */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access || access.role !== "TEACHER") throw new ForbiddenError();

    const ended = await endWhiteboardSession(params.id, { endedByUserId: session.user.id, reason: "manual" });
    if (!ended) return apiError("Whiteboard session not found", 404);

    return apiSuccess({ whiteboardSession: ended });
  } catch (error) {
    return handleApiError(error);
  }
}
