import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_ACCESS);

    const canViewCosts = await hasPermission(session.user.id, PERMISSIONS.CONTENT_STUDIO_COST_VIEW);

    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const studioWhere = { feature: { startsWith: "CONTENT_STUDIO" } };

    const [todayAgg, monthAgg, byProvider, recentLogs] = await Promise.all([
      prisma.aiUsageLog.aggregate({
        where: { ...studioWhere, createdAt: { gte: startOfDay } },
        _count: { id: true },
        _sum: { costUsd: true, costInr: true, inputTokens: true, outputTokens: true },
      }),
      prisma.aiUsageLog.aggregate({
        where: { ...studioWhere, createdAt: { gte: startOfMonth } },
        _count: { id: true },
        _sum: { costUsd: true, costInr: true },
      }),
      prisma.aiUsageLog.groupBy({
        by: ["provider", "ok"],
        where: { ...studioWhere, createdAt: { gte: startOfMonth } },
        _count: { id: true },
        _sum: { costUsd: true },
      }),
      prisma.aiUsageLog.findMany({
        where: studioWhere,
        orderBy: { createdAt: "desc" },
        take: 30,
      }),
    ]);

    return apiSuccess({
      canViewCosts,
      today: {
        calls: todayAgg._count.id,
        costUsd: canViewCosts ? todayAgg._sum.costUsd ?? 0 : null,
        costInr: canViewCosts ? todayAgg._sum.costInr ?? 0 : null,
        inputTokens: todayAgg._sum.inputTokens ?? 0,
        outputTokens: todayAgg._sum.outputTokens ?? 0,
      },
      month: {
        calls: monthAgg._count.id,
        costUsd: canViewCosts ? monthAgg._sum.costUsd ?? 0 : null,
        costInr: canViewCosts ? monthAgg._sum.costInr ?? 0 : null,
      },
      byProvider: canViewCosts
        ? byProvider
        : byProvider.map((b) => ({ ...b, _sum: { costUsd: null } })),
      recentLogs: canViewCosts
        ? recentLogs
        : recentLogs.map((l) => ({ ...l, costUsd: null, costInr: null })),
    });
  } catch (err) {
    return handleApiError(err);
  }
}
