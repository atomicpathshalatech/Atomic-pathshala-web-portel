import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { doubtResolveSchema } from "@/lib/validation/doubt";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.DOUBT_RESOLVE);

    const existing = await prisma.doubt.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Doubt not found", 404);

    const data = doubtResolveSchema.parse(await request.json());

    const doubt = await prisma.doubt.update({
      where: { id: params.id },
      data: {
        status: data.status,
        expertExplanation: data.expertExplanation || null,
        videoUrl: data.videoUrl || null,
        resolvedById: session.user.id,
        resolvedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: `DOUBT_${data.status}`,
        entityType: "Doubt",
        entityId: doubt.id,
      },
    });

    return apiSuccess({ doubt });
  } catch (error) {
    return handleApiError(error);
  }
}
