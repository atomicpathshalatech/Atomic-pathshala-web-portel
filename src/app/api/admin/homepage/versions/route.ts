import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.HOME_VIEW);

    const versions = await prisma.homePageVersion.findMany({
      orderBy: { versionNumber: "desc" },
      take: 50,
      select: {
        id: true,
        versionNumber: true,
        note: true,
        publishedAt: true,
        unpublishedAt: true,
        publishedBy: { select: { name: true } },
        sectionsSnapshot: false,
      },
    });

    return apiSuccess({ versions });
  } catch (error) {
    return handleApiError(error);
  }
}
