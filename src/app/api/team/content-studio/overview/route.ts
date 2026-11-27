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
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

    const [
      recentProjects,
      recentAssets,
      savedIdeas,
      activeJobs,
      failedJobs,
      recentGenerations,
      monthUsage,
      managers,
    ] = await Promise.all([
      prisma.contentProject.findMany({
        where: { status: { not: "ARCHIVED" } },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          manager: { select: { id: true, name: true, email: true } },
          _count: { select: { scripts: true, assets: true, jobs: true } },
        },
        orderBy: { updatedAt: "desc" },
        take: 12,
      }),
      prisma.generatedAsset.findMany({
        include: { project: { select: { id: true, title: true } } },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      prisma.contentIdea.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      prisma.aiGenerationJob.findMany({
        where: { status: { in: ["QUEUED", "PROCESSING", "WAITING_WEBHOOK"] } },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.aiGenerationJob.findMany({
        where: { status: "FAILED" },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.aiUsageLog.findMany({
        where: { feature: { startsWith: "CONTENT_STUDIO" } },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.aiUsageLog.aggregate({
        where: { feature: { startsWith: "CONTENT_STUDIO" }, createdAt: { gte: startOfMonth } },
        _count: { id: true },
        _sum: { costUsd: true, costInr: true },
      }),
      prisma.user.findMany({
        where: {
          status: "ACTIVE",
          role: {
            name: {
              in: [
                "ADMIN",
                "FOUNDER",
                "SUB_ADMIN",
                "DEPARTMENT_HEAD",
                "ACADEMIC_HEAD",
                "CONTENT_GROWTH_EXECUTIVE",
              ],
            },
          },
        },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
        take: 50,
      }),
    ]);

    return apiSuccess({
      canViewCosts,
      recentProjects,
      recentAssets,
      savedIdeas,
      activeJobs,
      failedJobs,
      recentGenerations: canViewCosts
        ? recentGenerations
        : recentGenerations.map((g) => ({ ...g, costUsd: null, costInr: null })),
      monthUsage: {
        calls: monthUsage._count.id,
        costUsd: canViewCosts ? monthUsage._sum.costUsd ?? 0 : null,
        costInr: canViewCosts ? monthUsage._sum.costInr ?? 0 : null,
      },
      managers,
    });
  } catch (err) {
    return handleApiError(err);
  }
}
