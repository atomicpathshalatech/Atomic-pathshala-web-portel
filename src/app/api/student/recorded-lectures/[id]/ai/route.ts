import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/api/response";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rate-limit";
import { recordedApiError, requireLectureViewer } from "@/lib/recorded-lectures/api";
import { signedObjectUrl } from "@/lib/recorded-lectures/storage";
import type { LangCode, Segment } from "@/lib/recorded-lectures/ai/format";

export const dynamic = "force-dynamic";

const URL_TTL_SECONDS = 3600;

type VoiceTrack = { chunks: { s: number; e: number; key: string; dur: number }[]; total: number };

/**
 * What the player can offer besides the original: AI voice tracks (only
 * complete ones, each clip a short-lived signed URL) and subtitle languages.
 * Same access check as the video.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const access = await requireLectureViewer(params.id);
    if (!access.ok) return apiError(access.message, access.status);
    const rate = await checkRateLimit(request, "PUBLIC", `recorded-ai:${access.userId}`);
    if (!rate.success) return rateLimitExceededResponse(rate);

    const job = await prisma.lectureAiJob.findUnique({
      where: { lectureId: params.id },
      select: { status: true, sourceLanguage: true, targetLanguages: true, segments: true, translations: true, voice: true },
    });
    const empty = apiSuccess({ audio: [], subtitles: [], expiresInSeconds: URL_TTL_SECONDS });
    if (!job || !["TRANSLATING", "VOICING", "READY"].includes(job.status)) return empty;

    const segments = job.segments as Segment[];
    const translations = job.translations as Partial<Record<LangCode, string[]>>;
    const voice = job.voice as Partial<Record<LangCode, VoiceTrack>>;
    const langs = job.targetLanguages as LangCode[];

    const audio = [];
    for (const lang of langs) {
      const track = voice[lang];
      if (!track || !track.total || track.chunks.length < track.total) continue;
      audio.push({
        lang,
        chunks: await Promise.all(track.chunks.map(async (c) => ({ s: c.s, e: c.e, dur: c.dur, url: await signedObjectUrl(c.key, URL_TTL_SECONDS) }))),
      });
    }
    const subtitles: string[] = segments.length ? ["orig"] : [];
    for (const lang of langs) if ((translations[lang]?.length ?? 0) >= segments.length && segments.length) subtitles.push(lang);

    const res = apiSuccess({ sourceLanguage: job.sourceLanguage, audio, subtitles, expiresInSeconds: URL_TTL_SECONDS });
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  } catch (error) {
    return recordedApiError(error);
  }
}
