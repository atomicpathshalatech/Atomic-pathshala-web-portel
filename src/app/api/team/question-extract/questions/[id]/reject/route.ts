import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UnauthorizedError, hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { rejectStagedQuestion } from "@/lib/extraction/approval-service";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const canReject =
      (await hasPermission(session.user.id, PERMISSIONS.QUESTION_APPROVE)) ||
      (await hasPermission(session.user.id, PERMISSIONS.QUESTION_VERIFY)) ||
      (await hasPermission(session.user.id, PERMISSIONS.QUESTION_CREATE)) ||
      session.user.role === "ADMIN" ||
      session.user.role === "SUPER_ADMIN" ||
      session.user.role === "ACADEMIC_HEAD";

    if (!canReject) {
      return apiError("Forbidden: Reviewer or Admin permission required.", 403);
    }

    const body = await request.json().catch(() => ({}));
    const result = await rejectStagedQuestion(params.id, session.user.id, body.reason);

    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
