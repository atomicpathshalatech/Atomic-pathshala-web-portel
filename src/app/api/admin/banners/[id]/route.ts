import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { bannerUpdateSchema } from "@/lib/validation/banner";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.BANNER_MANAGE);

    const input = bannerUpdateSchema.parse(await request.json());

    const existing = await prisma.banner.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Banner not found.", 404);

    const banner = await prisma.banner.update({ where: { id: params.id }, data: input });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "BANNER_UPDATED",
        entityType: "Banner",
        entityId: banner.id,
        metadata: { fields: Object.keys(input) },
      },
    });

    return apiSuccess({ banner });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.BANNER_MANAGE);

    const existing = await prisma.banner.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Banner not found.", 404);

    await prisma.banner.delete({ where: { id: params.id } });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "BANNER_DELETED",
        entityType: "Banner",
        entityId: params.id,
        metadata: { title: existing.title },
      },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
