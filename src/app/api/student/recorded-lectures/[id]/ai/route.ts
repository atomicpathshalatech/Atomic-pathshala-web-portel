import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/api/response";
import { recordedApiError, requireLectureViewer } from "@/lib/recorded-lectures/api";

export const dynamic = "force-dynamic";

/** What the player can offer from the lecture's AI pass: subtitles of what was said. Same access check as the video. */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const access = await requireLectureViewer(params.id);
    if (!access.ok) return apiError(access.message, access.status);
    const job = await prisma.lectureAiJob.findUnique({ where: { lectureId: params.id }, select: { status: true, segments: true } });
    const ready = job?.status === "READY" && (job.segments as unknown[]).length > 0;
    const res = apiSuccess({ subtitles: ready ? ["orig"] : [] });
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  } catch (error) {
    return recordedApiError(error);
  }
}
