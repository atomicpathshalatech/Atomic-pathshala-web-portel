import "server-only";
import { prisma } from "@/lib/db";

export interface LeaderboardEntry {
  /** Student id, or "yt:<channel id>" for someone who answered in the YouTube chat. */
  studentId: string;
  name: string;
  photoUrl: string | null;
  totalAttempted: number;
  correctCount: number;
  accuracyPct: number;
  avgResponseTimeMs: number;
  rank: number;
  /** "YOUTUBE" = answered in the YouTube live chat (not an enrolled student in the app). */
  source?: "APP" | "YOUTUBE";
}

export interface QuizLeaderboard {
  scope: "session" | "chapter";
  stats: { totalParticipants: number; totalPolls: number; averageAccuracy: number };
  rankings: LeaderboardEntry[];
}

type Tally = Omit<LeaderboardEntry, "accuracyPct" | "avgResponseTimeMs" | "rank"> & { totalResponseTimeMs: number };

/** Pure ranking: accuracy, then correct count, then speed, then attempts. */
export function rankLeaderboard(tallies: Tally[]): LeaderboardEntry[] {
  return tallies
    .map((s) => ({
      studentId: s.studentId,
      name: s.name,
      photoUrl: s.photoUrl,
      totalAttempted: s.totalAttempted,
      correctCount: s.correctCount,
      accuracyPct: s.totalAttempted > 0 ? Math.round((s.correctCount / s.totalAttempted) * 100) : 0,
      avgResponseTimeMs: s.totalAttempted > 0 ? Math.round(s.totalResponseTimeMs / s.totalAttempted) : 0,
      rank: 0,
      source: s.source,
    }))
    .sort((a, b) => {
      if (b.accuracyPct !== a.accuracyPct) return b.accuracyPct - a.accuracyPct;
      if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
      if (a.avgResponseTimeMs !== b.avgResponseTimeMs) return a.avgResponseTimeMs - b.avgResponseTimeMs;
      return b.totalAttempted - a.totalAttempted;
    })
    .map((e, i) => ({ ...e, rank: i + 1 }));
}

/**
 * Ranked leaderboard for this live session, or for every class of its
 * chapter (same batch). Includes answers typed in the YouTube chat, marked
 * as source "YOUTUBE".
 */
export async function buildQuizLeaderboard(whiteboardSessionId: string, scope: "session" | "chapter"): Promise<QuizLeaderboard | null> {
  const wbSession = await prisma.whiteboardSession.findUnique({
    where: { id: whiteboardSessionId },
    include: { batchSchedule: { select: { batchId: true, chapterId: true } } },
  });
  if (!wbSession) return null;

  let sessionIds: string[] = [whiteboardSessionId];
  if (scope === "chapter" && wbSession.batchSchedule?.chapterId) {
    const chapterSchedules = await prisma.batchSchedule.findMany({
      where: { chapterId: wbSession.batchSchedule.chapterId, batchId: wbSession.batchSchedule.batchId },
      select: { liveWhiteboardSession: { select: { id: true } } },
    });
    const ids = chapterSchedules.map((s) => s.liveWhiteboardSession?.id).filter((id): id is string => Boolean(id));
    sessionIds = Array.from(new Set([...sessionIds, ...ids]));
  }

  const quizzes = await prisma.quizSession.findMany({
    where: { whiteboardSessionId: { in: sessionIds } },
    include: {
      responses: { include: { student: { include: { user: { select: { name: true, photoUrl: true } } } } } },
    },
    orderBy: { startedAt: "asc" },
  });
  // Separate query so a database without the YouTube table yet still gives the app leaderboard.
  const youtubeVotes = await prisma.quizYoutubeVote
    .findMany({ where: { quizSessionId: { in: quizzes.map((q) => q.id) } } })
    .catch(() => []);
  const correctByQuiz = new Map(quizzes.map((q) => [q.id, q.correctOption]));

  const tallies = new Map<string, Tally>();
  const add = (id: string, init: () => Tally, isCorrect: boolean, responseTimeMs: number) => {
    const t = tallies.get(id) ?? init();
    t.totalAttempted += 1;
    t.totalResponseTimeMs += Math.max(0, responseTimeMs || 0);
    if (isCorrect) t.correctCount += 1;
    tallies.set(id, t);
  };

  for (const quiz of quizzes) {
    for (const resp of quiz.responses) {
      add(
        resp.studentId,
        () => ({
          studentId: resp.studentId,
          name: resp.student.user?.name || `Student ${resp.student.studentIdCode || ""}`.trim() || "Student",
          photoUrl: resp.student.user?.photoUrl || null,
          totalAttempted: 0,
          correctCount: 0,
          totalResponseTimeMs: 0,
          source: "APP",
        }),
        resp.isCorrect === true || (Boolean(quiz.correctOption) && resp.selectedOption === quiz.correctOption),
        resp.responseTimeMs
      );
    }
  }
  for (const vote of youtubeVotes) {
    const correct = correctByQuiz.get(vote.quizSessionId);
    add(
      `yt:${vote.authorChannelId}`,
      () => ({
        studentId: `yt:${vote.authorChannelId}`,
        name: vote.authorName,
        photoUrl: vote.authorPhotoUrl,
        totalAttempted: 0,
        correctCount: 0,
        totalResponseTimeMs: 0,
        source: "YOUTUBE",
      }),
      vote.isCorrect === true || (Boolean(correct) && vote.selectedOption === correct),
      vote.responseTimeMs
    );
  }

  const rankings = rankLeaderboard(Array.from(tallies.values()));
  const totalParticipants = rankings.length;
  return {
    scope,
    stats: {
      totalParticipants,
      totalPolls: quizzes.length,
      averageAccuracy: totalParticipants > 0 ? Math.round(rankings.reduce((sum, r) => sum + r.accuracyPct, 0) / totalParticipants) : 0,
    },
    rankings,
  };
}
