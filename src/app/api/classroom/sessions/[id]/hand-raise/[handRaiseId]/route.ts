import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveClassroomAccess } from "@/lib/classroom/access";
import { pushClassroomHandRaiseQueue } from "@/lib/classroom/hand-raise";
import { pusherServer, classroomChannel, CLASSROOM_EVENTS } from "@/lib/realtime/pusher-server";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { deleteFile, keyFromPublicUrl } from "@/lib/storage";

/**
 * Teacher acts on one raised hand: APPROVE, REJECT, or RESOLVE. Unlike
 * Whiteboard's hand-raise PATCH, this never touches LiveKit — Classroom has
 * no peer audio/video channel to grant, so approving just tells the student
 * "the teacher will address your question," typically via chat or by voice
 * on the YouTube stream itself.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string; handRaiseId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    const access = await resolveClassroomAccess(session.user.id, params.id);
    if (!access || access.role !== "TEACHER") throw new ForbiddenError();

    let action = "RESOLVE";
    try {
      const body = await request.json();
      if (body?.action) action = String(body.action).toUpperCase();
    } catch {
      // default to resolve
    }

    const handRaise = await prisma.classroomHandRaise.findUnique({
      where: { id: params.handRaiseId },
      include: { student: { include: { user: true } } },
    });
    if (!handRaise || handRaise.classroomSessionId !== params.id) return apiError("Hand raise not found.", 404);

    const now = new Date();
    const statusMap: Record<string, { status: "APPROVED" | "REJECTED" | "RESOLVED"; extra: Record<string, unknown> }> = {
      APPROVE: { status: "APPROVED", extra: { approvedAt: now } },
      REJECT: { status: "REJECTED", extra: { rejectedAt: now, resolvedAt: now } },
      RESOLVE: { status: "RESOLVED", extra: { resolvedAt: now } },
    };
    const resolved = statusMap[action] ?? { status: "RESOLVED" as const, extra: { resolvedAt: now } };

    await prisma.classroomHandRaise.update({
      where: { id: params.handRaiseId },
      data: { status: resolved.status, ...resolved.extra },
    });

    try {
      await pusherServer.trigger(classroomChannel(params.id), CLASSROOM_EVENTS.HAND_RAISE_UPDATED, {
        handRaiseId: handRaise.id,
        studentId: handRaise.studentId,
        studentUserId: handRaise.student.userId,
        status: resolved.status,
      });
    } catch (err) {
      console.error("[classroom_pusher_trigger_error]", err);
    }

    const queue = await pushClassroomHandRaiseQueue(params.id);
    return apiSuccess({ queue });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Teacher-only: permanently removes one hand-raise entry, cleaning up its attached doubt image in R2, if any. */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string; handRaiseId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    const access = await resolveClassroomAccess(session.user.id, params.id);
    if (!access || access.role !== "TEACHER") throw new ForbiddenError();

    const handRaise = await prisma.classroomHandRaise.findUnique({ where: { id: params.handRaiseId } });
    if (!handRaise || handRaise.classroomSessionId !== params.id) return apiError("Hand raise not found.", 404);

    await prisma.classroomHandRaise.delete({ where: { id: params.handRaiseId } });

    const imageKey = handRaise.imageUrl ? keyFromPublicUrl(handRaise.imageUrl) : null;
    if (imageKey) deleteFile(imageKey).catch(() => undefined);

    const queue = await pushClassroomHandRaiseQueue(params.id);
    return apiSuccess({ deleted: true, queue });
  } catch (error) {
    return handleApiError(error);
  }
}
