import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    await requirePermission(session?.user?.id, PERMISSIONS.DOUBT_READ);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    const doubts = await prisma.doubt.findMany({
      where: status ? { status: status as "OPEN" | "RESOLVED" | "FLAGGED" } : {},
      include: { student: { include: { user: true } } },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });

    const statusCounts = await prisma.doubt.groupBy({ by: ["status"], _count: true });

    return apiSuccess({ doubts, statusCounts });
  } catch (error) {
    return handleApiError(error);
  }
}
