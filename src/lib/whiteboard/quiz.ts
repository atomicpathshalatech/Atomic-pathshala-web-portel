import "server-only";
import { prisma } from "@/lib/db";
import { pusherServer, teacherChannel, WB_EVENTS } from "@/lib/realtime/pusher-server";

/**
 * Aggregates live response counts per option and pushes them to the
 * teacher-only channel. Never sent to students — pre-reveal vote counts
 * would let a student infer the answer or peer-pressure others, which is
 * exactly what the teacher-only channel exists to prevent (see the comment
 * on teacherChannel() in pusher-server.ts).
 */
export async function pushQuizMetrics(quizSessionId: string) {
  // These three queries are independent of each other (none needs another's
  // result), but ran as three sequential awaits — this fires on every
  // single student response, so with a cross-region DB round-trip in the
  // ~100s of ms (the same Vercel<->Supabase distance already the dominant
  // cost elsewhere in this app), that was 3x the necessary latency on the
  // hot path for "how fast do the teacher's live vote bars update".
  const [quiz, responses, totalResponses] = await Promise.all([
    prisma.quizSession.findUnique({ where: { id: quizSessionId } }),
    prisma.quizResponse.groupBy({
      by: ["selectedOption"],
      where: { quizSessionId },
      _count: { _all: true },
    }),
    prisma.quizResponse.count({ where: { quizSessionId } }),
  ]);
  if (!quiz) return null;

  const counts = Object.fromEntries(responses.map((r) => [r.selectedOption, r._count._all]));

  const payload = { quizSessionId, counts, totalResponses };

  try {
    await pusherServer.trigger(
      teacherChannel(quiz.whiteboardSessionId),
      WB_EVENTS.QUIZ_METRICS,
      payload
    );
  } catch (err) {
    console.error("[pusher_trigger_error]", err);
  }

  return payload;
}
