import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import {
  parseQuestionFromRawText,
  generateEducationalTranslation,
  generateAiMetadata,
  generateAiSolution,
} from "@/lib/questions/ai-service";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_CREATE);

    const body = await request.json();
    const { action, payload } = body;

    if (action === "extract") {
      const result = parseQuestionFromRawText(payload.rawText || "");
      return apiSuccess({ result });
    }

    if (action === "translate") {
      const translation = generateEducationalTranslation(
        payload.text || "",
        payload.sourceLanguage || "ENGLISH"
      );
      return apiSuccess({ translation });
    }

    if (action === "metadata") {
      const metadata = generateAiMetadata(
        payload.statement || "",
        payload.options
      );
      return apiSuccess({ metadata });
    }

    if (action === "solution") {
      const solution = generateAiSolution(
        payload.statement || "",
        payload.options || {},
        payload.correctAnswer || "A"
      );
      return apiSuccess({ solution });
    }

    return apiError("Unknown AI action requested", 400);
  } catch (error) {
    return handleApiError(error);
  }
}