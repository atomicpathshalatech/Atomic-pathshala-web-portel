import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { sendAgreementInvitation } from "@/lib/agreements/agreement-service";

export const dynamic = "force-dynamic";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const canCreate =
      (await hasPermission(session.user.id, PERMISSIONS.CONTRACT_CREATE)) ||
      (await hasPermission(session.user.id, PERMISSIONS.TEAM_PORTAL_ACCESS));
    if (!canCreate) {
      throw new UnauthorizedError("You do not have permission to dispatch agreements.");
    }

    const result = await sendAgreementInvitation(params.id, session.user.id);

    return apiSuccess({
      message: "Agreement invitation successfully dispatched to educator.",
      reviewUrl: result.reviewUrl,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
