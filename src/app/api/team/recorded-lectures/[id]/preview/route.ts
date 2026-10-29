import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/api/response";
import { ForbiddenError } from "@/lib/rbac/guard";
import { canEditLectureContent, canManageRecordedLectures } from "@/lib/recorded-lectures/access";
import { signedPlaybackUrl, signedThumbnailUrl } from "@/lib/recorded-lectures/storage";
import { recordedApiError, requireUserId } from "@/lib/recorded-lectures/api";

export const dynamic = "force-dynamic";

const URL_TTL_SECONDS = 600;

/** Staff preview of the uploaded video (draft or published): a short-lived signed URL. */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    const lecture = await prisma.lecture.findUnique({
      where: { id: params.id },
      select: { teacherId: true, recordedMedia: { select: { uploadStatus: true, objectKey: true, mimeType: true, thumbnailKey: true } } },
    });
    if (!lecture?.recordedMedia) return apiError("Recorded lecture not found.", 404);
    if (!(await canManageRecordedLectures(userId)) && !(await canEditLectureContent(userId, lecture))) throw new ForbiddenError();
    const media = lecture.recordedMedia;
    if (media.uploadStatus !== "READY") return apiError("The video has not finished uploading.", 409, { code: "VIDEO_NOT_READY" });
    return apiSuccess({
      url: await signedPlaybackUrl(media.objectKey, URL_TTL_SECONDS),
      thumbnailUrl: media.thumbnailKey ? await signedThumbnailUrl(media.thumbnailKey) : null,
      mimeType: media.mimeType,
      expiresInSeconds: URL_TTL_SECONDS,
    });
  } catch (error) {
    return recordedApiError(error);
  }
}
