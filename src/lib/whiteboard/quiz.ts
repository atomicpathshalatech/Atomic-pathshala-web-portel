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
  const quiz = await prisma.quizSession.findUnique({ where: { id: quizSessionId } });
  if (!quiz) return null;

  const responses = await prisma.quizResponse.groupBy({
    by: ["selectedOption"],
    where: { quizSessionId },
    _count: { _all: true },
  });
  const totalResponses = await prisma.quizResponse.count({ where: { quizSessionId } });
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
