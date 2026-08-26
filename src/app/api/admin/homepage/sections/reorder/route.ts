import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { sectionReorderSchema } from "@/lib/validation/homepage";
import { apiSuccess, handleApiError } from "@/lib/api/response";

/** Bulk drag-drop reorder — one transaction so the draft never sits in a
 * half-reordered state if a request is interrupted partway through. */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.HOME_REORDER);

    const input = sectionReorderSchema.parse(await request.json());

    await prisma.$transaction(
      input.order.map((item) =>
        prisma.homePageSection.update({
          where: { id: item.id },
          data: { order: item.order, updatedById: session.user.id },
        })
      )
    );

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "HOME_SECTIONS_REORDERED",
        entityType: "HomePageSection",
        entityId: "bulk",
        metadata: { count: input.order.length },
      },
    });

    return apiSuccess({ reordered: input.order.length });
  } catch (error) {
    return handleApiError(error);
  }
}
