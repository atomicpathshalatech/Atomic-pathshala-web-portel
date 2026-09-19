import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveClassroomAccess } from "@/lib/classroom/access";
import { pushClassroomMessagePinned } from "@/lib/classroom/messages";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

const pinSchema = z.object({ pinned: z.boolean() });

/** Teacher pins/unpins a message — same moderation feature as Whiteboard's, on the Classroom's own table. */
export async function PATCH(request: NextRequest, { params }: { params: { id: string; messageId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveClassroomAccess(session.user.id, params.id);
    if (!access) throw new ForbiddenError();
    if (access.role !== "TEACHER") throw new ForbiddenError("Only the teacher can pin messages.");

    const { pinned } = pinSchema.parse(await request.json());

    const message = await prisma.classroomMessage.findUnique({ where: { id: params.messageId } });
    if (!message || message.classroomSessionId !== params.id) return apiError("Message not found.", 404);

    const pinnedAt = pinned ? new Date() : null;
    await prisma.classroomMessage.update({ where: { id: params.messageId }, data: { pinnedAt } });

    await pushClassroomMessagePinned(params.id, params.messageId, pinnedAt ? pinnedAt.toISOString() : null);

    return apiSuccess({ pinnedAt: pinnedAt ? pinnedAt.toISOString() : null });
  } catch (error) {
    return handleApiError(error);
  }
}
