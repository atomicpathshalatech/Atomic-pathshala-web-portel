import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { lookupPlatformResource } from "@/lib/resources/registry";

export async function GET(
  _request: NextRequest,
  { params }: { params: { resourceId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.TEAM_PORTAL_ACCESS);

    const resource = await lookupPlatformResource(params.resourceId);
    if (!resource) {
      return apiError(`Resource '${params.resourceId}' not found. Please verify the Resource ID.`, 404);
    }

    return apiSuccess({ resource });
  } catch (error) {
    return handleApiError(error);
  }
}
