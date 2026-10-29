import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { UnauthorizedError } from "@/lib/rbac/guard";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rate-limit";
import { studentRecordedAccess } from "@/lib/recorded-lectures/access";
import { generateVideoSummary, SummaryUnavailableError } from "@/lib/recorded-lectures/summary";
import { generateLectureNotes } from "@/lib/recorded-lectures/notes";
import { jobIsDue, LectureAiError, runNow, startLectureAi } from "@/lib/recorded-lectures/ai/pipeline";
import { lectureSourceText, notesSourceText, type BoardNote, type DictatedNote, type Segment } from "@/lib/recorded-lectures/ai/format";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Part = { content: string; reviewed: boolean } | null;

/**
 * "Get summary" for a student — made from the lecture itself (what the
 * teacher said, wrote on the board and dictated), never from the About.
 *
 *  - The teacher's published summary / notes when there are.
 *  - Else, once the AI has read the video: an AI summary + class notes,
 *    made once and kept as DRAFTs for the teacher to review and publish (the
 *    next student gets the same ones, no new AI call). Shown as not yet checked.
 *  - Not read yet: the first request starts the AI pass (about 10–20 minutes
 *    for an hour); the page asks again and shows the progress meanwhile.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    const student = await prisma.student.findUnique({ where: { userId: session.user.id }, select: { id: true } });
    if (!student) return apiError("Student profile not found.", 404);
    const access = await studentRecordedAccess(student.id, params.id);
    if (!access.ok) return apiError("This lecture is not available to you.", access.reason === "NOT_FOUND" ? 404 : 403);
    if (access.premiere?.state === "UPCOMING") return apiError("The summary opens when the lecture starts.", 403, { code: "NOT_YET" });

    const lecture = await prisma.lecture.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        title: true,
        language: true,
        chapter: { select: { title: true, subject: { select: { title: true } } } },
        about: { select: { content: true, revision: true } },
        aiJob: { select: { status: true, segments: true, board: true, dictated: true, windowsDone: true, windowsTotal: true, stepNote: true, lockedUntil: true, retryAt: true, finishedAt: true, updatedAt: true } },
        summaries: {
          where: { OR: [{ status: "PUBLISHED" }, { source: "VIDEO", status: { in: ["DRAFT", "APPROVED"] } }] },
          select: { kind: true, status: true, content: true, language: true },
          orderBy: { revision: "desc" },
        },
      },
    });
    if (!lecture) return apiError("Lecture not found.", 404);

    // Published first (the lecture's language first), else the newest video draft.
    const pick = (kind: "SUMMARY" | "NOTES"): Part => {
      const list = lecture.summaries.filter((s) => s.kind === kind);
      const pub = list.filter((s) => s.status === "PUBLISHED");
      const p = pub.find((s) => s.language === lecture.language) ?? pub[0];
      if (p) return { content: p.content, reviewed: true };
      const d = list.find((s) => s.status !== "PUBLISHED");
      return d ? { content: d.content, reviewed: false } : null;
    };
    let summary = pick("SUMMARY");
    let notes = pick("NOTES");
    if (summary && notes) return apiSuccess({ state: "READY", summary, notes });

    const job = lecture.aiJob;
    // A failed pass is restarted from a student's request at most once per 6 hours (each pass reads the whole video).
    const failedAt = job?.finishedAt ?? job?.updatedAt;
    if (job?.status === "FAILED" && failedAt && Date.now() - failedAt.getTime() < 6 * 3600_000) {
      return apiError("The summary for this lecture could not be made right now. Please try again later.", 503, { code: "AI_FAILED" });
    }
    if (!job || job.status === "FAILED") {
      const rate = await checkRateLimit(request, "AUTH", `student-summary:${session.user.id}`);
      if (!rate.success) return rateLimitExceededResponse(rate);
      // Nothing read yet (or the last try failed): the AI starts reading the video now.
      await startLectureAi(lecture.id, session.user.id);
      return apiSuccess({ state: "PROCESSING", progress: { done: 0, total: 0, note: "Starting" }, summary, notes });
    }
    if (job.status !== "READY") {
      if (jobIsDue(job)) runNow(lecture.id);
      return apiSuccess({ state: "PROCESSING", progress: { done: job.windowsDone, total: job.windowsTotal, note: job.stepNote }, summary, notes });
    }

    const rate = await checkRateLimit(request, "AUTH", `student-summary:${session.user.id}`);
    if (!rate.success) return rateLimitExceededResponse(rate);
    const base = { title: lecture.title, subject: lecture.chapter.subject.title, chapter: lecture.chapter.title, language: lecture.language };
    const board = job.board as BoardNote[];
    const dictated = job.dictated as DictatedNote[];
    const [madeSummary, madeNotes] = await Promise.all([
      summary
        ? null
        : generateVideoSummary({ ...base, source: lectureSourceText(job.segments as Segment[], board, dictated), about: lecture.about?.content ?? null }),
      notes || (!board.length && !dictated.length) ? null : generateLectureNotes({ ...base, source: notesSourceText(board, dictated) }).catch(() => null),
    ]);
    if (madeSummary) {
      await saveDraft(lecture.id, "SUMMARY", madeSummary, lecture.language, lecture.about?.revision ?? 0, session.user.id);
      summary = { content: madeSummary.markdown, reviewed: false };
    }
    if (madeNotes) {
      await saveDraft(lecture.id, "NOTES", madeNotes, lecture.language, lecture.about?.revision ?? 0, session.user.id);
      notes = { content: madeNotes.markdown, reviewed: false };
    }
    return apiSuccess({ state: "READY", summary, notes });
  } catch (error) {
    if (error instanceof LectureAiError) return apiError(error.message, 422, { code: "AI_UNAVAILABLE" });
    if (error instanceof SummaryUnavailableError) {
      return apiError(error.code === "INSUFFICIENT" ? "This lecture has too little speech to summarise." : error.message, error.code === "INSUFFICIENT" ? 422 : 503, { code: error.code });
    }
    return handleApiError(error);
  }
}

/** A DRAFT the teacher reviews; the revision number is taken under a retry (two students at once). */
async function saveDraft(lectureId: string, kind: "SUMMARY" | "NOTES", made: { markdown: string; provider: string; model: string }, language: string, aboutRevision: number, userId: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    // Another student's request made it meanwhile: keep that one.
    const exists = await prisma.lectureSummary.findFirst({ where: { lectureId, kind, source: "VIDEO", status: { in: ["DRAFT", "APPROVED", "PUBLISHED"] } }, select: { id: true } });
    if (exists) return;
    const last = await prisma.lectureSummary.aggregate({ where: { lectureId }, _max: { revision: true } });
    try {
      await prisma.lectureSummary.create({
        data: {
          lectureId,
          revision: (last._max.revision ?? 0) + 1,
          aboutRevision,
          kind,
          source: "VIDEO",
          content: made.markdown,
          language,
          status: "DRAFT",
          aiProvider: made.provider,
          aiModel: made.model,
          generatedAt: new Date(),
          generatedById: userId,
        },
      });
      return;
    } catch (err) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") || attempt === 2) throw err;
    }
  }
}
