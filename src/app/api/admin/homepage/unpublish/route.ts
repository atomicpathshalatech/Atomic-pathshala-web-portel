import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/**
 * "Go dark": marks the currently-live version unpublishedAt so the public
 * site falls back to the safe static homepage. Nothing is deleted — the
 * version row (and every version before it) stays in history for Restore.
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.HOME_PUBLISH);

    const live = await prisma.homePageVersion.findFirst({
      where: { unpublishedAt: null },
      orderBy: { publishedAt: "desc" },
    });
    if (!live) return apiError("There is no published version to unpublish.", 400);

    const version = await prisma.homePageVersion.update({
      where: { id: live.id },
      data: { unpublishedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "HOMEPAGE_UNPUBLISHED",
        entityType: "HomePageVersion",
        entityId: version.id,
        metadata: { versionNumber: version.versionNumber },
      },
    });

    return apiSuccess({ version });
  } catch (error) {
    return handleApiError(error);
  }
}
