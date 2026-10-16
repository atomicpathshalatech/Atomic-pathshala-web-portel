import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/api/response";
import { requestAccountDeletion, SELF_DELETE_ROLES } from "@/lib/account/deletion";

/** A student asks for their account to be deleted (Settings / /delete-account). */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Please log in first.", 401);
    if (!SELF_DELETE_ROLES.has(session.user.role ?? "")) {
      return apiError("Staff accounts are closed by an administrator. Please contact the admin.", 403);
    }
    const body = (await request.json().catch(() => ({}))) as { confirm?: string; reason?: string };
    if (String(body.confirm ?? "").trim().toUpperCase() !== "DELETE") {
      return apiError('Type DELETE to confirm.', 400);
    }
    const reason = String(body.reason ?? "").trim().slice(0, 500) || null;
    await requestAccountDeletion(session.user.id, reason);
    return apiSuccess({ requested: true });
  } catch (error) {
    return handleApiError(error);
  }
}
