import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/** Device sessions for one user, by email search — admin/security-team
 * view. Requires an explicit search term rather than listing everyone's
 * sessions by default (this is sensitive account-activity data). */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    await requirePermission(session?.user?.id, PERMISSIONS.SECURITY_DEVICE_MANAGE);

    const { searchParams } = new URL(request.url);
    const email = searchParams.get("email")?.trim().toLowerCase();
    if (!email) return apiError("Provide an email to search for.", 400);

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, name: true, email: true },
    });
    if (!user) return apiError("No user found with that email.", 404);

    const sessions = await prisma.deviceSession.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    return apiSuccess({ user, sessions });
  } catch (error) {
    return handleApiError(error);
  }
}
