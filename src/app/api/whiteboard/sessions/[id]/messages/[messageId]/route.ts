import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { messagePinSchema } from "@/lib/validation/whiteboard";
import { pushMessagePinned } from "@/lib/whiteboard/messages";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/**
 * Teacher pins/unpins a message to highlight it at the top of the chat for
 * the whole class (WhiteboardMessage.pinnedAt — added for Live Classroom v2
 * moderation but never wired up until now). Teacher-only: a student pinning
 * their own or a classmate's message would just be chat spam control, not a
 * feature anyone asked for.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; messageId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access) throw new ForbiddenError();
    if (access.role !== "TEACHER") {
      throw new ForbiddenError("Only the teacher can pin messages.");
    }

    const { pinned } = messagePinSchema.parse(await request.json());

    const message = await prisma.whiteboardMessage.findUnique({
      where: { id: params.messageId },
    });
    if (!message || message.whiteboardSessionId !== params.id) {
      return apiError("Message not found.", 404);
    }

    const pinnedAt = pinned ? new Date() : null;
    await prisma.whiteboardMessage.update({
      where: { id: params.messageId },
      data: { pinnedAt },
    });

    await pushMessagePinned(params.id, params.messageId, pinnedAt ? pinnedAt.toISOString() : null);

    return apiSuccess({ pinnedAt: pinnedAt ? pinnedAt.toISOString() : null });
  } catch (error) {
    return handleApiError(error);
  }
}
