import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, hasPermission, UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
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
        where: {
          OR: [{ id: updated.id }, { lectureId: updated.id }],
        },
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
    // `PERMISSIONS.LECTURE_DELETE || PERMISSIONS.CHAPTER_UPDATE` used to
    // collapse to just LECTURE_DELETE (both are non-empty strings, so `||`
    // never fell through to CHAPTER_UPDATE) - a permission the TEACHER role
    // never gets by default, only ADMIN does. This is why teachers could
    // never delete a lecture. Real "allow either permission" check below.
    const canDelete =
      (await hasPermission(session.user.id, PERMISSIONS.LECTURE_DELETE)) ||
      (await hasPermission(session.user.id, PERMISSIONS.CHAPTER_UPDATE));
    if (!canDelete) throw new ForbiddenError("You do not have permission to delete this lecture.");

    const lecture = await prisma.lecture.findUnique({
      where: { id: params.lectureId, chapterId: params.id },
    });
    if (!lecture) return apiError("Lecture not found", 404);

    // Hard delete — Lecture has no soft-delete field/status in the current
    // schema (LectureStatus is only DRAFT|PUBLISHED). Safe: every relation
    // pointing at Lecture is onDelete Cascade (LectureProgress,
    // LectureIssueReport, LectureNote) or SetNull (BatchSchedule.lecture) -
    // nothing Restricts. Deleting a Lecture never touches the separate
    // WhiteboardSession/youtubeArchive* fields (no direct FK relation
    // exists between Lecture and WhiteboardSession), so an archived
    // YouTube recording is never deleted just because the Lecture row is.
    // BatchSchedule.lecture is onDelete: SetNull, so any schedule rows
    // that referenced this lecture have their lectureId nulled by the
    // database automatically as part of this delete — no separate cleanup
    // query needed. (The previous cleanup here filtered BatchSchedule by
    // `id: params.lectureId`, a Lecture id never a BatchSchedule id, so it
    // always matched zero rows — dead code, removed rather than fixed
    // in place since it's now redundant with the FK's own SetNull.)
    await prisma.lecture.delete({
      where: { id: params.lectureId },
    });

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
