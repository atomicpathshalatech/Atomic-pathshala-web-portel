import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

/** GET — every generated creative (Admin Creative Management > Generated Creatives, spec section 16). */
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.COMMUNICATION_CENTER_ACCESS);

    const type = new URL(req.url).searchParams.get("type");
    const creatives = await prisma.generatedCreative.findMany({
      where: type ? { type: type as never } : undefined,
      include: { template: { select: { name: true } }, background: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 200,
    });
    return apiSuccess({ creatives });
  } catch (error) {
    return handleApiError(error);
  }
}
