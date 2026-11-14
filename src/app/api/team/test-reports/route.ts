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
    await requirePermission(session.user.id, PERMISSIONS.TEST_READ);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const reports = await prisma.testAuditReport.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        test: {
          select: {
            id: true,
            title: true,
            testCode: true,
            status: true,
            auditStatus: true,
            updatedAt: true,
          },
        },
      },
    });

    return apiSuccess({ reports });
  } catch (error) {
    return handleApiError(error);
  }
}
