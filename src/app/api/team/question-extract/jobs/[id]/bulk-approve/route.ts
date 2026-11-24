import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { UnauthorizedError, hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { bulkApproveStagedQuestions } from "@/lib/extraction/approval-service";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const canApprove =
      (await hasPermission(session.user.id, PERMISSIONS.QUESTION_APPROVE)) ||
      (await hasPermission(session.user.id, PERMISSIONS.QUESTION_VERIFY)) ||
      (await hasPermission(session.user.id, PERMISSIONS.QUESTION_CREATE)) ||
      session.user.role === "ADMIN" ||
      session.user.role === "FOUNDER" ||
      session.user.role === "ACADEMIC_HEAD";

    if (!canApprove) {
      return apiError("Forbidden: Explicit approval permission required for bulk approval.", 403);
    }

    const body = await request.json().catch(() => ({}));
    const { questionIds } = body;

    if (!Array.isArray(questionIds) || questionIds.length === 0) {
      return apiError("Please provide an array of explicitly selected questionIds for bulk approval.", 400);
    }

    const result = await bulkApproveStagedQuestions(params.id, questionIds, session.user.id);

    return apiSuccess({
      message: `Successfully approved & published ${result.successCount} question(s) into the official Question Bank.`,
      result,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
