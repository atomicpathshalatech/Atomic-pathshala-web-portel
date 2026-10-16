import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireSuperAdmin } from "@/lib/rbac/guard";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { cancelAccountDeletion, eraseAccount, listPendingDeletions } from "@/lib/account/deletion";

/**
 * Super Admin: act on a pending account-deletion request.
 * { action: "erase" } erases the personal data (irreversible);
 * { action: "cancel" } switches the account back on.
 */
export async function POST(request: NextRequest, { params }: { params: { userId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    await requireSuperAdmin(session?.user?.id);
    const { action } = (await request.json().catch(() => ({}))) as { action?: string };

    const pending = await listPendingDeletions();
    if (!pending.some((p) => p.userId === params.userId)) {
      return apiError("No pending deletion request for this account.", 404);
    }
    if (action === "erase") await eraseAccount(params.userId, session!.user.id);
    else if (action === "cancel") await cancelAccountDeletion(params.userId, session!.user.id);
    else return apiError("Unknown action", 400);
    return apiSuccess({ done: action });
  } catch (error) {
    return handleApiError(error);
  }
}
