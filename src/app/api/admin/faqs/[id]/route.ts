import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { faqUpdateSchema } from "@/lib/validation/faq";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.FAQ_MANAGE);

    const input = faqUpdateSchema.parse(await request.json());
    const existing = await prisma.faq.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("FAQ not found.", 404);

    const faq = await prisma.faq.update({ where: { id: params.id }, data: input });
    return apiSuccess({ faq });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.FAQ_MANAGE);

    const existing = await prisma.faq.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("FAQ not found.", 404);

    await prisma.faq.delete({ where: { id: params.id } });
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
