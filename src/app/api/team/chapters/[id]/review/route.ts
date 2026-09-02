import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { chapterReviewDecisionSchema } from "@/lib/validation/chapter";
import type { ChapterStatusValue } from "@/lib/chapters/state-machine";
import type { ChapterReviewAction, ChapterStatus } from "@prisma/client";

const DECISION_TO_STATUS: Record<"APPROVE" | "REJECT" | "REQUEST_CHANGES", ChapterStatus> = {
  APPROVE: "APPROVED",
  REJECT: "REJECTED",
  REQUEST_CHANGES: "CHANGES_REQUESTED",
};
const DECISION_TO_REVIEW_ACTION: Record<"APPROVE" | "REJECT" | "REQUEST_CHANGES", ChapterReviewAction> = {
  APPROVE: "APPROVED",
  REJECT: "REJECTED",
  REQUEST_CHANGES: "CHANGES_REQUESTED",
};

/**
 * POST /api/team/chapters/:id/review — admin decision on a chapter that
 * is UNDER_REVIEW: Approve, Reject, or Request Changes. Requires
 * CHAPTER_REVIEW (a distinct permission from the CHAPTER_UPDATE a teacher
 * uses to author their own chapter) and explicitly refuses to let the
 * chapter's own creator review it — "approve own chapter" is blocked at
 * the API, not just hidden in the UI.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CHAPTER_REVIEW);

    const chapter = await prisma.chapter.findUnique({ where: { id: params.id } });
    if (!chapter) return apiError("Chapter not found", 404);

    if (chapter.createdById && chapter.createdById === session.user.id) {
      throw new ForbiddenError("You cannot review a chapter you created yourself.");
    }

    const currentStatus = chapter.status as ChapterStatusValue;
    if (currentStatus !== "UNDER_REVIEW") {
      return apiError(`Chapter is not awaiting review (currently ${currentStatus}).`, 409, {
        code: "INVALID_TRANSITION",
        details: { chapterId: chapter.id, from: currentStatus },
      });
    }

    const { action, comment } = chapterReviewDecisionSchema.parse(await request.json());
    const newStatus = DECISION_TO_STATUS[action];

    const [updated] = await prisma.$transaction([
      prisma.chapter.update({ where: { id: chapter.id }, data: { status: newStatus } }),
      prisma.chapterReview.create({
        data: {
          chapterId: chapter.id,
          action: DECISION_TO_REVIEW_ACTION[action],
          comment: comment ?? null,
          actorId: session.user.id,
          previousStatus: currentStatus,
          newStatus,
        },
      }),
      prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "CHAPTER_REVIEWED",
          entityType: "Chapter",
          entityId: chapter.id,
          metadata: { decision: action, from: currentStatus, to: newStatus, comment: comment ?? null },
        },
      }),
    ]);

    return apiSuccess({ chapter: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
