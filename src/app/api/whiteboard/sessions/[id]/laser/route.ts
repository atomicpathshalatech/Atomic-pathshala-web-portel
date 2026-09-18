import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { pushLaserPointer } from "@/lib/whiteboard/board-mirror";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

const MAX_POINTS = 500; // a laser stroke reasonably tops out well under this

/**
 * Teacher-only. Broadcasts a laser-pointer stroke to the session channel so
 * students' read-only board mirror can render it too — not persisted
 * anywhere (see the comment on WB_EVENTS.LASER_POINTER), so this is
 * deliberately the lightest route in the whiteboard API: one access check,
 * one Pusher trigger, no database I/O. Called throttled while drawing
 * ("move") and once more on pointer-up ("end") by the client.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access || access.role !== "TEACHER") throw new ForbiddenError();

    const body = await request.json();
    const phase = body?.phase === "end" ? "end" : "move";
    const rawPoints = Array.isArray(body?.points) ? body.points : [];
    const points = rawPoints
      .slice(0, MAX_POINTS)
      .filter((p: any) => typeof p?.x === "number" && typeof p?.y === "number")
      .map((p: any) => ({ x: p.x, y: p.y }));

    if (points.length === 0) return apiError("No points provided.", 400);

    await pushLaserPointer(params.id, points, phase);

    return apiSuccess({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
