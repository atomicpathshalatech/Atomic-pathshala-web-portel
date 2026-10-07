import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { auditSingleQuestion } from "@/lib/questions/ai-audit-engine";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_READ);

    const body = await req.json().catch(() => ({}));
    const forceReaudit = Boolean(body?.forceReaudit);

    const { result, cached } = await auditSingleQuestion(params.id, { forceReaudit });

    return apiSuccess({
      result,
      cached,
      message: cached ? "Retrieved existing verified AI audit results" : "AI Audit successfully performed",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
