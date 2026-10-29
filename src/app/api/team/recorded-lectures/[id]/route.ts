import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/api/response";
import { ForbiddenError } from "@/lib/rbac/guard";
import { canEditLectureContent, canManageRecordedLectures } from "@/lib/recorded-lectures/access";
import { loadRecordedLecture, serializeStaffLecture, updateRecordedMetadata } from "@/lib/recorded-lectures/service";
import { recordedLectureUpdateSchema } from "@/lib/recorded-lectures/schemas";
import { recordedApiError, requireUserId } from "@/lib/recorded-lectures/api";
import { recordedStorageStatus } from "@/lib/recorded-lectures/config";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    const lecture = await loadRecordedLecture(params.id);
    if (!lecture) return apiError("Recorded lecture not found.", 404);
    const manage = await canManageRecordedLectures(userId);
    if (!manage && !(await canEditLectureContent(userId, lecture))) throw new ForbiddenError("This lecture belongs to another teacher.");
    return apiSuccess({ lecture: serializeStaffLecture(lecture), canManage: manage, storage: manage ? recordedStorageStatus() : undefined });
  } catch (error) {
    return recordedApiError(error);
  }
}

/** Edit metadata (Admin / Super Admin). */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    if (!(await canManageRecordedLectures(userId))) throw new ForbiddenError();
    const input = recordedLectureUpdateSchema.parse(await request.json());
    await updateRecordedMetadata(params.id, input, userId);
    await prisma.auditLog
      .create({ data: { userId, action: "RECORDED_LECTURE_UPDATE", entityType: "Lecture", entityId: params.id, metadata: { fields: Object.keys(input) } } })
      .catch(() => null);
    const lecture = await loadRecordedLecture(params.id);
    return apiSuccess({ lecture: lecture ? serializeStaffLecture(lecture) : null });
  } catch (error) {
    return recordedApiError(error);
  }
}
