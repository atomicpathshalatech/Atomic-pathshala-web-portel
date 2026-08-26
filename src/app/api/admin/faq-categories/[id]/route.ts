import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { faqCategoryUpdateSchema } from "@/lib/validation/faq";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.FAQ_MANAGE);

    const input = faqCategoryUpdateSchema.parse(await request.json());
    const existing = await prisma.faqCategory.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Category not found.", 404);

    const category = await prisma.faqCategory.update({ where: { id: params.id }, data: input });
    return apiSuccess({ category });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Deleting a category doesn't delete its FAQs — categoryId is optional on
 * Faq and the FK is ON DELETE SET NULL, so orphaned FAQs just become
 * uncategorized rather than disappearing. */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.FAQ_MANAGE);

    const existing = await prisma.faqCategory.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Category not found.", 404);

    await prisma.faqCategory.delete({ where: { id: params.id } });
    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
