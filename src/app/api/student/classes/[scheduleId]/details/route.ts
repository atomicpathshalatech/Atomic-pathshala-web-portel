import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { UnauthorizedError } from "@/lib/rbac/guard";
import { buildQuizLeaderboard } from "@/lib/whiteboard/quiz-leaderboard";

export const dynamic = "force-dynamic";

type Podium = { rank: number; name: string; photoUrl: string | null; responseTimeMs: number; source: "APP" | "YOUTUBE" };

/**
 * GET — everything about one finished live class for a student of its batch:
 * its duration, whether the board PDF and the recording are there, and the
 * result of every poll asked in it (stored in the database at the time, so
 * this can be opened any time later):
 *  - per poll: the top 3 (right answer, fastest first — 1st in the middle of
 *    the podium), and this student's own answer — 1 mark if right, 0 if wrong
 *    or not answered;
 *  - the whole class: top 10 and this student's own rank.
 */
export async function GET(_request: NextRequest, { params }: { params: { scheduleId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    const student = await prisma.student.findUnique({ where: { userId: session.user.id }, select: { id: true } });
    if (!student) return apiError("Student profile not found.", 404);

    const schedule = await prisma.batchSchedule.findUnique({
      where: { id: params.scheduleId },
      select: {
        id: true,
        title: true,
        batchId: true,
        startsAt: true,
        endsAt: true,
        chapter: { select: { id: true, title: true } },
        teacher: { select: { displayName: true, user: { select: { name: true } } } },
        liveWhiteboardSession: {
          select: {
            id: true,
            actualStartedAt: true,
            actualEndedAt: true,
            endedAt: true,
            recordingStatus: true,
            recordingStorageKey: true,
            recordingDurationSeconds: true,
            youtubeVideoId: true,
            youtubeArchiveVideoUrl: true,
          },
        },
      },
    });
    if (!schedule) return apiError("Class not found.", 404);

    const { resolveBatchAccess } = await import("@/lib/batch/entitlement");
    const access = await resolveBatchAccess(session.user.id, schedule.batchId);
    if (!["ACTIVE_ENROLLMENT", "ACTIVE_SUBSCRIPTION", "ADMIN_GRANTED"].includes(access.status)) {
      return apiError("This class is for students of another batch.", 403);
    }

    const wb = schedule.liveWhiteboardSession;
    const started = wb?.actualStartedAt ?? null;
    const ended = wb?.actualEndedAt ?? wb?.endedAt ?? null;
    const durationSec =
      started && ended ? Math.max(0, Math.round((ended.getTime() - started.getTime()) / 1000)) : wb?.recordingDurationSeconds ?? null;

    let polls: Array<{
      id: string;
      question: string | null;
      options: { key: string; label: string }[];
      correctOption: string | null;
      totalAnswers: number;
      podium: Podium[];
      me: { answered: boolean; selectedOption: string | null; correct: boolean; marks: number; rank: number | null };
    }> = [];
    let overall: { totalParticipants: number; totalPolls: number; top: unknown[]; me: { rank: number | null; correctCount: number; totalAttempted: number; marks: number } } | null = null;

    if (wb) {
      const quizzes = await prisma.quizSession.findMany({
        where: { whiteboardSessionId: wb.id },
        orderBy: { startedAt: "asc" },
        select: {
          id: true,
          questionText: true,
          options: true,
          correctOption: true,
          responses: {
            select: {
              studentId: true,
              selectedOption: true,
              responseTimeMs: true,
              isCorrect: true,
              student: { select: { studentIdCode: true, user: { select: { name: true, photoUrl: true } } } },
            },
          },
        },
      });
      const ytVotes = await prisma.quizYoutubeVote
        .findMany({
          where: { quizSessionId: { in: quizzes.map((q) => q.id) } },
          select: { quizSessionId: true, authorName: true, authorPhotoUrl: true, selectedOption: true, responseTimeMs: true, isCorrect: true },
        })
        .catch(() => []);

      polls = quizzes.map((q) => {
        const right = (opt: string, flag: boolean | null) => flag === true || (Boolean(q.correctOption) && opt === q.correctOption);
        const entries = [
          ...q.responses.map((r) => ({
            studentId: r.studentId as string | null,
            name: r.student.user?.name || `Student ${r.student.studentIdCode ?? ""}`.trim(),
            photoUrl: r.student.user?.photoUrl ?? null,
            responseTimeMs: Math.max(0, r.responseTimeMs || 0),
            correct: right(r.selectedOption, r.isCorrect),
            selectedOption: r.selectedOption,
            source: "APP" as const,
          })),
          ...ytVotes
            .filter((v) => v.quizSessionId === q.id)
            .map((v) => ({
              studentId: null,
              name: v.authorName,
              photoUrl: v.authorPhotoUrl ?? null,
              responseTimeMs: Math.max(0, v.responseTimeMs || 0),
              correct: right(v.selectedOption, v.isCorrect),
              selectedOption: v.selectedOption,
              source: "YOUTUBE" as const,
            })),
        ];
        // Right answers first, fastest first; then the rest, fastest first.
        entries.sort((a, b) => Number(b.correct) - Number(a.correct) || a.responseTimeMs - b.responseTimeMs);
        const mineIdx = entries.findIndex((e) => e.studentId === student.id);
        const mine = mineIdx >= 0 ? entries[mineIdx]! : null;
        return {
          id: q.id,
          question: q.questionText,
          options: Array.isArray(q.options) ? (q.options as { key: string; label: string }[]) : [],
          correctOption: q.correctOption,
          totalAnswers: entries.length,
          podium: entries
            .filter((e) => e.correct)
            .slice(0, 3)
            .map((e, i) => ({ rank: i + 1, name: e.name, photoUrl: e.photoUrl, responseTimeMs: e.responseTimeMs, source: e.source })),
          me: {
            answered: Boolean(mine),
            selectedOption: mine?.selectedOption ?? null,
            correct: Boolean(mine?.correct),
            marks: mine?.correct ? 1 : 0,
            rank: mine?.correct ? mineIdx + 1 : null,
          },
        };
      });

      const board = await buildQuizLeaderboard(wb.id, "session");
      if (board) {
        const myEntry = board.rankings.find((r) => r.studentId === student.id) ?? null;
        overall = {
          totalParticipants: board.stats.totalParticipants,
          totalPolls: board.stats.totalPolls,
          top: board.rankings.slice(0, 10),
          me: {
            rank: myEntry?.rank ?? null,
            correctCount: myEntry?.correctCount ?? 0,
            totalAttempted: myEntry?.totalAttempted ?? 0,
            marks: myEntry?.correctCount ?? 0,
          },
        };
      }
    }

    return apiSuccess({
      id: schedule.id,
      title: schedule.title,
      chapter: schedule.chapter,
      teacher: schedule.teacher?.displayName || schedule.teacher?.user?.name || null,
      scheduledStart: schedule.startsAt,
      scheduledEnd: schedule.endsAt,
      startedAt: started,
      endedAt: ended,
      durationSec,
      whiteboardSessionId: wb?.id ?? null,
      hasRecording: Boolean(wb && (wb.recordingStatus === "READY" || wb.recordingStorageKey || wb.youtubeVideoId || wb.youtubeArchiveVideoUrl)),
      polls,
      overall,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
