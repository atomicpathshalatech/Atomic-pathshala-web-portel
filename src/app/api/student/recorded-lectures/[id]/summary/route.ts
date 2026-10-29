import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { UnauthorizedError } from "@/lib/rbac/guard";
import { checkRateLimit, rateLimitExceededResponse } from "@/lib/security/rate-limit";
import { studentRecordedAccess } from "@/lib/recorded-lectures/access";
import { generateLectureSummary, SummaryUnavailableError } from "@/lib/recorded-lectures/summary";
import { aboutWordCount, MIN_ABOUT_WORDS } from "@/lib/recorded-lectures/summary-format";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * "Get summary" for a student. The teacher's published summary when there
 * is one; otherwise an AI summary of the teacher's About, made once and kept
 * as a DRAFT the teacher can review, edit and publish (the next student gets
 * the same draft, not a new AI call). Shown to students as not yet checked.
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
        summaries: { where: { status: "PUBLISHED" }, select: { content: true }, orderBy: { revision: "desc" }, take: 1 },
      },
    });
    if (!lecture) return apiError("Lecture not found.", 404);
    if (lecture.summaries[0]) return apiSuccess({ content: lecture.summaries[0].content, reviewed: true });

    const about = lecture.about;
    // A draft already made from the current About: reuse it.
    if (about) {
      const draft = await prisma.lectureSummary.findFirst({
        where: { lectureId: lecture.id, status: { in: ["DRAFT", "APPROVED"] }, outdated: false, aboutRevision: about.revision },
        orderBy: { revision: "desc" },
        select: { content: true },
      });
      if (draft) return apiSuccess({ content: draft.content, reviewed: false });
    }
    if (!about || aboutWordCount(about.content) < MIN_ABOUT_WORDS) {
      return apiError("The teacher has not added enough notes for this lecture yet, so a summary cannot be made. Please check again later.", 422, { code: "NOT_READY" });
    }

    const rate = await checkRateLimit(request, "AUTH", `student-summary:${session.user.id}`);
    if (!rate.success) return rateLimitExceededResponse(rate);

    const generated = await generateLectureSummary({
      about: about.content,
      title: lecture.title,
      subject: lecture.chapter.subject.title,
      chapter: lecture.chapter.title,
      language: lecture.language,
    });
    for (let attempt = 0; attempt < 3; attempt++) {
      const last = await prisma.lectureSummary.aggregate({ where: { lectureId: lecture.id }, _max: { revision: true } });
      try {
        await prisma.lectureSummary.create({
          data: {
            lectureId: lecture.id,
            revision: (last._max.revision ?? 0) + 1,
            aboutRevision: about.revision,
            content: generated.markdown,
            language: lecture.language,
            status: "DRAFT",
            aiProvider: generated.provider,
            aiModel: generated.model,
            generatedAt: new Date(),
            generatedById: session.user.id,
          },
        });
        break;
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") || attempt === 2) throw err;
      }
    }
    return apiSuccess({ content: generated.markdown, reviewed: false });
  } catch (error) {
    if (error instanceof SummaryUnavailableError) {
      return apiError(error.code === "INSUFFICIENT" ? "The teacher's notes are too short for a summary yet. Please check again later." : error.message, error.code === "INSUFFICIENT" ? 422 : 503, { code: error.code });
    }
    return handleApiError(error);
  }
}
