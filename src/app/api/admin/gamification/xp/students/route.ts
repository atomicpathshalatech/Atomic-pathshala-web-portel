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
    const batchId = searchParams.get("batchId") || undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "15", 10)));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { id: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
        { user: { phone: { contains: search } } },
        { emergencyContact: { contains: search } },
      ];
    }

    if (batchId) {
      where.batchEnrollments = {
        some: { batchId, status: "ACTIVE" },
      };
    }

    const [total, students, batches] = await Promise.all([
      prisma.student.count({ where }),
      prisma.student.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ xp: "desc" }, { createdAt: "asc" }],
        include: {
          user: { select: { name: true, email: true, phone: true } },
          batchEnrollments: {
            where: { status: "ACTIVE" },
            include: { batch: { select: { id: true, name: true, code: true } } },
          },
        },
      }),
      prisma.batch.findMany({
        where: { status: "ACTIVE" },
        select: { id: true, name: true, code: true },
        orderBy: { name: "asc" },
      }),
    ]);

    // Format students with rank
    const formatted = await Promise.all(
      students.map(async (s) => {
        const higherCount = await prisma.student.count({
          where: { xp: { gt: s.xp } },
        });
        const rank = higherCount + 1;

        // Lifetime earned vs deducted
        const [earnedAgg, deductedAgg] = await Promise.all([
          prisma.xPTransaction.aggregate({
            where: { studentId: s.id, status: "SUCCESSFUL", amount: { gt: 0 } },
            _sum: { amount: true },
          }),
          prisma.xPTransaction.aggregate({
            where: { studentId: s.id, status: "SUCCESSFUL", amount: { lt: 0 } },
            _sum: { amount: true },
          }),
        ]);

        return {
          id: s.id,
          name: s.user.name,
          email: s.user.email,
          phone: s.user.phone || s.emergencyContact,
          xpBalance: s.xp,
          level: s.level,
          rank,
          lifetimeEarned: earnedAgg._sum.amount ?? s.xp,
          totalDeducted: Math.abs(deductedAgg._sum.amount ?? 0),
          streakDays: s.currentStreakDays,
          longestStreakDays: s.longestStreakDays,
          lastActivityDate: s.lastActivityDate?.toISOString() || null,
          batches: s.batchEnrollments.map((b) => ({ id: b.batch.id, name: b.batch.name, code: b.batch.code })),
        };
      })
    );

    return apiSuccess({
      students: formatted,
      batches,
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
