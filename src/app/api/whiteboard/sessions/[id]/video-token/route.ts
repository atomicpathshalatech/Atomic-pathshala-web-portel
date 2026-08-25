import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { createVideoAccessToken, videoRoomName } from "@/lib/livekit/server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/**
 * Issues a LiveKit room-join token for this whiteboard session's video call.
 * Same access rule as everything else on a session (resolveWhiteboardAccess)
 * plus one extra gate: only while the class is actually ACTIVE — a token for
 * an ended session would let someone join a room nobody else is in.
 *
 * If LiveKit isn't configured on this deployment, this returns 503 rather
 * than 500 — a deliberately different status so the client can show "video
 * isn't set up" instead of a generic error, and so the rest of the live
 * class (board, hand raise, quiz) keeps working either way.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access) throw new ForbiddenError();

    const wbSession = await prisma.whiteboardSession.findUnique({ where: { id: params.id } });
    if (!wbSession) return apiError("Whiteboard session not found", 404);
    if (wbSession.status !== "ACTIVE") return apiError("This class isn't live right now.", 409);

    const url = process.env.NEXT_PUBLIC_LIVEKIT_URL;
    if (!url) return apiError("Video calling isn't configured on this server yet.", 503);

    let token: string;
    try {
      token = await createVideoAccessToken({
        identity: session.user.id,
        name: access.name,
        roomName: videoRoomName(params.id),
      });
    } catch {
      return apiError("Video calling isn't configured on this server yet.", 503);
    }

    return apiSuccess({ token, url, identity: session.user.id, role: access.role });
  } catch (error) {
    return handleApiError(error);
  }
}
