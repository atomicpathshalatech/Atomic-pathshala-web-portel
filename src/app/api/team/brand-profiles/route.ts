import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { brandProfileSchema } from "@/lib/validation/module";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.MODULE_READ);

    const profiles = await prisma.brandProfile.findMany({ orderBy: { createdAt: "asc" } });
    return apiSuccess({ profiles });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.MODULE_BRAND_PROFILE_MANAGE);

    const input = brandProfileSchema.parse(await request.json());

    const profile = await prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.brandProfile.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
      }
      return tx.brandProfile.create({
        data: {
          name: input.name,
          logoUrl: input.logoUrl || null,
          primaryColor: input.primaryColor || null,
          secondaryColor: input.secondaryColor || null,
          fontFamily: input.fontFamily || null,
          websiteUrl: input.websiteUrl || null,
          tagline: input.tagline || null,
          isDefault: input.isDefault ?? false,
          createdById: session.user.id,
        },
      });
    });

    return apiSuccess({ profile }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
