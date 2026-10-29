import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/api/response";
import { ForbiddenError } from "@/lib/rbac/guard";
import { canEditLectureContent, canManageRecordedLectures } from "@/lib/recorded-lectures/access";
import { recordedApiError, requireUserId } from "@/lib/recorded-lectures/api";
import { LectureAiError, jobIsDue, startLectureAi, triggerRun } from "@/lib/recorded-lectures/ai/pipeline";

export const dynamic = "force-dynamic";

/** Progress of the lecture's AI pass (and a nudge when it has stalled). */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    const lecture = await prisma.lecture.findUnique({ where: { id: params.id }, select: { teacherId: true } });
    if (!lecture) return apiError("Lecture not found.", 404);
    if (!(await canManageRecordedLectures(userId)) && !(await canEditLectureContent(userId, lecture))) throw new ForbiddenError();

    const job = await prisma.lectureAiJob.findUnique({ where: { lectureId: params.id } });
    if (!job) return apiSuccess({ job: null });
    // The page is open and the job is due (lost hand-over / quota wait over): keep it moving.
    if (jobIsDue(job) && Date.now() - job.updatedAt.getTime() > 60_000) triggerRun(params.id);

    // Rough progress over the whole pass.
    const stagePct: Record<string, number> = { QUEUED: 0, TRANSFERRING: 5, AI_PREPARING: 25, TRANSCRIBING: 30, READY: 100, FAILED: 0 };
    let pct = stagePct[job.status] ?? 0;
    if (job.status === "TRANSFERRING") {
      const size = Number((await prisma.recordedLectureMedia.findUnique({ where: { lectureId: params.id }, select: { sizeBytes: true } }))?.sizeBytes ?? 0);
      pct = 5 + Math.round((Number(job.uploadedBytes) / Math.max(1, size)) * 20);
    } else if (job.status === "TRANSCRIBING" && job.windowsTotal) pct = 30 + Math.round((job.windowsDone / job.windowsTotal) * 70);

    return apiSuccess({
      job: {
        status: job.status,
        stepNote: job.stepNote,
        percent: Math.min(100, pct),
        error: job.error,
        retryAt: job.retryAt,
        sourceLanguage: job.sourceLanguage,
        windowsDone: job.windowsDone,
        windowsTotal: job.windowsTotal,
        segments: (job.segments as unknown[]).length,
        boardNotes: (job.board as unknown[]).length,
        dictatedNotes: (job.dictated as unknown[]).length,
        durationSec: job.durationSec,
        tokensIn: job.tokensIn,
        tokensOut: job.tokensOut,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
        transcriptReady: job.status === "READY",
      },
    });
  } catch (error) {
    return recordedApiError(error);
  }
}

/** Start or restart the AI pass (Admin / Super Admin). */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    if (!(await canManageRecordedLectures(userId))) throw new ForbiddenError("Only Admin / Super Admin can start the AI processing.");
    try {
      await startLectureAi(params.id, userId);
    } catch (err) {
      if (err instanceof LectureAiError) return apiError(err.message, 409);
      throw err;
    }
    await prisma.auditLog.create({ data: { userId, action: "LECTURE_AI_START", entityType: "Lecture", entityId: params.id } }).catch(() => null);
    return apiSuccess({ started: true });
  } catch (error) {
    return recordedApiError(error);
  }
}
