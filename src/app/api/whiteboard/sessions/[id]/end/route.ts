import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { pusherServer, sessionChannel, teacherChannel, WB_EVENTS } from "@/lib/realtime/pusher-server";

/**
 * Ends a live class. Also auto-resolves any still-PENDING hand raises and
 * closes any still-open quiz so nothing is left dangling in a "live" state
 * after the teacher has walked away — the DB stays the source of truth for
 * "is this session over", Pusher is only used to nudge any open student
 * tabs to stop polling/leave immediately.
 */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access || access.role !== "TEACHER") throw new ForbiddenError();

    const existing = await prisma.whiteboardSession.findUnique({
      where: { id: params.id },
      include: { batchSchedule: true },
    });
    if (!existing) return apiError("Whiteboard session not found", 404);
    if (existing.status === "ENDED") {
      return apiSuccess({ whiteboardSession: existing });
    }

    const [ended] = await prisma.$transaction([
      prisma.whiteboardSession.update({
        where: { id: params.id },
        // livePhase mirrors status here — ending the class always fully
        // ends the lobby/live lifecycle too, whichever phase it was in
        // (including a class ended straight out of the lobby, before the
        // teacher ever clicked Start Class).
        data: { status: "ENDED", endedAt: new Date(), livePhase: "ENDED" },
      }),
      prisma.handRaiseEvent.updateMany({
        where: { whiteboardSessionId: params.id, status: "PENDING" },
        data: { status: "RESOLVED", resolvedAt: new Date() },
      }),
      prisma.quizSession.updateMany({
        where: { whiteboardSessionId: params.id, status: { in: ["ACTIVE", "REVEALED"] } },
        data: { status: "CLOSED" },
      }),
    ]);

    if (existing.batchSchedule.status === "LIVE") {
      await prisma.batchSchedule.update({
        where: { id: existing.batchScheduleId },
        data: { status: "COMPLETED" },
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "WHITEBOARD_SESSION_ENDED",
        entityType: "WhiteboardSession",
        entityId: params.id,
        metadata: { batchScheduleId: existing.batchScheduleId },
      },
    });

    try {
      await pusherServer.trigger(sessionChannel(params.id), WB_EVENTS.SESSION_ENDED, {});
      await pusherServer.trigger(teacherChannel(params.id), WB_EVENTS.SESSION_ENDED, {});
    } catch (err) {
      // Realtime is a convenience nudge, not the source of truth — a client
      // that misses this will still see status: "ENDED" on its next fetch.
      console.error("[pusher_trigger_error]", err);
    }

    return apiSuccess({ whiteboardSession: ended });
  } catch (error) {
    return handleApiError(error);
  }
}
