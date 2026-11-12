import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireGamificationAdmin } from "@/lib/gamification/admin-guard";
import { handleApiError, apiSuccess } from "@/lib/api/response";
import { dateOnlyUTC } from "@/lib/gamification/xp-engine";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireGamificationAdmin();

    const now = new Date();
    const todayStart = dateOnlyUTC(now);
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalXpAgg,
      activeStudentsCount,
      activeRulesCount,
      failedTransactionsCount,
      pendingTransactionsCount,
      blockedDuplicatesCount,
      todayXpAgg,
      weekXpAgg,
      monthXpAgg,
      recentTransactions,
    ] = await Promise.all([
      // Total XP awarded from successful transactions
      prisma.xPTransaction.aggregate({
        where: { status: "SUCCESSFUL" },
        _sum: { amount: true },
        _count: { id: true },
      }),
      // Total active students with XP > 0
      prisma.student.count({
        where: { xp: { gt: 0 } },
      }),
      // Active reward rules
      prisma.xPRewardRule.count({
        where: { isActive: true },
      }),
      // Failed transactions
      prisma.xPTransaction.count({
        where: { status: "FAILED" },
      }),
      // Pending transactions
      prisma.xPTransaction.count({
        where: { status: "PENDING" },
      }),
      // Duplicate events blocked safely
      prisma.xPActivityEvent.count({
        where: { error: { contains: "duplicate", mode: "insensitive" } },
      }),
      // Daily XP (today)
      prisma.xPTransaction.aggregate({
        where: { status: "SUCCESSFUL", createdAt: { gte: todayStart } },
        _sum: { amount: true },
      }),
      // Weekly XP (last 7 days)
      prisma.xPTransaction.aggregate({
        where: { status: "SUCCESSFUL", createdAt: { gte: weekStart } },
        _sum: { amount: true },
      }),
      // Monthly XP (last 30 days)
      prisma.xPTransaction.aggregate({
        where: { status: "SUCCESSFUL", createdAt: { gte: monthStart } },
        _sum: { amount: true },
      }),
      // Recent transactions
      prisma.xPTransaction.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          student: {
            include: { user: { select: { name: true, email: true, phone: true } } },
          },
        },
      }),
    ]);

    return apiSuccess({
      stats: {
        totalXpAwarded: totalXpAgg._sum.amount ?? 0,
        totalSuccessfulTransactions: totalXpAgg._count.id,
        totalActiveStudents: activeStudentsCount,
        activeRewardRules: activeRulesCount,
        failedTransactions: failedTransactionsCount,
        pendingTransactions: pendingTransactionsCount,
        blockedDuplicates: blockedDuplicatesCount,
        todayXp: todayXpAgg._sum.amount ?? 0,
        weekXp: weekXpAgg._sum.amount ?? 0,
        monthXp: monthXpAgg._sum.amount ?? 0,
      },
      recentTransactions: recentTransactions.map((tx) => ({
        id: tx.id,
        studentName: tx.student.user.name,
        studentId: tx.studentId,
        activity: tx.activity,
        rewardLabel: tx.rewardLabel,
        amount: tx.amount,
        status: tx.status,
        createdAt: tx.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
