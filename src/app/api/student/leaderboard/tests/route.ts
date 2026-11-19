import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { UnauthorizedError } from "@/lib/rbac/guard";
import { areResultsReleased } from "@/lib/tests/schedule-rules";

/**
 * Test-score leaderboard — same shape and pinned-"me" behavior as
 * /api/student/leaderboard (the XP one), but ranked by total score across
 * finalized test attempts (Attempt.status SUBMITTED/AUTO_SUBMITTED)
 * instead of XP. Deliberately a separate endpoint/tab rather than merged
 * into the XP system — XP already has its own well-established leaderboard
 * page; this just adds a second, independently-computed ranking alongside
 * it, per the user's own framing of the two as "XP" and "Test Rank" tabs.
 *
 * Unlike the XP leaderboard, students with zero finalized attempts are
 * left out of the ranking entirely (a tie at 0 for everyone who hasn't
 * taken a test yet isn't a meaningful rank) — the response instead flags
 * `noAttempts: true` for the caller when they personally have none.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const me = await prisma.student.findUnique({
      where: { userId: session.user.id },
      include: { user: { select: { name: true } } },
    });
    if (!me) return apiError("No student profile found for this account.", 404);

    const window = request.nextUrl.searchParams.get("window") === "7d" ? "7d" : "all";
    const since = window === "7d" ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) : undefined;

    // Tests whose results aren't open yet (window not over) don't count yet.
    const now = new Date();
    const recentTests = await prisma.test.findMany({
      where: {
        OR: [
          { closeTime: { gt: now } },
          { openTime: { gt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } },
          { batchSchedule: { endsAt: { gt: now } } },
        ],
      },
      select: {
        id: true,
        openTime: true,
        closeTime: true,
        durationMin: true,
        batchSchedule: { select: { startsAt: true, endsAt: true, type: true } },
      },
    });
    const heldTestIds = recentTests.filter((t) => !areResultsReleased(t, now)).map((t) => t.id);

    const grouped = await prisma.attempt.groupBy({
      by: ["studentId"],
      where: {
        status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] },
        testId: heldTestIds.length ? { not: null, notIn: heldTestIds } : { not: null },
        ...(since ? { submittedAt: { gte: since } } : {}),
      },
      _sum: { score: true },
      _avg: { score: true },
      _count: { id: true },
    });

    const scores = grouped.map((g) => ({
      studentId: g.studentId,
      score: g._sum.score ?? 0,
      avgScore: Math.round(((g._avg.score ?? 0) * 10)) / 10,
      testsAttempted: g._count.id ?? 1,
    }));
    // Rank primarily by average score performance, secondary by total tests attempted & total score
    scores.sort((a, b) => {
      const avgDiff = b.avgScore - a.avgScore;
      if (avgDiff !== 0) return avgDiff;
      const countDiff = b.testsAttempted - a.testsAttempted;
      if (countDiff !== 0) return countDiff;
      return b.score - a.score;
    });

    const totalStudents = scores.length;
    const myRow = scores.find((s) => s.studentId === me.id);

    if (!myRow) {
      return apiSuccess({ window, topLearners: [], me: null, noAttempts: true });
    }

    const myScore = myRow.score;
    const myAvgScore = myRow.avgScore;
    const myRank = scores.findIndex((s) => s.studentId === me.id) + 1;
    const belowMe = scores.length - myRank;
    const myPercentile = totalStudents <= 1 ? 100 : Math.round((belowMe / (totalStudents - 1)) * 100);

    const top10 = scores.slice(0, 10);
    const topStudents = await prisma.student.findMany({
      where: { id: { in: top10.map((s) => s.studentId) } },
      include: { user: { select: { name: true, photoUrl: true } } },
    });
    const byId = new Map(topStudents.map((s) => [s.id, s]));

    const topLearners = top10.map((row, i) => {
      const s = byId.get(row.studentId);
      return {
        studentId: row.studentId,
        name: s?.user.name ?? "Unknown",
        photoUrl: s?.user.photoUrl || null,
        score: row.score,
        avgScore: row.avgScore,
        testsAttempted: row.testsAttempted,
        rank: i + 1,
        percentile:
          totalStudents <= 1
            ? 100
            : Math.round(((totalStudents - (i + 1)) / (totalStudents - 1)) * 100),
      };
    });

    return apiSuccess({
      window,
      topLearners,
      noAttempts: false,
      me: {
        studentId: me.id,
        name: me.user.name,
        photoUrl: me.user.photoUrl || null,
        score: myScore,
        avgScore: myAvgScore,
        testsAttempted: myRow.testsAttempted,
        rank: myRank,
        percentile: myPercentile,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
