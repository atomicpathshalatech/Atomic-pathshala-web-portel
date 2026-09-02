import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEAM_PORTAL_ACCESS);

    const { searchParams } = new URL(request.url);
    const resourceId = searchParams.get("resourceId")?.trim().toUpperCase();
    const action = searchParams.get("action")?.trim();

    const where: any = {};
    if (resourceId) where.resourceId = resourceId;
    if (action && action !== "ALL") where.action = action;

    const logs = await prisma.resourceAuditLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return apiSuccess({ logs });
  } catch (error) {
    return handleApiError(error);
  }
}
