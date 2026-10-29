import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { UnauthorizedError } from "@/lib/rbac/guard";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rate-limit";
import { studentRecordedAccess } from "@/lib/recorded-lectures/access";
import { signedPlaybackUrl } from "@/lib/recorded-lectures/storage";
import { RecordedStorageNotConfiguredError } from "@/lib/recorded-lectures/storage";

export const dynamic = "force-dynamic";

const URL_TTL_SECONDS = 900;

/**
 * Playback authorisation for one recorded lecture: re-checks the student's
 * enrollment and the lecture's published state on EVERY request, then hands
 * out a 15-minute signed URL to the private object. The player asks again
 * when the URL is about to expire or fails — a dropped enrollment or an
 * unpublished lecture stops playback at that point.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    const rate = await checkRateLimit(request, "PUBLIC", `recorded-play:${session.user.id}`);
    if (!rate.success) return rateLimitExceededResponse(rate);

    const student = await prisma.student.findUnique({ where: { userId: session.user.id }, select: { id: true } });
    if (!student) return apiError("Student profile not found.", 404);

    const access = await studentRecordedAccess(student.id, params.id);
    if (!access.ok) {
      const message =
        access.reason === "NOT_ENROLLED"
          ? "This lecture is for students of another batch."
          : access.reason === "NOT_PUBLISHED"
            ? "This lecture is not available right now."
            : "Lecture not found.";
      return apiError(message, access.reason === "NOT_FOUND" ? 404 : 403, { code: access.reason });
    }

    const media = await prisma.recordedLectureMedia.findUnique({ where: { lectureId: params.id }, select: { objectKey: true, mimeType: true } });
    if (!media) return apiError("Lecture not found.", 404);
    const url = await signedPlaybackUrl(media.objectKey, URL_TTL_SECONDS);
    const res = apiSuccess({ url, mimeType: media.mimeType, expiresInSeconds: URL_TTL_SECONDS });
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  } catch (error) {
    if (error instanceof RecordedStorageNotConfiguredError) return apiError("Video storage is temporarily unavailable.", 503);
    return handleApiError(error);
  }
}
