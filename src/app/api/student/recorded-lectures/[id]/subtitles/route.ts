import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/api/response";
import { recordedApiError, requireLectureViewer } from "@/lib/recorded-lectures/api";
import { toVtt, type LangCode, type Segment } from "@/lib/recorded-lectures/ai/format";

export const dynamic = "force-dynamic";

/** WebVTT subtitles: ?lang=orig (as spoken), hi or en (translated). Same access check as the video. */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const access = await requireLectureViewer(params.id);
    if (!access.ok) return apiError(access.message, access.status);
    const lang = request.nextUrl.searchParams.get("lang") ?? "orig";
    if (!["orig", "hi", "en"].includes(lang)) return apiError("Unknown subtitle language.", 400);

    const job = await prisma.lectureAiJob.findUnique({ where: { lectureId: params.id }, select: { segments: true, translations: true } });
    const segments = (job?.segments ?? []) as Segment[];
    const texts = lang === "orig" ? undefined : ((job?.translations ?? {}) as Partial<Record<LangCode, string[]>>)[lang as LangCode];
    if (!segments.length || (lang !== "orig" && (texts?.length ?? 0) < segments.length)) return apiError("These subtitles are not ready.", 404);

    return new NextResponse(toVtt(segments, texts), {
      headers: { "Content-Type": "text/vtt; charset=utf-8", "Cache-Control": "private, max-age=300" },
    });
  } catch (error) {
    return recordedApiError(error);
  }
}
