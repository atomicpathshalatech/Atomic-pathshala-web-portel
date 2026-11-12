import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireGamificationAdmin } from "@/lib/gamification/admin-guard";
import { handleApiError, apiSuccess, apiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireGamificationAdmin();

    const student = await prisma.student.findUnique({
      where: { id: params.id },
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        batchEnrollments: {
          include: { batch: { select: { id: true, name: true, code: true, targetExam: true } } },
        },
      },
    });

    if (!student) return apiError("Student not found", 404);

    // Calculate current rank
    const higherStudents = await prisma.student.count({
      where: { xp: { gt: student.xp } },
    });
    const rank = higherStudents + 1;

    // Aggregate lifetime earned vs deducted
    const [earnedAgg, deductedAgg, transactions, activityBreakdown] = await Promise.all([
      prisma.xPTransaction.aggregate({
        where: { studentId: student.id, status: "SUCCESSFUL", amount: { gt: 0 } },
        _sum: { amount: true },
      }),
      prisma.xPTransaction.aggregate({
        where: { studentId: student.id, status: "SUCCESSFUL", amount: { lt: 0 } },
        _sum: { amount: true },
      }),
      prisma.xPTransaction.findMany({
        where: { studentId: student.id },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          rule: { select: { id: true, displayLabel: true, category: true } },
          adjustment: { select: { reason: true, admin: { select: { name: true } } } },
        },
      }),
      prisma.xPTransaction.groupBy({
        by: ["activity"],
        where: { studentId: student.id, status: "SUCCESSFUL" },
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    return apiSuccess({
      student: {
        id: student.id,
        name: student.user.name,
        email: student.user.email,
        phone: student.user.phone || student.emergencyContact,
        xpBalance: student.xp,
        level: student.level,
        rank,
        lifetimeEarned: earnedAgg._sum.amount ?? student.xp,
        totalDeducted: Math.abs(deductedAgg._sum.amount ?? 0),
        currentStreakDays: student.currentStreakDays,
        longestStreakDays: student.longestStreakDays,
        lastActivityDate: student.lastActivityDate?.toISOString() || null,
        batches: student.batchEnrollments.map((be) => ({
          id: be.batch.id,
          name: be.batch.name,
          code: be.batch.code,
          status: be.status,
        })),
        activityBreakdown: activityBreakdown.map((ab) => ({
          activity: ab.activity,
          totalXp: ab._sum.amount ?? 0,
          count: ab._count.id,
        })),
        transactions: transactions.map((t) => ({
          id: t.id,
          amount: t.amount,
          status: t.status,
          activity: t.activity,
          rewardLabel: t.rewardLabel,
          ruleId: t.ruleId,
          ruleVersion: t.ruleVersion,
          balanceBefore: t.balanceBefore,
          balanceAfter: t.balanceAfter,
          idempotencyKey: t.idempotencyKey,
          failureReason: t.failureReason,
          metadata: t.metadata,
          adjustmentReason: t.adjustment?.reason || null,
          adjustedBy: t.adjustment?.admin?.name || null,
          createdAt: t.createdAt.toISOString(),
        })),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
