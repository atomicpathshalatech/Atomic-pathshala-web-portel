import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";

/**
 * Score = doubts resolved (weighted) + manual rating (weighted) - current
 * month's compliance penalties (weighted). All weights are illustrative and
 * meant to be tuned by whoever owns the compliance policy, not hardcoded
 * business logic buried elsewhere.
 */
const WEIGHTS = { doubtResolved: 10, rating: 20, penaltyPenalty: 0.1 };

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    await requirePermission(session?.user?.id, PERMISSIONS.LEADERBOARD_READ);

    const currentMonth = new Date().toISOString().slice(0, 7); // "YYYY-MM"

    const teachers = await prisma.teacher.findMany({
      where: { onboardingStatus: "ACTIVE" },
      include: {
        user: { select: { name: true, photoUrl: true } },
        _count: { select: { penaltyRecords: true } },
      },
    });

    const leaderboard = await Promise.all(
      teachers.map(async (t) => {
        const [doubtsResolved, monthPenalties] = await Promise.all([
          prisma.doubt.count({ where: { resolvedById: t.userId } }),
          prisma.penaltyRecord.aggregate({
            where: { teacherId: t.id, month: currentMonth },
            _sum: { amount: true },
          }),
        ]);
        const penaltyTotal = monthPenalties._sum.amount ?? 0;
        const score =
          doubtsResolved * WEIGHTS.doubtResolved +
          (t.rating ?? 0) * WEIGHTS.rating -
          penaltyTotal * WEIGHTS.penaltyPenalty;

        return {
          teacherId: t.id,
          name: t.user.name,
          photoUrl: t.user.photoUrl,
          department: t.department,
          doubtsResolved,
          rating: t.rating ?? 0,
          monthPenaltyTotal: penaltyTotal,
          score: Math.round(score * 100) / 100,
        };
      })
    );

    leaderboard.sort((a, b) => b.score - a.score);

    return apiSuccess({ month: currentMonth, leaderboard });
  } catch (error) {
    return handleApiError(error);
  }
}
