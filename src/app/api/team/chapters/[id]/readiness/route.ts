import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { getChapterReadiness } from "@/lib/chapters/sequence";

/**
 * GET /api/team/chapters/:id/readiness — "Check Chapter Readiness".
 * Read-only, server-computed checklist; the same logic backs
 * POST .../submit, so this endpoint can never say "ready" when submit
 * would actually reject.
 */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    await requirePermission(session?.user?.id, PERMISSIONS.CHAPTER_READ);

    const chapter = await prisma.chapter.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!chapter) return apiError("Chapter not found", 404);

    const readiness = await getChapterReadiness(params.id);
    return apiSuccess({ readiness });
  } catch (error) {
    return handleApiError(error);
  }
}
