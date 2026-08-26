import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { sectionCreateSchema } from "@/lib/validation/homepage";
import { apiSuccess, handleApiError } from "@/lib/api/response";

/**
 * Lists the live DRAFT sections (never what the public site renders —
 * see /api/homepage for that). This is what the Home Builder admin UI
 * edits directly; nothing here is public until an explicit Publish.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.HOME_VIEW);

    const sections = await prisma.homePageSection.findMany({ orderBy: { order: "asc" } });
    return apiSuccess({ sections });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.HOME_CREATE);

    const input = sectionCreateSchema.parse(await request.json());

    const maxOrder = await prisma.homePageSection.aggregate({ _max: { order: true } });
    const order = input.order ?? (maxOrder._max.order ?? -1) + 1;

    const section = await prisma.homePageSection.create({
      data: {
        type: input.type,
        title: input.title,
        subtitle: input.subtitle,
        order,
        visible: input.visible ?? true,
        visibleDesktop: input.visibleDesktop ?? true,
        visibleMobile: input.visibleMobile ?? true,
        config: (input.config ?? {}) as Prisma.InputJsonValue,
        background: input.background,
        padding: input.padding,
        createdById: session.user.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "HOME_SECTION_CREATED",
        entityType: "HomePageSection",
        entityId: section.id,
        metadata: { type: section.type },
      },
    });

    return apiSuccess({ section }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
