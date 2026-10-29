import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/api/response";
import { ForbiddenError } from "@/lib/rbac/guard";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rate-limit";
import { canApproveSummary, canEditLectureContent } from "@/lib/recorded-lectures/access";
import { summaryActionSchema } from "@/lib/recorded-lectures/schemas";
import { generateLectureSummary } from "@/lib/recorded-lectures/summary";
import { recordedApiError, requireUserId } from "@/lib/recorded-lectures/api";
import { loadRecordedLecture, serializeStaffLecture, RecordedLectureError } from "@/lib/recorded-lectures/service";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Lecture summary workflow, all from the teacher's About (no file needed):
 *
 *   generate  → new DRAFT revision from the current About (AI)
 *   save      → teacher's edits to a draft (an approved one goes back to draft)
 *   approve   → APPROVED (teacher of the lecture or an admin)
 *   publish   → students see it; the previously published one is SUPERSEDED
 *   unpublish → back to APPROVED; students see no summary
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
      },
    });
    if (!lecture) return apiError("Lecture not found.", 404);
    const body = summaryActionSchema.parse(await request.json());
    const allowed = body.action === "approve" || body.action === "publish" || body.action === "unpublish"
      ? await canApproveSummary(userId, lecture)
      : await canEditLectureContent(userId, lecture);
    if (!allowed) throw new ForbiddenError("Only this lecture's teacher or an admin can work on its summary.");

    if (body.action === "generate") {
      const rate = await checkRateLimit(request, "AUTH", `summary-gen:${userId}`);
      if (!rate.success) return rateLimitExceededResponse(rate);
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
      for (let attempt = 0; attempt < 3; attempt++) {
        const last = await prisma.lectureSummary.aggregate({ where: { lectureId: lecture.id }, _max: { revision: true } });
        try {
          await prisma.lectureSummary.create({
            data: {
              lectureId: lecture.id,
              revision: (last._max.revision ?? 0) + 1,
              aboutRevision,
              content: generated.markdown,
              language: lecture.language,
              status: "DRAFT",
              outdated: nowRevision !== aboutRevision,
              aiProvider: generated.provider,
              aiModel: generated.model,
              generatedAt: new Date(),
              generatedById: userId,
            },
          });
          break;
        } catch (err) {
          // Two generations at once took the same revision number: take the next.
          if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") || attempt === 2) throw err;
        }
      }
    } else {
      const summary = await prisma.lectureSummary.findFirst({ where: { id: body.summaryId, lectureId: lecture.id } });
      if (!summary) return apiError("Summary not found.", 404);
      if (summary.status === "SUPERSEDED") return apiError("This is an older version. Work on the latest one.", 409);

      if (body.action === "save") {
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
        await prisma.$transaction([
          prisma.lectureSummary.updateMany({
            where: { lectureId: lecture.id, status: "PUBLISHED", id: { not: summary.id } },
            data: { status: "SUPERSEDED" },
          }),
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

    const full = await loadRecordedLecture(lecture.id);
    if (full) return apiSuccess({ lecture: serializeStaffLecture(full) });
    const summaries = await prisma.lectureSummary.findMany({ where: { lectureId: lecture.id }, orderBy: { revision: "desc" }, take: 10 });
    return apiSuccess({ summaries });
  } catch (error) {
    return recordedApiError(error);
  }
}
