import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, apiError } from "@/lib/api/response";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return apiError("Unauthorized", 401);

    const body = await request.json();
    const {
      questionId,
      statement,
      options,
      correctOptionIds,
      solution,
      difficulty,
      explanation,
      notes,
    } = body;

    if (!questionId) {
      return apiError("Question ID is required.", 400);
    }

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { translations: true },
    });

    if (!question) {
      return apiError("Question not found.", 404);
    }

    // Update the question's English/Primary translation or default translation
    const defaultTrans = question.translations[0];
    if (defaultTrans) {
      await prisma.questionTranslation.update({
        where: { id: defaultTrans.id },
        data: {
          statement: statement ?? defaultTrans.statement,
          options: options ?? defaultTrans.options,
          correctOptionIds: correctOptionIds ?? defaultTrans.correctOptionIds,
          solution: solution ?? explanation ?? defaultTrans.solution,
        },
      });
    }

    // Advance question status to SUBMITTED / ADMIN_REVIEW
    const updated = await prisma.question.update({
      where: { id: questionId },
      data: {
        difficulty: difficulty || question.difficulty,
        solution: solution || explanation || question.solution,
        correctionStatus: "SUBMITTED",
        correctionNotes: notes || question.correctionNotes,
        correctionSubmittedAt: new Date(),
        correctionSubmittedById: session.user.id,
        editedById: session.user.id,
        editedAt: new Date(),
        version: { increment: 1 },
      },
    });

    return apiSuccess({
      message: "Correction submitted successfully. It is now awaiting Admin review and sign-off.",
      questionId: updated.id,
      correctionStatus: updated.correctionStatus,
    });
  } catch (error) {
    console.error("[SubmitCorrectionAPI] Error:", error);
    return apiError(error instanceof Error ? error.message : "Failed to submit question correction.", 500);
  }
}
