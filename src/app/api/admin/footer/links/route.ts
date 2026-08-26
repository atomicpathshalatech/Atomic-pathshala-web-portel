import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { footerLinkCreateSchema } from "@/lib/validation/footer";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.FOOTER_MANAGE);

    const input = footerLinkCreateSchema.parse(await request.json());

    const column = await prisma.footerColumn.findUnique({ where: { id: input.columnId } });
    if (!column) return apiError("Column not found.", 404);

    const link = await prisma.footerLink.create({ data: input });
    return apiSuccess({ link }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
