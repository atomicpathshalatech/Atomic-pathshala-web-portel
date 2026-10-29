import "server-only";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { apiError, handleApiError } from "@/lib/api/response";
import { UnauthorizedError } from "@/lib/rbac/guard";
import { RecordedStorageNotConfiguredError } from "./storage";
import { RecordedLectureError } from "./service";
import { SummaryUnavailableError } from "./summary";
import { prisma } from "@/lib/db";
import { canEditLectureContent, canManageRecordedLectures, studentRecordedAccess } from "./access";

export async function requireUserId(): Promise<string> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new UnauthorizedError();
  return session.user.id;
}

/** Recorded-lecture errors as clear API responses; everything else as usual. */
export function recordedApiError(error: unknown) {
  if (error instanceof RecordedStorageNotConfiguredError) {
    return apiError(
      "Recorded-lecture storage is not set up yet, so uploads are turned off. Ask the Super Admin to add the RECORDED_R2_* settings.",
      503,
      { code: "RECORDED_STORAGE_NOT_CONFIGURED", details: { problems: error.problems } }
    );
  }
  if (error instanceof RecordedLectureError) return apiError(error.message, error.status, error.code ? { code: error.code } : undefined);
  if (error instanceof SummaryUnavailableError) {
    const status = error.code === "AI_NOT_CONFIGURED" ? 503 : error.code === "INSUFFICIENT" ? 422 : error.code === "TIMEOUT" ? 504 : 502;
    return apiError(error.message, status, { code: error.code });
  }
  return handleApiError(error);
}

/**
 * Who may get a lecture's AI audio/subtitles: an enrolled student of a
 * published lecture (same check as the video), or staff who can preview it.
 */
export async function requireLectureViewer(lectureId: string): Promise<{ ok: true; userId: string } | { ok: false; status: number; message: string }> {
  const userId = await requireUserId();
  const student = await prisma.student.findUnique({ where: { userId }, select: { id: true } });
  if (student) {
    const access = await studentRecordedAccess(student.id, lectureId);
    if (access.ok) return { ok: true, userId };
  }
  const lecture = await prisma.lecture.findUnique({ where: { id: lectureId }, select: { teacherId: true } });
  if (!lecture) return { ok: false, status: 404, message: "Lecture not found." };
  if ((await canManageRecordedLectures(userId)) || (await canEditLectureContent(userId, lecture))) return { ok: true, userId };
  return { ok: false, status: 403, message: "This lecture is not available to you." };
}
