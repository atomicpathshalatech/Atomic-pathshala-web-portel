import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { appYoutubeAvailable } from "@/lib/live-session/delivery-options";

export const dynamic = "force-dynamic";

/**
 * What the Start Class modal may offer. appYoutube=false means this server
 * has no App YouTube yet (no YouTube credentials or no stream slots), so the
 * App class falls back to the interactive LiveKit room.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.WHITEBOARD_ACCESS);
    return apiSuccess({ appYoutube: await appYoutubeAvailable().catch(() => false) });
  } catch (error) {
    return handleApiError(error);
  }
}
