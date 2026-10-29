import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/api/response";
import { ForbiddenError } from "@/lib/rbac/guard";
import { canManageRecordedLectures } from "@/lib/recorded-lectures/access";
import { recordedStatusSchema } from "@/lib/recorded-lectures/schemas";
import { recordedApiError, requireUserId } from "@/lib/recorded-lectures/api";
import { loadRecordedLecture, serializeStaffLecture } from "@/lib/recorded-lectures/service";

export const dynamic = "force-dynamic";

/**
 * Publish / unpublish / archive / restore. A lecture is published only when
 * its video is uploaded and verified (READY) — never because an upload
 * started. The summary is not required to publish.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    if (!(await canManageRecordedLectures(userId))) throw new ForbiddenError();
    const { action } = recordedStatusSchema.parse(await request.json());

    const lecture = await prisma.lecture.findUnique({
      where: { id: params.id },
      select: { id: true, status: true, recordedMedia: { select: { uploadStatus: true, archivedAt: true } } },
    });
    if (!lecture?.recordedMedia) return apiError("Recorded lecture not found.", 404);
    const media = lecture.recordedMedia;

    if (action === "publish") {
      if (media.uploadStatus !== "READY") return apiError("Upload and verify the video before publishing.", 409, { code: "VIDEO_NOT_READY" });
      if (media.archivedAt) return apiError("Restore the lecture from the archive before publishing.", 409);
      // Conditional update: two admins clicking at once publish it once.
      await prisma.$transaction([
        prisma.lecture.update({ where: { id: params.id }, data: { status: "PUBLISHED" } }),
        prisma.recordedLectureMedia.updateMany({
          where: { lectureId: params.id, uploadStatus: "READY", archivedAt: null },
          data: { publishedAt: new Date(), updatedById: userId },
        }),
      ]);
    } else if (action === "unpublish") {
      await prisma.lecture.update({ where: { id: params.id }, data: { status: "DRAFT" } });
      await prisma.recordedLectureMedia.update({ where: { lectureId: params.id }, data: { updatedById: userId } });
    } else if (action === "archive") {
      await prisma.$transaction([
        prisma.lecture.update({ where: { id: params.id }, data: { status: "DRAFT" } }),
        prisma.recordedLectureMedia.update({ where: { lectureId: params.id }, data: { archivedAt: new Date(), updatedById: userId } }),
      ]);
    } else {
      await prisma.recordedLectureMedia.update({ where: { lectureId: params.id }, data: { archivedAt: null, updatedById: userId } });
    }

    await prisma.auditLog
      .create({ data: { userId, action: `RECORDED_LECTURE_${action.toUpperCase()}`, entityType: "Lecture", entityId: params.id } })
      .catch(() => null);
    const full = await loadRecordedLecture(params.id);
    return apiSuccess({ lecture: full ? serializeStaffLecture(full) : null });
  } catch (error) {
    return recordedApiError(error);
  }
}
