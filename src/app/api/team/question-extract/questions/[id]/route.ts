import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_UPDATE);

    const existing = await prisma.extractedQuestion.findUnique({
      where: { id: params.id },
    });
    if (!existing) return apiError("Extracted question not found.", 404);

    const body = await request.json();
    const {
      statement,
      statementHi,
      options,
      correctAnswer,
      solution,
      solutionHi,
      subject,
      chapter,
      topic,
      subTopic,
      questionType,
      difficulty,
      status = "VERIFIED",
      reviewReasons = [],
    } = body;

    const updated = await prisma.extractedQuestion.update({
      where: { id: params.id },
      data: {
        statement: statement !== undefined ? statement : existing.statement,
        statementHi: statementHi !== undefined ? statementHi : existing.statementHi,
        options: options !== undefined ? options : existing.options,
        correctAnswer: correctAnswer !== undefined ? correctAnswer : existing.correctAnswer,
        solution: solution !== undefined ? solution : existing.solution,
        solutionHi: solutionHi !== undefined ? solutionHi : existing.solutionHi,
        subject: subject !== undefined ? subject : existing.subject,
        chapter: chapter !== undefined ? chapter : existing.chapter,
        topic: topic !== undefined ? topic : existing.topic,
        subTopic: subTopic !== undefined ? subTopic : existing.subTopic,
        questionType: questionType !== undefined ? questionType : existing.questionType,
        difficulty: difficulty !== undefined ? difficulty : existing.difficulty,
        status,
        reviewReasons,
        isEdited: true,
      },
    });

    // Recompute Job tally
    const [verifiedCount, reviewCount, errorCount] = await Promise.all([
      prisma.extractedQuestion.count({ where: { jobId: existing.jobId, status: "VERIFIED" } }),
      prisma.extractedQuestion.count({ where: { jobId: existing.jobId, status: "REVIEW_REQUIRED" } }),
      prisma.extractedQuestion.count({ where: { jobId: existing.jobId, status: "EXTRACTION_ERROR" } }),
    ]);

    await prisma.extractionJob.update({
      where: { id: existing.jobId },
      data: {
        verifiedCount,
        reviewCount,
        errorCount,
        status: errorCount > 0 ? "FAILED" : reviewCount > 0 ? "REVIEW_REQUIRED" : "VERIFIED",
      },
    });

    return apiSuccess({ question: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
