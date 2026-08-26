import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { pageSeoUpsertSchema } from "@/lib/validation/seo";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET(_request: NextRequest, { params }: { params: { pageKey: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.SEO_MANAGE);

    const seo = await prisma.pageSeo.findUnique({ where: { pageKey: params.pageKey } });
    return apiSuccess({ seo });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest, { params }: { params: { pageKey: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.SEO_MANAGE);

    const input = pageSeoUpsertSchema.parse({ ...(await request.json()), pageKey: params.pageKey });

    const seo = await prisma.pageSeo.upsert({
      where: { pageKey: params.pageKey },
      create: input,
      update: input,
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "PAGE_SEO_UPDATED",
        entityType: "PageSeo",
        entityId: seo.id,
        metadata: { pageKey: seo.pageKey },
      },
    });

    return apiSuccess({ seo });
  } catch (error) {
    return handleApiError(error);
  }
}
