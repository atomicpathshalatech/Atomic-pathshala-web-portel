import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { bannerCreateSchema } from "@/lib/validation/banner";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.BANNER_MANAGE);

    const banners = await prisma.banner.findMany({ orderBy: [{ priority: "desc" }, { order: "asc" }] });
    return apiSuccess({ banners });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.BANNER_MANAGE);

    const input = bannerCreateSchema.parse(await request.json());

    const banner = await prisma.banner.create({
      data: { ...input, createdById: session.user.id },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "BANNER_CREATED",
        entityType: "Banner",
        entityId: banner.id,
        metadata: { title: banner.title },
      },
    });

    return apiSuccess({ banner }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
