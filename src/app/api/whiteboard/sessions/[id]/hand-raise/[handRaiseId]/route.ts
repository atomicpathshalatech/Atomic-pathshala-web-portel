import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { pushHandRaiseQueue } from "@/lib/whiteboard/hand-raise";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/** Teacher resolves (clears) one raised hand from the queue. */
export async function PATCH(
  _request: NextRequest,
  { params }: { params: { id: string; handRaiseId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access || access.role !== "TEACHER") throw new ForbiddenError();

    const updated = await prisma.handRaiseEvent.updateMany({
      where: { id: params.handRaiseId, whiteboardSessionId: params.id, status: "PENDING" },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });
    if (updated.count === 0) return apiError("Hand raise not found or already resolved.", 404);

    const queue = await pushHandRaiseQueue(params.id);
    return apiSuccess({ queue });
  } catch (error) {
    return handleApiError(error);
  }
}
