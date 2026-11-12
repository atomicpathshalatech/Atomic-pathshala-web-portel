import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { UnauthorizedError } from "@/lib/rbac/guard";

/**
 * Authoritative Student Gamification State:
 * - Current XP & confirmed level
 * - Overall rank
 * - Progress toward next level
 * - Last 10 confirmed XP transactions from ledger
 * - Streak counters
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      select: {
        id: true,
        xp: true,
        level: true,
        currentStreakDays: true,
        longestStreakDays: true,
        lastActivityDate: true,
      },
    });
    if (!student) return apiError("No student profile found for this account.", 404);

    // Calculate current overall rank
    const higherStudents = await prisma.student.count({
      where: { xp: { gt: student.xp } },
    });
    const rank = higherStudents + 1;

    // Next level calculation: Level L requires ((L-1)^2) * 100 XP, next level L+1 requires (L^2) * 100 XP
    const currentLevelBaseXp = Math.pow(student.level - 1, 2) * 100;
    const nextLevelTargetXp = Math.pow(student.level, 2) * 100;
    const xpIntoLevel = Math.max(0, student.xp - currentLevelBaseXp);
    const xpNeededForLevel = Math.max(1, nextLevelTargetXp - currentLevelBaseXp);
    const progressPercent = Math.min(100, Math.round((xpIntoLevel / xpNeededForLevel) * 100));

    // Fetch recent confirmed transactions
    const recentTransactions = await prisma.xPTransaction.findMany({
      where: {
        studentId: student.id,
        status: "SUCCESSFUL",
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        amount: true,
        activity: true,
        rewardLabel: true,
        balanceAfter: true,
        createdAt: true,
      },
    });

    return apiSuccess({
      gamification: {
        ...student,
        rank,
        nextLevelTargetXp,
        xpIntoLevel,
        progressPercent,
        recentTransactions: recentTransactions.map((tx) => ({
          id: tx.id,
          amount: tx.amount,
          activity: tx.activity,
          rewardLabel: tx.rewardLabel,
          balanceAfter: tx.balanceAfter,
          createdAt: tx.createdAt.toISOString(),
        })),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
