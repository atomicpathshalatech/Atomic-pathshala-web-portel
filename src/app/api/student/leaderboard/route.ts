import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { UnauthorizedError } from "@/lib/rbac/guard";

type ScoreRow = { studentId: string; xp: number };

/**
 * All students' XP for the requested window, as a flat {studentId, xp}
 * list — "all time" reads the Student.xp cache directly (fast path, kept
 * in sync by awardXp on every write); "7d" sums the XPEvent ledger over the
 * window instead, since the cache has no time dimension. Students with no
 * activity in the window still appear here at xp: 0 — that's what makes
 * rank/percentile mean anything for someone who hasn't earned XP yet (see
 * the "0th percentile" state in the UI).
 *
 * O(n) over the whole student body — fine at this app's current scale (a
 * few hundred to a few thousand students); if that stops being true, this
 * is the one place to swap in a SQL window-function query instead.
 */
async function scoresForWindow(window: "7d" | "all"): Promise<ScoreRow[]> {
  const allStudents = await prisma.student.findMany({ select: { id: true, xp: true } });

  if (window === "all") {
    return allStudents.map((s) => ({ studentId: s.id, xp: s.xp }));
  }

  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const grouped = await prisma.xPEvent.groupBy({
    by: ["studentId"],
    where: { createdAt: { gte: since } },
    _sum: { amount: true },
  });
  const sumByStudent = new Map(grouped.map((g) => [g.studentId, g._sum.amount ?? 0]));
  return allStudents.map((s) => ({ studentId: s.id, xp: sumByStudent.get(s.id) ?? 0 }));
}

/**
 * Top 10 + "me" (with my own rank/percentile even when I'm nowhere near the
 * top 10) — matches the reference UI's leaderboard, which always pins the
 * viewer's own row at the bottom regardless of where they actually rank.
 * ?window=7d | all, defaults to all.
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

    const scores = await scoresForWindow(window);
    scores.sort((a, b) => b.xp - a.xp);

    const myXp = scores.find((s) => s.studentId === me.id)?.xp ?? 0;
    const myRank = scores.filter((s) => s.xp > myXp).length + 1;
    const belowMe = scores.filter((s) => s.xp < myXp).length;
    const totalStudents = scores.length;
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
        xp: row.xp,
        level: s?.level ?? 1,
        rank: i + 1,
        percentile:
          totalStudents <= 1
            ? 100
            : Math.round((scores.filter((x) => x.xp < row.xp).length / (totalStudents - 1)) * 100),
      };
    });

    return apiSuccess({
      window,
      topLearners,
      me: {
        studentId: me.id,
        name: me.user.name,
        xp: myXp,
        level: me.level,
        rank: myRank,
        percentile: myPercentile,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
