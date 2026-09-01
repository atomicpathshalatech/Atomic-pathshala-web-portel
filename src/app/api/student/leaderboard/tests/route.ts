import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { UnauthorizedError } from "@/lib/rbac/guard";

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

    const grouped = await prisma.attempt.groupBy({
      by: ["studentId"],
      where: {
        status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] },
        testId: { not: null },
        ...(since ? { submittedAt: { gte: since } } : {}),
      },
      _sum: { score: true },
    });

    const scores = grouped.map((g) => ({ studentId: g.studentId, score: g._sum.score ?? 0 }));
    scores.sort((a, b) => b.score - a.score);

    const totalStudents = scores.length;
    const myRow = scores.find((s) => s.studentId === me.id);

    if (!myRow) {
      return apiSuccess({ window, topLearners: [], me: null, noAttempts: true });
    }

    const myScore = myRow.score;
    const myRank = scores.filter((s) => s.score > myScore).length + 1;
    const belowMe = scores.filter((s) => s.score < myScore).length;
    const myPercentile = totalStudents <= 1 ? 100 : Math.round((belowMe / (totalStudents - 1)) * 100);

    const top10 = scores.slice(0, 10);
    const topStudents = await prisma.student.findMany({
      where: { id: { in: top10.map((s) => s.studentId) } },
      include: { user: { select: { name: true } } },
    });
    const byId = new Map(topStudents.map((s) => [s.id, s]));

    const topLearners = top10.map((row, i) => {
      const s = byId.get(row.studentId);
      return {
        studentId: row.studentId,
        name: s?.user.name ?? "Unknown",
        score: row.score,
        rank: i + 1,
        percentile:
          totalStudents <= 1
            ? 100
            : Math.round((scores.filter((x) => x.score < row.score).length / (totalStudents - 1)) * 100),
      };
    });

    return apiSuccess({
      window,
      topLearners,
      noAttempts: false,
      me: {
        studentId: me.id,
        name: me.user.name,
        score: myScore,
        rank: myRank,
        percentile: myPercentile,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
