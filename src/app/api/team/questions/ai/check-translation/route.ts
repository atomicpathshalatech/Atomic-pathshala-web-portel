import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { verifyTranslation } from "@/lib/questions/ai-service";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_READ);

    const body = await request.json();
    const { englishText, hindiText } = body;

    if (!englishText || !hindiText) {
      return apiError("Both englishText and hindiText are required", 400);
    }

    const report = await verifyTranslation(englishText, hindiText);

    return apiSuccess({ report });
  } catch (error) {
    return handleApiError(error);
  }
}
