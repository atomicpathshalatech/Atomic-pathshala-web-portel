import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { footerLinkUpdateSchema } from "@/lib/validation/footer";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.FOOTER_MANAGE);

    const input = footerLinkUpdateSchema.parse(await request.json());
    const existing = await prisma.footerLink.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Link not found.", 404);

    const link = await prisma.footerLink.update({ where: { id: params.id }, data: input });
    return apiSuccess({ link });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.FOOTER_MANAGE);

    const existing = await prisma.footerLink.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Link not found.", 404);

    await prisma.footerLink.delete({ where: { id: params.id } });
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
