import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/api/response";
import { ForbiddenError } from "@/lib/rbac/guard";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rate-limit";
import { canApproveSummary, canEditLectureContent } from "@/lib/recorded-lectures/access";
import { summaryActionSchema } from "@/lib/recorded-lectures/schemas";
import { generateLectureSummary, generateVideoSummary, translateLectureSummary } from "@/lib/recorded-lectures/summary";
import { sameSummaryLanguage, summaryLanguageFor } from "@/lib/recorded-lectures/summary-format";
import { generateLectureNotes } from "@/lib/recorded-lectures/notes";
import { lectureSourceText, notesSourceText, type BoardNote, type DictatedNote, type Segment } from "@/lib/recorded-lectures/ai/format";
import { recordedApiError, requireUserId } from "@/lib/recorded-lectures/api";
import { loadRecordedLecture, serializeStaffLecture, RecordedLectureError } from "@/lib/recorded-lectures/service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Lecture summary workflow:
 *
 *   generate       → new DRAFT revision from the current About (AI)
 *   generate-video → new DRAFT from the lecture itself: what the teacher said,
 *                    wrote on the board and dictated (needs the AI pass)
 *   generate-notes → class NOTES (kind NOTES): only the board writing and the
 *                    dictation, shown to students as a handwritten copy
 *   translate      → new DRAFT in Hindi / English (NCERT terms) of a version
 *   save           → teacher's edits to a draft (an approved one goes back to draft)
 *   approve        → APPROVED (teacher of the lecture or an admin)
 *   publish        → students see it; the previously published one of the
 *                    same kind in the SAME language is SUPERSEDED
 *   unpublish      → back to APPROVED
 *
 * Nothing is published automatically. A summary made from an older About is
 * flagged outdated and cannot be published until it is regenerated.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await requireUserId();
    const lecture = await prisma.lecture.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        title: true,
        language: true,
        teacherId: true,
        chapter: { select: { title: true, subject: { select: { title: true } } } },
        about: { select: { content: true, revision: true } },
        aiJob: { select: { status: true, segments: true, board: true, dictated: true } },
      },
    });
    if (!lecture) return apiError("Lecture not found.", 404);
    const body = summaryActionSchema.parse(await request.json());
    const allowed = body.action === "approve" || body.action === "publish" || body.action === "unpublish"
      ? await canApproveSummary(userId, lecture)
      : await canEditLectureContent(userId, lecture);
    if (!allowed) throw new ForbiddenError("Only this lecture's teacher or an admin can work on its summary.");

    const createDraft = async (d: { kind?: string; content: string; language: string; source: string; aboutRevision: number; outdated: boolean; provider: string; model: string }) => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const last = await prisma.lectureSummary.aggregate({ where: { lectureId: lecture.id }, _max: { revision: true } });
        try {
          return await prisma.lectureSummary.create({
            data: {
              lectureId: lecture.id,
              revision: (last._max.revision ?? 0) + 1,
              aboutRevision: d.aboutRevision,
              content: d.content,
              language: d.language,
              source: d.source,
              kind: d.kind ?? "SUMMARY",
              status: "DRAFT",
              outdated: d.outdated,
              aiProvider: d.provider,
              aiModel: d.model,
              generatedAt: new Date(),
              generatedById: userId,
            },
          });
        } catch (err) {
          // Two generations at once took the same revision number: take the next.
          if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") || attempt === 2) throw err;
        }
      }
      throw new Error("unreachable");
    };

    if (body.action === "generate" || body.action === "generate-video" || body.action === "generate-notes" || body.action === "translate") {
      const rate = await checkRateLimit(request, "AUTH", `summary-gen:${userId}`);
      if (!rate.success) return rateLimitExceededResponse(rate);
    }

    if (body.action === "generate") {
      if (!lecture.about?.content.trim()) {
        return apiError("Write and save the About first — the summary is made only from it.", 422, { code: "NO_ABOUT" });
      }
      const aboutRevision = lecture.about.revision;
      const generated = await generateLectureSummary({
        about: lecture.about.content,
        title: lecture.title,
        subject: lecture.chapter.subject.title,
        chapter: lecture.chapter.title,
        language: lecture.language,
      });
      // The About may have been edited while the AI worked: then this draft is outdated from the start.
      const nowRevision = (await prisma.lectureAbout.findUnique({ where: { lectureId: lecture.id }, select: { revision: true } }))?.revision ?? aboutRevision;
      await createDraft({
        content: generated.markdown,
        language: lecture.language,
        source: "ABOUT",
        aboutRevision,
        outdated: nowRevision !== aboutRevision,
        provider: generated.provider,
        model: generated.model,
      });
    } else if (body.action === "generate-video" || body.action === "generate-notes") {
      const job = lecture.aiJob;
      if (!job || job.status !== "READY") {
        return apiError("Run “Process with AI” on the video first and wait until it is ready — this is made from what the teacher wrote and dictated.", 422, { code: "NO_TRANSCRIPT" });
      }
      if (body.action === "generate-notes") {
        const notes = await generateLectureNotes({
          source: notesSourceText(job.board as BoardNote[], job.dictated as DictatedNote[]),
          title: lecture.title,
          subject: lecture.chapter.subject.title,
          chapter: lecture.chapter.title,
          language: lecture.language,
        });
        await createDraft({
          kind: "NOTES",
          content: notes.markdown,
          language: lecture.language,
          source: "VIDEO",
          aboutRevision: lecture.about?.revision ?? 0,
          outdated: false,
          provider: notes.provider,
          model: notes.model,
        });
        return respond();
      }
      const generated = await generateVideoSummary({
        source: lectureSourceText(job.segments as Segment[], job.board as BoardNote[], job.dictated as DictatedNote[]),
        about: lecture.about?.content ?? null,
        title: lecture.title,
        subject: lecture.chapter.subject.title,
        chapter: lecture.chapter.title,
        language: lecture.language,
      });
      await createDraft({
        content: generated.markdown,
        language: lecture.language,
        source: "VIDEO",
        aboutRevision: lecture.about?.revision ?? 0,
        outdated: false,
        provider: generated.provider,
        model: generated.model,
      });
    } else {
      const summary = await prisma.lectureSummary.findFirst({ where: { id: body.summaryId, lectureId: lecture.id } });
      if (!summary) return apiError("Summary not found.", 404);
      if (summary.status === "SUPERSEDED") return apiError("This is an older version. Work on the latest one.", 409);

      if (body.action === "translate") {
        const language = summaryLanguageFor(body.to);
        if (sameSummaryLanguage(summary.language, language)) return apiError(`This summary is already in ${language}.`, 409);
        const translated = await translateLectureSummary({ markdown: summary.content, to: body.to, subject: lecture.chapter.subject.title });
        const fromVideo = summary.source === "VIDEO" || summary.source === "VIDEO_TRANSLATION";
        await createDraft({
          kind: summary.kind,
          content: translated.markdown,
          language,
          source: fromVideo ? "VIDEO_TRANSLATION" : "TRANSLATION",
          aboutRevision: summary.aboutRevision,
          outdated: summary.outdated,
          provider: translated.provider,
          model: translated.model,
        });
      } else if (body.action === "save") {
        if (summary.status === "PUBLISHED") {
          throw new RecordedLectureError("A published summary cannot be edited in place. Unpublish it first, edit, then approve and publish again.", 409);
        }
        await prisma.lectureSummary.update({
          where: { id: summary.id },
          data: { content: body.content, status: "DRAFT", editedById: userId, approvedById: null, approvedAt: null },
        });
      } else if (body.action === "approve") {
        if (summary.outdated) throw new RecordedLectureError("The About changed after this summary was made. Regenerate it, review, then approve.", 409, "OUTDATED");
        // Conditional: approving twice at once (or approving a just-edited version) is safe.
        const res = await prisma.lectureSummary.updateMany({
          where: { id: summary.id, status: "DRAFT", updatedAt: summary.updatedAt },
          data: { status: "APPROVED", approvedById: userId, approvedAt: new Date() },
        });
        if (res.count === 0) throw new RecordedLectureError("The summary changed while you were approving it. Reload and review it again.", 409, "CHANGED");
      } else if (body.action === "publish") {
        if (summary.status !== "APPROVED") throw new RecordedLectureError("Approve the summary before publishing it.", 409);
        if (summary.outdated) throw new RecordedLectureError("The About changed after this summary was made. Regenerate it first.", 409, "OUTDATED");
        // One published summary per language: the Hindi one does not hide the English one.
        const published = await prisma.lectureSummary.findMany({
          where: { lectureId: lecture.id, kind: summary.kind, status: "PUBLISHED", id: { not: summary.id } },
          select: { id: true, language: true },
        });
        const replaced = published.filter((p) => sameSummaryLanguage(p.language, summary.language)).map((p) => p.id);
        await prisma.$transaction([
          prisma.lectureSummary.updateMany({ where: { id: { in: replaced } }, data: { status: "SUPERSEDED" } }),
          prisma.lectureSummary.update({ where: { id: summary.id }, data: { status: "PUBLISHED", publishedAt: new Date() } }),
        ]);
      } else if (body.action === "unpublish") {
        if (summary.status !== "PUBLISHED") return apiError("This summary is not published.", 409);
        await prisma.lectureSummary.update({ where: { id: summary.id }, data: { status: "APPROVED", publishedAt: null } });
      }
      await prisma.auditLog
        .create({ data: { userId, action: `LECTURE_SUMMARY_${body.action.toUpperCase()}`, entityType: "LectureSummary", entityId: summary.id, metadata: { lectureId: lecture.id } } })
        .catch(() => null);
    }

    return respond();

    async function respond() {
      const full = await loadRecordedLecture(lecture!.id);
      if (full) return apiSuccess({ lecture: serializeStaffLecture(full) });
      const summaries = await prisma.lectureSummary.findMany({ where: { lectureId: lecture!.id }, orderBy: { revision: "desc" }, take: 10 });
      return apiSuccess({ summaries });
    }
  } catch (error) {
    return recordedApiError(error);
  }
}
