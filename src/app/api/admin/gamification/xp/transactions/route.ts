import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireGamificationAdmin } from "@/lib/gamification/admin-guard";
import { handleApiError, apiSuccess } from "@/lib/api/response";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    await requireGamificationAdmin();

    const searchParams = req.nextUrl.searchParams;
    const search = searchParams.get("search")?.trim() || "";
    const status = searchParams.get("status") || undefined;
    const activity = searchParams.get("activity") || undefined;
    const studentId = searchParams.get("studentId") || undefined;
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25", 10)));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status && ["SUCCESSFUL", "PENDING", "FAILED", "REVERSED"].includes(status)) {
      where.status = status;
    }

    if (activity) {
      where.activity = activity;
    }

    if (studentId) {
      where.studentId = studentId;
    }

    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = new Date(fromDate);
      if (toDate) {
        const to = new Date(toDate);
        to.setHours(23, 59, 59, 999);
        where.createdAt.lte = to;
      }
    }

    if (search) {
      where.OR = [
        { id: { contains: search, mode: "insensitive" } },
        { idempotencyKey: { contains: search, mode: "insensitive" } },
        { studentId: { contains: search, mode: "insensitive" } },
        { rewardLabel: { contains: search, mode: "insensitive" } },
        { student: { user: { name: { contains: search, mode: "insensitive" } } } },
        { student: { user: { phone: { contains: search } } } },
      ];
    }

    const [total, transactions, activities] = await Promise.all([
      prisma.xPTransaction.count({ where }),
      prisma.xPTransaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          student: {
            include: { user: { select: { name: true, email: true, phone: true } } },
          },
          rule: { select: { id: true, displayLabel: true, category: true } },
          adjustment: { select: { reason: true, admin: { select: { name: true } } } },
        },
      }),
      prisma.xPTransaction.groupBy({
        by: ["activity"],
        _count: { id: true },
      }),
    ]);

    const formatted = transactions.map((tx) => ({
      id: tx.id,
      studentId: tx.studentId,
      studentName: tx.student.user.name,
      studentPhone: tx.student.user.phone,
      activity: tx.activity,
      rewardLabel: tx.rewardLabel,
      amount: tx.amount,
      ruleId: tx.ruleId,
      ruleVersion: tx.ruleVersion,
      idempotencyKey: tx.idempotencyKey,
      status: tx.status,
      balanceBefore: tx.balanceBefore,
      balanceAfter: tx.balanceAfter,
      failureReason: tx.failureReason,
      adjustmentReason: tx.adjustment?.reason || null,
      adjustedBy: tx.adjustment?.admin?.name || null,
      createdAt: tx.createdAt.toISOString(),
      metadata: tx.metadata,
    }));

    return apiSuccess({
      transactions: formatted,
      activities: activities.map((a) => a.activity),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    return handleApiError(err);
  }
}
