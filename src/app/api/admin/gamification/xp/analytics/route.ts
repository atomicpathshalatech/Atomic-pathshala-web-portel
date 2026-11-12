import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireGamificationAdmin } from "@/lib/gamification/admin-guard";
import { handleApiError, apiSuccess } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  try {
    await requireGamificationAdmin();

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // 1. Activity-wise breakdown
    const activityStats = await prisma.xPTransaction.groupBy({
      by: ["activity"],
      where: { status: "SUCCESSFUL" },
      _sum: { amount: true },
      _count: { id: true },
    });

    // 2. Batch-wise XP
    const batches = await prisma.batch.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        code: true,
        enrollments: {
          where: { status: "ACTIVE" },
          select: { student: { select: { xp: true } } },
        },
      },
    });

    const batchComparison = batches.map((b) => {
      const studentCount = b.enrollments.length;
      const totalXp = b.enrollments.reduce((acc, e) => acc + (e.student?.xp || 0), 0);
      const avgXp = studentCount > 0 ? Math.round(totalXp / studentCount) : 0;
      return {
        id: b.id,
        name: b.name,
        code: b.code,
        studentCount,
        totalXp,
        avgXp,
      };
    });
    batchComparison.sort((a, b) => b.totalXp - a.totalXp);

    // 3. Daily distribution over the last 30 days
    const recentTx = await prisma.xPTransaction.findMany({
      where: {
        status: "SUCCESSFUL",
        createdAt: { gte: thirtyDaysAgo },
      },
      select: { amount: true, createdAt: true, activity: true },
      orderBy: { createdAt: "asc" },
    });

    const dailyMap: Record<string, { date: string; totalXp: number; transactionCount: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateStr = d.toISOString().split("T")[0] ?? "";
      dailyMap[dateStr] = { date: dateStr, totalXp: 0, transactionCount: 0 };
    }

    for (const tx of recentTx) {
      const dateStr = tx.createdAt.toISOString().split("T")[0] ?? "";
      const day = dailyMap[dateStr];
      if (day) {
        day.totalXp += tx.amount;
        day.transactionCount += 1;
      }
    }

    // 4. Failed transactions report
    const failedTx = await prisma.xPTransaction.findMany({
      where: { status: "FAILED" },
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        student: { include: { user: { select: { name: true, phone: true } } } },
      },
    });

    // 5. Top 10 students comparison
    const topStudents = await prisma.student.findMany({
      take: 10,
      orderBy: { xp: "desc" },
      include: {
        user: { select: { name: true } },
      },
    });

    return apiSuccess({
      activityDistribution: activityStats.map((a) => ({
        activity: a.activity,
        totalXp: a._sum.amount ?? 0,
        count: a._count.id,
      })),
      batchComparison,
      dailyTrend: Object.values(dailyMap),
      failedTransactions: failedTx.map((f) => ({
        id: f.id,
        studentName: f.student.user.name,
        activity: f.activity,
        amount: f.amount,
        failureReason: f.failureReason,
        createdAt: f.createdAt.toISOString(),
      })),
      topStudents: topStudents.map((s, idx) => ({
        rank: idx + 1,
        studentId: s.id,
        name: s.user.name,
        xp: s.xp,
        level: s.level,
        streak: s.currentStreakDays,
      })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
