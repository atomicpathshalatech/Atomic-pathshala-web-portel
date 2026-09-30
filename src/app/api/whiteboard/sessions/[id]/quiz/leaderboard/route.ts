import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { resolveWhiteboardAccess } from "@/lib/whiteboard/access";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { buildQuizLeaderboard, type LeaderboardEntry } from "@/lib/whiteboard/quiz-leaderboard";

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
    return apiSuccess(board);
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * POST /api/whiteboard/sessions/[id]/quiz/leaderboard
 * Teacher publishes the current leaderboard to everyone in the class
 * (top 10, shown as a popup with a timer).
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

    const payload = {
      ...board,
      rankings: board.rankings.slice(0, 10),
      durationSec,
      publishedAt: new Date().toISOString(),
    };

    try {
      const { pusherServer, sessionChannel, WB_EVENTS } = await import("@/lib/realtime/pusher-server");
      await pusherServer.trigger(sessionChannel(params.id), WB_EVENTS.QUIZ_LEADERBOARD_PUBLISHED, payload);
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
