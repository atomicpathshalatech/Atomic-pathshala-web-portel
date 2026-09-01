import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { brandProfileSchema } from "@/lib/validation/module";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.MODULE_BRAND_PROFILE_MANAGE);

    const existing = await prisma.brandProfile.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Brand profile not found", 404);

    const input = brandProfileSchema.parse(await request.json());

    const updated = await prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.brandProfile.updateMany({ where: { isDefault: true, id: { not: params.id } }, data: { isDefault: false } });
      }
      return tx.brandProfile.update({
        where: { id: params.id },
        data: {
          name: input.name,
          logoUrl: input.logoUrl || null,
          primaryColor: input.primaryColor || null,
          secondaryColor: input.secondaryColor || null,
          fontFamily: input.fontFamily || null,
          websiteUrl: input.websiteUrl || null,
          tagline: input.tagline || null,
          isDefault: input.isDefault ?? existing.isDefault,
        },
      });
    });

    return apiSuccess({ profile: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.MODULE_BRAND_PROFILE_MANAGE);

    const inUse = await prisma.module.count({ where: { brandProfileId: params.id } });
    if (inUse > 0) {
      return apiError(`This brand profile is used by ${inUse} module${inUse === 1 ? "" : "s"} — unlink them first.`, 409);
    }

    const deleted = await prisma.brandProfile.deleteMany({ where: { id: params.id } });
    if (deleted.count === 0) return apiError("Brand profile not found", 404);

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
