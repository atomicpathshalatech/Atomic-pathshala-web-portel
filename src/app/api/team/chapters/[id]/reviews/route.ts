import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/** GET /api/team/chapters/:id/reviews — the append-only review audit
 * trail (spec: "Never overwrite review history"). Every submit/approve/
 * reject/request-changes decision this chapter has ever gone through,
 * newest first. */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    await requirePermission(session?.user?.id, PERMISSIONS.CHAPTER_READ);

    const chapter = await prisma.chapter.findUnique({ where: { id: params.id }, select: { id: true } });
    if (!chapter) return apiError("Chapter not found", 404);

    const reviews = await prisma.chapterReview.findMany({
      where: { chapterId: params.id },
      include: { actor: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess({ reviews });
  } catch (error) {
    return handleApiError(error);
  }
}
