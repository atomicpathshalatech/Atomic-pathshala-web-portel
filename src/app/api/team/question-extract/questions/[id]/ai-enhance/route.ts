import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import {
  checkAndTranslateQuestion,
  generateSubjectAwareSolution,
} from "@/lib/questions/gemini-engine";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_UPDATE);

    const question = await prisma.extractedQuestion.findUnique({
      where: { id: params.id },
    });
    if (!question) return apiError("Extracted question not found.", 404);

    const body = await request.json();
    const action = (body.action || "ALL") as "TRANSLATE" | "SOLUTION" | "ALL";

    let statementHi = question.statementHi;
    let statement = question.statement;
    let options = (question.options as any) || { A: "", B: "", C: "", D: "" };
    let solution = question.solution;
    let solutionHi = question.solutionHi;
    let correctAnswer = question.correctAnswer;

    if (action === "TRANSLATE" || action === "ALL") {
      const translationResult = await checkAndTranslateQuestion({
        subject: question.subject,
        statementEn: question.statement,
        statementHi: question.statementHi || undefined,
        optionsEn: options,
        solutionEn: question.solution || undefined,
        solutionHi: question.solutionHi || undefined,
      });

      statement = translationResult.statementEn || statement;
      statementHi = translationResult.statementHi || statementHi;
      solution = translationResult.solutionEn || solution;
      solutionHi = translationResult.solutionHi || solutionHi;
    }

    if (action === "SOLUTION" || (action === "ALL" && !solution)) {
      const solutionResult = await generateSubjectAwareSolution({
        subject: question.subject,
        statementEn: statement,
        statementHi: statementHi || undefined,
        optionsEn: options,
        correctAnswer: question.correctAnswer,
      });

      solution = solutionResult.solutionEn || solution;
      solutionHi = solutionResult.solutionHi || solutionHi;
      if (solutionResult.recommendedAnswer && !correctAnswer) {
        correctAnswer = solutionResult.recommendedAnswer;
      }
    }

    const updated = await prisma.extractedQuestion.update({
      where: { id: params.id },
      data: {
        statement,
        statementHi,
        solution,
        solutionHi,
        correctAnswer,
        isEdited: true,
      },
    });

    return apiSuccess({
      question: updated,
      message: "AI enhancement complete (Bilingual Translation & 4-Step Solution updated)!",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
