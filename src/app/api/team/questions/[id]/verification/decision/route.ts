import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import {
  acceptFieldSuggestion,
  rejectFieldSuggestion,
} from "@/lib/questions/verification-service";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_UPDATE);

    const body = await req.json().catch(() => ({}));
    const { action, suggestionId, decisionNote, editedValue } = body;

    if (!suggestionId) {
      return apiError("Missing suggestionId", 400);
    }

    if (action === "REJECT") {
      const result = await rejectFieldSuggestion({
        suggestionId,
        questionId: params.id,
        reviewerId: session.user.id,
        decisionNote,
      });

      return apiSuccess({
        result,
        message: "Suggestion rejected",
      });
    }

    if (action === "ACCEPT" || action === "EDIT") {
      const result = await acceptFieldSuggestion({
        suggestionId,
        questionId: params.id,
        reviewerId: session.user.id,
        decisionNote,
        editedValue: action === "EDIT" ? editedValue : undefined,
      });

      return apiSuccess({
        result,
        message: action === "EDIT" ? "Suggestion edited and applied" : "Suggestion accepted and applied",
      });
    }

    return apiError("Invalid action. Must be ACCEPT, EDIT, or REJECT", 400);
  } catch (error) {
    return handleApiError(error);
  }
}
