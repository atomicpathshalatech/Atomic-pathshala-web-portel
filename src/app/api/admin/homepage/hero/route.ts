import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireSuperAdmin, UnauthorizedError } from "@/lib/rbac/guard";
import { homeHeroSchema } from "@/lib/validation/blog";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Homepage hero centre image (Team → Website → Homepage Hero Image). */
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requireSuperAdmin(session.user.id);

    const input = homeHeroSchema.parse(await request.json());
    const data = {
      imageUrl: input.imageUrl || null,
      mobileImageUrl: input.mobileImageUrl || null,
      altText: input.altText || null,
      updatedById: session.user.id,
    };
    const hero = await prisma.homeHero.upsert({ where: { id: "singleton" }, update: data, create: { id: "singleton", ...data } });
    await prisma.auditLog.create({
      data: { userId: session.user.id, action: "HOME_HERO_UPDATED", entityType: "HomeHero", entityId: hero.id, metadata: { hasImage: !!hero.imageUrl } },
    });
    revalidatePath("/");
    return apiSuccess({ hero });
  } catch (error) {
    return handleApiError(error);
  }
}
