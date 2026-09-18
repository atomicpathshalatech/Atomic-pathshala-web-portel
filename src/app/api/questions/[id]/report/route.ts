import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, handleApiError, apiError } from "@/lib/api/response";
import { UnauthorizedError } from "@/lib/rbac/guard";
import { questionReportCreateSchema } from "@/lib/validation/question-report";

/**
 * Student "Report Question" flow — files a QuestionReport against a
 * specific question, optionally scoped to the test/DPP attempt it was
 * seen in. Ownership-scoped like /api/doubts and /api/bookmarks, not
 * RBAC-gated: any signed-in user can flag a question they were shown.
 *
 * Team-side triage (list/claim/resolve) lives under
 * /api/team/questions/reports — see that route's comment for the scope
 * note on notification fanout.
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const { testId, reasonTags, comment, screenshotUrl, questionMeta } =
      questionReportCreateSchema.parse(await request.json());

    const rawId = decodeURIComponent(params.id);

    // 1. Locate existing canonical Question by id or questionCode
    let question = await prisma.question.findFirst({
      where: {
        OR: [{ id: rawId }, { questionCode: rawId }],
      },
    });

    // 2. If not found in Question model and questionMeta is supplied, create canonical Question once
    if (!question && questionMeta?.statement) {
      const subject = questionMeta.subject || "General";
      const language = questionMeta.language?.toLowerCase() || "english";
      const optionsArray = Array.isArray(questionMeta.options)
        ? questionMeta.options
        : typeof questionMeta.options === "object" && questionMeta.options !== null
          ? Object.entries(questionMeta.options).map(([k, v]) => ({ id: k, text: String(v) }))
          : [];

      question = await prisma.question.create({
        data: {
          id: rawId.startsWith("c") || rawId.length > 20 ? rawId : undefined,
          questionCode: rawId,
          subject,
          chapter: questionMeta.chapter || null,
          topic: questionMeta.topic || null,
          category: questionMeta.source || "AI_GENERATED",
          solution: questionMeta.solution || null,
          status: "DRAFT",
          translations: {
            create: {
              language,
              statement: questionMeta.statement,
              options: optionsArray,
              correctOptionIds: questionMeta.correctAnswer ? [questionMeta.correctAnswer] : [],
              solution: questionMeta.solution || null,
            },
          },
        },
      });
    }

    if (!question) {
      return apiError("Question not found", 404);
    }

    // 3. Duplicate Report Protection: check if this student has already reported this exact question
    const existingReport = await prisma.questionReport.findFirst({
      where: {
        questionId: question.id,
        reportedById: session.user.id,
      },
    });

    if (existingReport) {
      return apiSuccess({
        alreadyReported: true,
        report: existingReport,
        message: "You've already reported this question. Thank you — it has been sent for faculty review.",
      });
    }

    // 4. Create single report attached to the canonical question
    const report = await prisma.questionReport.create({
      data: {
        questionId: question.id,
        testId: testId || null,
        reasonTags: reasonTags.join(","),
        comment: comment || null,
        screenshotUrl: screenshotUrl || null,
        reportedById: session.user.id,
        status: "NEW",
      },
    });

    return apiSuccess({ report, alreadyReported: false }, 201);
  } catch (error) {
    return handleApiError(error);
  }
}

/** A student's own reports on this question (e.g. to show "already reported"). */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const reports = await prisma.questionReport.findMany({
      where: { questionId: params.id, reportedById: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    return apiSuccess({ reports });
  } catch (error) {
    return handleApiError(error);
  }
}
