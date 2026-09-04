import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { computeISTScheduleDates } from "@/lib/date-utils";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; lectureId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.LECTURE_CREATE);

    const lecture = await prisma.lecture.findUnique({
      where: { id: params.lectureId, chapterId: params.id },
    });
    if (!lecture) return apiError("Lecture not found", 404);

    const body = await request.json();
    const { title, scheduledDate, startTime, durationMin, slidesUrl, videoUrl, language } = body;

    const updated = await prisma.lecture.update({
      where: { id: params.lectureId },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(scheduledDate !== undefined && { scheduledDate: scheduledDate ? new Date(scheduledDate) : null }),
        ...(startTime !== undefined && { startTime: startTime?.trim() || null }),
        ...(durationMin !== undefined && { durationMin: Number(durationMin) || 60 }),
        ...(slidesUrl !== undefined && { slidesUrl: slidesUrl?.trim() || null }),
        ...(videoUrl !== undefined && { videoUrl: videoUrl?.trim() || "" }),
        ...(language !== undefined && { language }),
      },
      include: {
        teacher: { include: { user: { select: { name: true } } } },
      },
    });

    // Auto-sync BatchSchedule with accurate IST dates
    try {
      const { startsAt, endsAt } = computeISTScheduleDates(
        updated.scheduledDate,
        updated.startTime,
        updated.durationMin || 60
      );
      await prisma.batchSchedule.updateMany({
        where: { id: updated.id },
        data: {
          title: updated.title,
          startsAt,
          endsAt,
        },
      });
    } catch {
      // Non-blocking sync
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "LECTURE_UPDATED",
        entityType: "Lecture",
        entityId: updated.id,
        metadata: { chapterId: params.id, title: updated.title },
      },
    });

    return apiSuccess({ lecture: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; lectureId: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.LECTURE_DELETE || PERMISSIONS.CHAPTER_UPDATE);

    const lecture = await prisma.lecture.findUnique({
      where: { id: params.lectureId, chapterId: params.id },
    });
    if (!lecture) return apiError("Lecture not found", 404);

    await prisma.lecture.delete({
      where: { id: params.lectureId },
    });

    try {
      await prisma.batchSchedule.deleteMany({
        where: { id: params.lectureId },
      });
    } catch {
      // Ignore
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "LECTURE_DELETED",
        entityType: "Lecture",
        entityId: params.lectureId,
        metadata: { chapterId: params.id, title: lecture.title },
      },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
