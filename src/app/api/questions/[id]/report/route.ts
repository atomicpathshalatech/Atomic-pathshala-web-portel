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

    const question = await prisma.question.findUnique({ where: { id: params.id } });
    if (!question) return apiError("Question not found", 404);

    const { testId, reasonTags, comment, screenshotUrl } = questionReportCreateSchema.parse(
      await request.json()
    );

    const report = await prisma.questionReport.create({
      data: {
        questionId: question.id,
        testId: testId || null,
        reasonTags: reasonTags.join(","),
        comment: comment || null,
        screenshotUrl: screenshotUrl || null,
        reportedById: session.user.id,
      },
    });

    return apiSuccess({ report }, 201);
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
