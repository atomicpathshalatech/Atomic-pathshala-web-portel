import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { faqCreateSchema } from "@/lib/validation/faq";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.FAQ_MANAGE);

    const faqs = await prisma.faq.findMany({
      orderBy: [{ categoryId: "asc" }, { order: "asc" }],
      include: { category: { select: { id: true, name: true } } },
    });
    return apiSuccess({ faqs });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.FAQ_MANAGE);

    const input = faqCreateSchema.parse(await request.json());
    const faq = await prisma.faq.create({ data: input });
    return apiSuccess({ faq }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
