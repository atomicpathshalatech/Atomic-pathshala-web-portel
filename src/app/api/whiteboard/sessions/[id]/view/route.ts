import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { pushBoardView } from "@/lib/whiteboard/board-mirror";
import { cleanBoardView } from "@/lib/live-class/stage-link";
import { apiSuccess, handleApiError } from "@/lib/api/response";

/**
 * Teacher-only. Broadcasts the teacher's zoom / pan on the slide so the class
 * video (the OBS broadcast page) shows the same part of it. Like the laser
 * route: one access check, one Pusher trigger, nothing stored. The desktop
 * app's stage gets the same view directly over the stage link; this is the
 * path for OBS and the fallback when that link is down.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access || access.role !== "TEACHER") throw new ForbiddenError();

    const view = cleanBoardView(await request.json().catch(() => null));
    await pushBoardView(params.id, view);
    return apiSuccess({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
