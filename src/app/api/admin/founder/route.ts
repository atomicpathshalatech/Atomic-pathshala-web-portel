import { NextRequest } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { founderUpdateSchema } from "@/lib/validation/founder";
import { FOUNDER_TAG } from "@/lib/founder";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin read — always returns the row (creating an empty one on first access). */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.FOUNDER_MANAGE);

    const founder = await prisma.founder.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    });
    return apiSuccess({ founder });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.FOUNDER_MANAGE);

    const input = founderUpdateSchema.parse(await request.json());
    const norm = (v: string | null | undefined) => (v && v !== "" ? v : null);

    const data = {
      name: input.name,
      designation: input.designation,
      photoUrl: norm(input.photoUrl),
      mobilePhotoUrl: norm(input.mobilePhotoUrl),
      shortBio: input.shortBio,
      biography: input.biography,
      education: input.education,
      experience: input.experience,
      teachingPhilosophy: input.teachingPhilosophy,
      vision: input.vision,
      founderMessage: input.founderMessage,
      socialLinks: input.socialLinks,
      isActive: input.isActive,
      seoTitle: norm(input.seoTitle),
      metaDescription: norm(input.metaDescription),
      ogImageUrl: norm(input.ogImageUrl),
      canonicalUrl: norm(input.canonicalUrl),
      updatedById: session.user.id,
    };

    const founder = await prisma.founder.upsert({
      where: { id: "singleton" },
      update: data,
      create: { id: "singleton", ...data },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "FOUNDER_UPDATED",
        entityType: "Founder",
        entityId: founder.id,
        metadata: { isActive: founder.isActive },
      },
    });

    revalidateTag(FOUNDER_TAG);
    revalidatePath("/");
    revalidatePath("/about-founder");

    return apiSuccess({ founder });
  } catch (error) {
    return handleApiError(error);
  }
}
