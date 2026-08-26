import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { sectionUpdateSchema } from "@/lib/validation/homepage";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.HOME_EDIT);

    const input = sectionUpdateSchema.parse(await request.json());

    const existing = await prisma.homePageSection.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Section not found.", 404);

    // `config` is a Prisma Json field — a plain Record<string, unknown> from
    // Zod doesn't structurally match Prisma's InputJsonValue type, so it
    // needs an explicit cast here (the value itself is already validated).
    const section = await prisma.homePageSection.update({
      where: { id: params.id },
      data: {
        ...input,
        config: input.config as Prisma.InputJsonValue | undefined,
        updatedById: session.user.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "HOME_SECTION_UPDATED",
        entityType: "HomePageSection",
        entityId: section.id,
        metadata: { fields: Object.keys(input) },
      },
    });

    return apiSuccess({ section });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.HOME_DELETE);

    const existing = await prisma.homePageSection.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Section not found.", 404);

    await prisma.homePageSection.delete({ where: { id: params.id } });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "HOME_SECTION_DELETED",
        entityType: "HomePageSection",
        entityId: params.id,
        metadata: { type: existing.type },
      },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
