import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { exerciseSimilarity, questionSimilarity } from "@/lib/exercises/module-similarity";

export const dynamic = "force-dynamic";

/**
 * GET — each question of this exercise with its closest question in the
 * chapter module (duplicates show 100 %).
 * GET ?questionId= — the closest matches of one question just added.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_READ);

    const questionId = request.nextUrl.searchParams.get("questionId");
    if (questionId) {
      const res = await questionSimilarity(params.id, questionId);
      return res ? apiSuccess(res) : apiError("That question is not in this exercise.", 404);
    }
    return apiSuccess(await exerciseSimilarity(params.id));
  } catch (err) {
    return handleApiError(err);
  }
}
