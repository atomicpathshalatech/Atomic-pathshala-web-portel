import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { faqCategoryCreateSchema } from "@/lib/validation/faq";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.FAQ_MANAGE);

    const categories = await prisma.faqCategory.findMany({ orderBy: { order: "asc" } });
    return apiSuccess({ categories });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.FAQ_MANAGE);

    const input = faqCategoryCreateSchema.parse(await request.json());

    const existing = await prisma.faqCategory.findUnique({ where: { name: input.name } });
    if (existing) return apiError("A category with this name already exists.", 409);

    const category = await prisma.faqCategory.create({ data: input });
    return apiSuccess({ category }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
