import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { type ChapterStatusValue } from "@/lib/chapters/state-machine";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.CHAPTER_UPDATE);

    const chapter = await prisma.chapter.findUnique({
      where: { id: params.id },
      include: {
        _count: { select: { lectures: true } },
      },
    });
    if (!chapter) return apiError("Chapter not found", 404);

    if (chapter._count.lectures === 0) {
      return apiError("Please add at least one lecture before submitting the chapter.", 400);
    }

    const currentStatus = chapter.status as ChapterStatusValue;

    const [updated] = await prisma.$transaction([
      prisma.chapter.update({
        where: { id: chapter.id },
        data: { status: "UNDER_REVIEW" },
      }),
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
