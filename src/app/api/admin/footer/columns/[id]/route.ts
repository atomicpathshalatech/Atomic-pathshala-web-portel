import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { footerColumnUpdateSchema } from "@/lib/validation/footer";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.FOOTER_MANAGE);

    const input = footerColumnUpdateSchema.parse(await request.json());
    const existing = await prisma.footerColumn.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Column not found.", 404);

    const column = await prisma.footerColumn.update({ where: { id: params.id }, data: input });
    return apiSuccess({ column });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Cascades to its links (onDelete: Cascade on FooterLink.columnId) — an
 * empty column left behind would just be dead weight in the footer. */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.FOOTER_MANAGE);

    const existing = await prisma.footerColumn.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Column not found.", 404);

    await prisma.footerColumn.delete({ where: { id: params.id } });
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
