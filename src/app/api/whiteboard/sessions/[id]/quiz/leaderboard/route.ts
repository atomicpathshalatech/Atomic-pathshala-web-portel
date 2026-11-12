import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { buildQuizLeaderboard, type LeaderboardEntry } from "@/lib/whiteboard/quiz-leaderboard";
import { prisma } from "@/lib/db";

export type StudentLeaderboardEntry = LeaderboardEntry;

/**
 * GET /api/whiteboard/sessions/[id]/quiz/leaderboard
 * Query Params: ?scope=session (default) | chapter
 * Real-time ranked leaderboard for the current live session or the whole
 * chapter (Batch + Chapter). Includes answers typed in the YouTube chat.
 * Ranking: accuracy % → correct count → avg response time → attempts.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access) throw new ForbiddenError();

    const scope = request.nextUrl.searchParams.get("scope") === "chapter" ? "chapter" : "session";
    const board = await buildQuizLeaderboard(params.id, scope);
    if (!board) return apiError("Whiteboard session not found", 404);
    // ?me=1 — the calling student's own place (the published card shows only the top 10).
    if (request.nextUrl.searchParams.get("me") === "1") {
      const student = await prisma.student.findUnique({ where: { userId: session.user.id }, select: { id: true } });
      const mine = student ? board.rankings.find((r) => r.studentId === student.id) : undefined;
      return apiSuccess({
        ...board,
        me: student
          ? { rank: mine?.rank ?? null, correctCount: mine?.correctCount ?? 0, totalAttempted: mine?.totalAttempted ?? 0 }
          : null,
      });
    }
    return apiSuccess(board);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/whiteboard/sessions/[id]/quiz/leaderboard
 * Teacher publishes the current leaderboard to everyone in the class.
 * Includes complete rankings so all individual students can calculate their own rank.
 * Broadcasts across both session channel and batch schedule channel.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const access = await resolveWhiteboardAccess(session.user.id, params.id);
    if (!access || access.role !== "TEACHER") throw new ForbiddenError();

    const body = await request.json().catch(() => ({}));
    const scope = body?.scope === "chapter" ? "chapter" : "session";
    const durationSec = typeof body?.durationSec === "number" && body.durationSec > 0 ? body.durationSec : 30;

    const board = await buildQuizLeaderboard(params.id, scope);
    if (!board) return apiError("Whiteboard session not found", 404);
    if (board.rankings.length === 0) {
      return apiError("No answers yet — run a poll and let students answer, then publish.", 409);
    }

    const wb = await prisma.whiteboardSession.findUnique({
      where: { id: params.id },
      select: { id: true, batchScheduleId: true },
    });

    const payload = {
      ...board,
      rankings: board.rankings, // Send full rankings so every student gets their own individual rank calculated
      durationSec,
      publishedAt: new Date().toISOString(),
    };

    try {
      const { pusherServer, sessionChannel, WB_EVENTS } = await import("@/lib/realtime/pusher-server");
      // Trigger on primary session channel
      await pusherServer.trigger(sessionChannel(params.id), WB_EVENTS.QUIZ_LEADERBOARD_PUBLISHED, payload);
      // Trigger on secondary batch schedule channel if present
      if (wb?.batchScheduleId && wb.batchScheduleId !== params.id) {
        await pusherServer.trigger(sessionChannel(wb.batchScheduleId), WB_EVENTS.QUIZ_LEADERBOARD_PUBLISHED, payload);
      }
    } catch (pushErr) {
      console.error("[publish_leaderboard_pusher_error]", pushErr);
    }

    return apiSuccess({
      message: "Leaderboard published to students successfully",
      ...payload,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
