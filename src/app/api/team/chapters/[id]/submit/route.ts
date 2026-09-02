import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { getChapterReadiness } from "@/lib/chapters/sequence";
import { canTransition, type ChapterStatusValue } from "@/lib/chapters/state-machine";

/**
 * POST /api/team/chapters/:id/submit — "Submit for Review".
 *
 * Runs the same server-side readiness check as GET .../readiness; if
 * anything mandatory is missing the request is rejected with the exact
 * list (never a bare "something went wrong"). On success: chapter moves
 * READY_TO_PUBLISH -> UNDER_REVIEW (through SUBMITTED in the audit trail),
 * a ChapterReview row records who submitted and when, and both writes
 * happen in one transaction so the chapter can never be left half-moved.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CHAPTER_UPDATE);

    const chapter = await prisma.chapter.findUnique({ where: { id: params.id } });
    if (!chapter) return apiError("Chapter not found", 404);

    const currentStatus = chapter.status as ChapterStatusValue;
    if (!canTransition(currentStatus, "SUBMITTED")) {
      return apiError(
        `Chapter must be READY_TO_PUBLISH before it can be submitted (currently ${currentStatus}).`,
        409,
        { code: "INVALID_TRANSITION", details: { chapterId: chapter.id, from: currentStatus, to: "SUBMITTED" } }
      );
    }

    const readiness = await getChapterReadiness(params.id);
    if (!readiness.ready) {
      return apiError("Chapter is not ready for submission.", 409, {
        code: "CHAPTER_NOT_READY",
        details: { chapterId: chapter.id, missing: readiness.missing },
      });
    }

    const [updated] = await prisma.$transaction([
      prisma.chapter.update({ where: { id: chapter.id }, data: { status: "UNDER_REVIEW" } }),
      prisma.chapterReview.create({
        data: {
          chapterId: chapter.id,
          action: "SUBMITTED",
          actorId: session.user.id,
          previousStatus: currentStatus,
          newStatus: "UNDER_REVIEW",
        },
      }),
      prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CHAPTER_SUBMITTED",
          entityType: "Chapter",
          entityId: chapter.id,
          metadata: { from: currentStatus, to: "UNDER_REVIEW" },
        },
      }),
    ]);

    return apiSuccess({ chapter: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
