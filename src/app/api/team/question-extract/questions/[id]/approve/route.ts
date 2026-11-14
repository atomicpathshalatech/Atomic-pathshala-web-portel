import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError, hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { approveStagedQuestion } from "@/lib/extraction/approval-service";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    // Human Approval Gate: Only authorized reviewers/admins can approve
    const canApprove =
      (await hasPermission(session.user.id, PERMISSIONS.QUESTION_APPROVE)) ||
      (await hasPermission(session.user.id, PERMISSIONS.QUESTION_VERIFY)) ||
      (await hasPermission(session.user.id, PERMISSIONS.QUESTION_CREATE)) ||
      session.user.role === "ADMIN" ||
      session.user.role === "SUPER_ADMIN" ||
      session.user.role === "ACADEMIC_HEAD";

    if (!canApprove) {
      return apiError("Forbidden: Explicit human approval permission required.", 403);
    }

    const body = await request.json().catch(() => ({}));
    const result = await approveStagedQuestion(params.id, session.user.id, body.overrides);

    return apiSuccess({
      message: result.message,
      result,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
