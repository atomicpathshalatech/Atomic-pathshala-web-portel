import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { auditChapterBatch } from "@/lib/questions/ai-audit-engine";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_VERIFY);

    const body = await req.json();
    const { subject, chapter } = body;

    if (!subject || !chapter) {
      return apiError("Subject and Chapter are required to run AI Chapter Audit", 400);
    }

    const summary = await auditChapterBatch(subject, chapter);

    return apiSuccess({
      summary,
      message: `Audited ${summary.auditedCount} questions (${summary.cachedCount} preserved/cached, ${summary.verifiedCount} AI Verified, ${summary.failedCount} Failed)`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
