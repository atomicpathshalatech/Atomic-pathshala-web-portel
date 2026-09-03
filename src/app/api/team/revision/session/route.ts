import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiSuccess, handleApiError, apiError } from "@/lib/api/response";
import {
  startRevisionSession,
  submitRevisionSession,
} from "@/lib/question-bank-hierarchical/revision-service";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    const body = await request.json();
    const { action, revisionItemId, mode, sessionId, answers } = body;

    if (action === "start" && revisionItemId) {
      const data = await startRevisionSession(session.user.id, revisionItemId, mode || "ALL");
      return apiSuccess(data);
    }

    if (action === "submit" && sessionId && answers) {
      const result = await submitRevisionSession(session.user.id, sessionId, answers);
      return apiSuccess({ success: true, result });
    }

    return apiError("Invalid session payload.", 400);
  } catch (error) {
    return handleApiError(error);
  }
}
