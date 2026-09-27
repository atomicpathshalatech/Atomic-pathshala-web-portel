import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { ONLINE_WINDOW_MS } from "@/lib/whiteboard/constants";

/**
 * How many students are in the class right now, from attendance heartbeats
 * (a student counts while their last heartbeat is within ONLINE_WINDOW_MS).
 * Replaces the Pusher presence member count, which stops at 100. Teacher
 * only; one indexed count query.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access || access.role !== "TEACHER") throw new ForbiddenError();

    const online = await prisma.liveClassAttendance.count({
      where: { whiteboardSessionId: params.id, lastSeenAt: { gte: new Date(Date.now() - ONLINE_WINDOW_MS) } },
    });
    return apiSuccess({ online, windowMs: ONLINE_WINDOW_MS });
  } catch (error) {
    return handleApiError(error);
  }
}
