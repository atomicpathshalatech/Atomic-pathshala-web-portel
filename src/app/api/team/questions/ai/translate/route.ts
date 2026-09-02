import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { generateEducationalTranslation } from "@/lib/questions/ai-service";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_CREATE);

    const body = await request.json();
    const { text, sourceLanguage } = body;

    if (!text || typeof text !== "string") {
      return apiError("text string is required", 400);
    }

    const translation = await generateEducationalTranslation(
      text,
      sourceLanguage === "HINDI" ? "HINDI" : "ENGLISH"
    );

    return apiSuccess({ translation });
  } catch (error) {
    return handleApiError(error);
  }
}
