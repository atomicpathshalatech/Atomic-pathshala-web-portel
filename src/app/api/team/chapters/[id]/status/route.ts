import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { chapterStatusTransitionSchema } from "@/lib/validation/chapter";
import { canTransition, REVIEW_MANAGED_STATES, type ChapterStatusValue } from "@/lib/chapters/state-machine";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

/**
 * Chapter state-machine transition — backend-enforced via canTransition()
 * (see @/lib/chapters/state-machine.ts), not just a UI affordance. Moving
 * TO published requires the higher CHAPTER_PUBLISH permission; every other
 * transition only needs CHAPTER_UPDATE (a teacher moving their own chapter
 * through the earlier production states).
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const chapter = await prisma.chapter.findUnique({ where: { id: params.id } });
    if (!chapter) return apiError("Chapter not found", 404);

    const { status: nextStatus } = chapterStatusTransitionSchema.parse(await request.json());

    // Review-workflow states are entered only via POST .../submit and
    // POST .../review, never this generic route — otherwise a teacher
    // with plain CHAPTER_UPDATE could self-transition straight into
    // APPROVED, i.e. approve their own chapter.
    if (REVIEW_MANAGED_STATES.includes(nextStatus)) {
      return apiError(
        `Use ${nextStatus === "SUBMITTED" ? "POST /submit" : "POST /review"} to move a chapter into ${nextStatus}.`,
        409,
        { code: "USE_REVIEW_WORKFLOW", details: { chapterId: chapter.id, requestedStatus: nextStatus } }
      );
    }

    if (nextStatus === "PUBLISHED" || chapter.status === "PUBLISHED") {
      await requirePermission(session.user.id, PERMISSIONS.CHAPTER_PUBLISH);
    } else {
      await requirePermission(session.user.id, PERMISSIONS.CHAPTER_UPDATE);
    }

    const currentStatus = chapter.status as ChapterStatusValue;
    if (!canTransition(currentStatus, nextStatus)) {
      return apiError(`Cannot move a chapter from ${currentStatus} to ${nextStatus}.`, 409);
    }

    const updated = await prisma.chapter.update({
      where: { id: params.id },
      data: { status: nextStatus },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "CHAPTER_STATUS_CHANGED",
        entityType: "Chapter",
        entityId: chapter.id,
        metadata: { from: currentStatus, to: nextStatus },
      },
    });

    return apiSuccess({ chapter: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
