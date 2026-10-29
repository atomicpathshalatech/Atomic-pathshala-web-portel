import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api/response";
import { recordedApiError, requireLectureViewer } from "@/lib/recorded-lectures/api";
import { toVtt, type Segment } from "@/lib/recorded-lectures/ai/format";

export const dynamic = "force-dynamic";

/** WebVTT subtitles of what the teacher says. Same access check as the video. */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const access = await requireLectureViewer(params.id);
    if (!access.ok) return apiError(access.message, access.status);
    const job = await prisma.lectureAiJob.findUnique({ where: { lectureId: params.id }, select: { status: true, segments: true } });
    const segments = (job?.segments ?? []) as Segment[];
    if (job?.status !== "READY" || !segments.length) return apiError("Subtitles are not ready.", 404);
    return new NextResponse(toVtt(segments), {
      headers: { "Content-Type": "text/vtt; charset=utf-8", "Cache-Control": "private, max-age=300" },
    });
  } catch (error) {
    return recordedApiError(error);
  }
}
