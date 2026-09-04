import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { pushMessage } from "@/lib/whiteboard/messages";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { awardXp } from "@/lib/gamification/xp";

/**
 * Student-only "I'm here" ping — called once a student lands in the
 * pre-class lobby or the live board (see StudentLiveClassRoom's join
 * effect). Upserts LiveClassAttendance (the same row backs the final
 * attendance record for the class, per the @@unique on
 * [whiteboardSessionId, studentId]) and, ONLY the very first time this
 * student is ever seen on this session, posts a system chat message
 * ("X has joined the class") so the room can see who's arrived.
 *
 * Every later call for the same student — a reconnect, a page refresh, the
 * lobby-to-live transition re-triggering the join effect — hits the
 * existing row instead and does NOT re-announce; it just bumps
 * lastSeenAt/reconnectCount. This is what keeps a flaky connection from
 * spamming the chat with repeat "has joined" messages.
 */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access || access.role !== "STUDENT") throw new ForbiddenError();

    const wbSession = await prisma.whiteboardSession.findUnique({
      where: { id: params.id },
      include: { batchSchedule: true },
    });
    if (!wbSession) return apiError("Whiteboard session not found", 404);

    const { canStudentJoin } = await import("@/lib/schedule/access-rules");
    const scheduleTarget = wbSession.batchSchedule ?? {
      id: wbSession.id,
      startsAt: wbSession.scheduledStart ?? new Date(),
      endsAt: wbSession.scheduledEnd ?? new Date(Date.now() + 60 * 60 * 1000),
      status: wbSession.status === "ENDED" ? "COMPLETED" : wbSession.livePhase === "LIVE" ? "LIVE" : "SCHEDULED",
      liveWhiteboardSession: wbSession,
    };

    const evaluation = canStudentJoin(scheduleTarget, new Date());
    if (!evaluation.allowed) {
      return apiError(
        evaluation.reason || "Class is not accessible yet. Access opens 15 minutes before the scheduled start time.",
        403,
        {
          code: "JOIN_WINDOW_NOT_OPEN",
          details: {
            opensAt: evaluation.opensAt.toISOString(),
            secondsUntilWindowOpens: evaluation.secondsUntilWindowOpens,
          },
        }
      );
    }

    let firstJoin = false;
    try {
      await prisma.liveClassAttendance.create({
        data: { whiteboardSessionId: params.id, studentId: access.entityId },
      });
      firstJoin = true;
    } catch (err) {
      // P2002 = unique constraint violation on [whiteboardSessionId, studentId]
      // — this student has already joined before; treat it as a reconnect
      // rather than an error, same idempotency pattern used elsewhere in
      // this app for "the row might already exist" writes.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        await prisma.liveClassAttendance.update({
          where: {
            whiteboardSessionId_studentId: { whiteboardSessionId: params.id, studentId: access.entityId },
          },
          data: { lastSeenAt: new Date(), reconnectCount: { increment: 1 } },
        });
      } else {
        throw err;
      }
    }

    if (!firstJoin) {
      return apiSuccess({ joined: false });
    }

    // Real, backend-driven XP — not a display placeholder. This is the
    // first XPReason actually wired end-to-end (see src/lib/gamification/xp.ts);
    // test/DPP/doubt-resolution awards are still TODO in their own routes.
    await awardXp(access.entityId, 20, "LIVE_CLASS_ATTENDANCE", { whiteboardSessionId: params.id });

    const message = await prisma.whiteboardMessage.create({
      data: {
        whiteboardSessionId: params.id,
        authorRole: "STUDENT",
        authorUserId: session.user.id,
        authorName: access.name,
        body: `${access.name} has joined the class`,
        isSystemMessage: true,
      },
    });

    await pushMessage(params.id, {
      id: message.id,
      authorRole: "STUDENT",
      authorUserId: session.user.id,
      authorName: access.name,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
      isSystemMessage: true,
    });

    return apiSuccess({ joined: true, message }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
