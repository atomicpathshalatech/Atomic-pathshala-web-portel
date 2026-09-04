import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { importVerifiedQuestionsToDraft } from "@/lib/extraction/draft-importer";

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_CREATE);

    const result = await importVerifiedQuestionsToDraft(params.id, session.user.id);

    return apiSuccess({
      message: `Successfully moved ${result.importedCount} verified question(s) to Question Bank Drafts.`,
      result,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
