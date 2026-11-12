import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { UnauthorizedError } from "@/lib/rbac/guard";
import { checkRankMilestoneRewards } from "@/lib/gamification/xp-engine";

type ScoreRow = {
  studentId: string;
  xp: number;
  lastActivityDate: Date | null;
  createdAt: Date;
  rank: number;
  percentile: number;
};

/**
 * Calculates authoritative scores for the requested window and optional batch.
 * Tie-breaking rule:
 * 1. XP (descending)
 * 2. Last activity date / earlier achievement (ascending)
 * 3. Account creation date (ascending)
 * 4. Student ID (alphabetical)
 */
async function scoresForWindow(
  window: "7d" | "all",
  batchId?: string | null
): Promise<ScoreRow[]> {
  const studentWhere: any = {};
  if (batchId) {
    studentWhere.batchEnrollments = {
      some: { batchId, status: "ACTIVE" },
    };
  }

  const allStudents = await prisma.student.findMany({
    where: studentWhere,
    select: { id: true, xp: true, lastActivityDate: true, createdAt: true },
  });

  let rawList: { studentId: string; xp: number; lastActivityDate: Date | null; createdAt: Date }[] = [];

  if (window === "all") {
    rawList = allStudents.map((s) => ({
      studentId: s.id,
      xp: s.xp,
      lastActivityDate: s.lastActivityDate,
      createdAt: s.createdAt,
    }));
  } else {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const grouped = await prisma.xPTransaction.groupBy({
      by: ["studentId"],
      where: {
        status: "SUCCESSFUL",
        createdAt: { gte: since },
        ...(batchId ? { student: { batchEnrollments: { some: { batchId, status: "ACTIVE" } } } } : {}),
      },
      _sum: { amount: true },
    });
    const sumByStudent = new Map(grouped.map((g) => [g.studentId, g._sum.amount ?? 0]));
    rawList = allStudents.map((s) => ({
      studentId: s.id,
      xp: sumByStudent.get(s.id) ?? 0,
      lastActivityDate: s.lastActivityDate,
      createdAt: s.createdAt,
    }));
  }

  // Deterministic sorting with tie-breaking
  rawList.sort((a, b) => {
    if (b.xp !== a.xp) return b.xp - a.xp;
    // Tie breaker 1: earlier activity
    const aTime = a.lastActivityDate ? a.lastActivityDate.getTime() : a.createdAt.getTime();
    const bTime = b.lastActivityDate ? b.lastActivityDate.getTime() : b.createdAt.getTime();
    if (aTime !== bTime) return aTime - bTime;
    // Tie breaker 2: earlier createdAt
    if (a.createdAt.getTime() !== b.createdAt.getTime()) return a.createdAt.getTime() - b.createdAt.getTime();
    // Tie breaker 3: alphabetical ID
    return a.studentId.localeCompare(b.studentId);
  });

  const total = rawList.length;
  const result: ScoreRow[] = [];

  // Consistent Standard Competition Ranking
  let currentRank = 1;
  for (let i = 0; i < rawList.length; i++) {
    const row = rawList[i];
    if (!row) continue;
    const prev = i > 0 ? rawList[i - 1] : undefined;
    if (prev && row.xp < prev.xp) {
      currentRank = i + 1;
    }
    const belowMe = rawList.filter((x) => x.xp < row.xp).length;
    const percentile = total <= 1 ? 100 : Math.round((belowMe / (total - 1)) * 100);

    result.push({
      studentId: row.studentId,
      xp: row.xp,
      lastActivityDate: row.lastActivityDate,
      createdAt: row.createdAt,
      rank: currentRank,
      percentile,
    });
  }

  return result;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const me = await prisma.student.findUnique({
      where: { userId: session.user.id },
      include: {
        user: { select: { name: true } },
        batchEnrollments: {
          where: { status: "ACTIVE" },
          include: { batch: { select: { id: true, name: true } } },
        },
      },
    });
    if (!me) return apiError("No student profile found for this account.", 404);

    const window = request.nextUrl.searchParams.get("window") === "7d" ? "7d" : "all";
    const batchId = request.nextUrl.searchParams.get("batchId") || undefined;

    const scores = await scoresForWindow(window, batchId);
    const myScoreRow = scores.find((s) => s.studentId === me.id);

    const myXp = myScoreRow?.xp ?? 0;
    const myRank = myScoreRow?.rank ?? scores.length + 1;
    const myPercentile = myScoreRow?.percentile ?? 0;

    // Optional rank milestone reward check (runs only for all-time overall leaderboard)
    if (window === "all" && !batchId && myScoreRow && myScoreRow.xp > 0) {
      checkRankMilestoneRewards(me.id, myRank).catch(() => {});
    }

    const top10 = scores.slice(0, 10);
    const topStudents = await prisma.student.findMany({
      where: { id: { in: top10.map((s) => s.studentId) } },
      include: { user: { select: { name: true } } },
    });
    const byId = new Map(topStudents.map((s) => [s.id, s]));

    const topLearners = top10.map((row) => {
      const s = byId.get(row.studentId);
      return {
        studentId: row.studentId,
        name: s?.user.name ?? "Unknown",
        xp: row.xp,
        level: s?.level ?? 1,
        rank: row.rank,
        percentile: row.percentile,
      };
    });

    return apiSuccess({
      window,
      batchId: batchId || null,
      batches: me.batchEnrollments.map((be) => ({ id: be.batch.id, name: be.batch.name })),
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
