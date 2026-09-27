import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { deleteSimulcastGroup, SimulcastGroupError } from "@/lib/live-session/simulcast";

/** Admin-only: dissolve a simulcast group whose class hasn't started. */
export async function DELETE(_request: NextRequest, { params }: { params: { groupId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.LIVE_CLASS_ADMIN);

    await deleteSimulcastGroup(params.groupId);
    return apiSuccess({ removed: true });
  } catch (error) {
    if (error instanceof SimulcastGroupError) return apiError(error.message, error.status);
    return handleApiError(error);
  }
}
