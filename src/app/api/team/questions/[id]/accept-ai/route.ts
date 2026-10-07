import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { computeQuestionContentHash } from "@/lib/questions/content-hash";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_UPDATE);

    const body = await req.json();
    const { field, value, language = "ENGLISH" } = body;

    const question = await prisma.question.findUnique({
      where: { id: params.id },
      include: { translations: true },
    });

    if (!question) {
      return apiError("Question not found", 404);
    }

    const primaryT =
      question.translations.find((t) => t.language.toUpperCase() === language.toUpperCase()) ||
      question.translations[0];

    const updateData: any = {
      editedById: session.user.id,
      editedAt: new Date(),
      lastHumanEditedAt: new Date(),
      lastHumanEditedById: session.user.id,
      needsReaudit: true, // Content changed by reviewer -> needs re-audit eligibility
    };

    if (field === "difficulty") {
      updateData.difficulty = value;
    } else if (field === "examLevel") {
      updateData.examLevel = value;
    } else if (field === "topic") {
      updateData.topic = value;
    } else if (field === "subTopic") {
      updateData.subTopic = value;
    } else if (field === "microConcept") {
      updateData.microConcept = value;
    } else if (field === "type") {
      updateData.type = value;
    }

    // If translation field was accepted
    if (primaryT && ["statement", "solution", "options", "correctAnswer"].includes(field)) {
      const translationUpdate: any = {};
      if (field === "statement") translationUpdate.statement = value;
      if (field === "solution") translationUpdate.solution = value;
      if (field === "options") translationUpdate.options = typeof value === "string" ? JSON.parse(value) : value;
      if (field === "correctAnswer") {
        translationUpdate.correctOptionIds = Array.isArray(value) ? value : [String(value)];
      }

      await prisma.questionTranslation.update({
        where: { id: primaryT.id },
        data: translationUpdate,
      });
    }

    const updatedQuestion = await prisma.question.update({
      where: { id: params.id },
      data: updateData,
      include: { translations: true },
    });

    // Recompute hash
    const currentT =
      updatedQuestion.translations.find((t) => t.language.toUpperCase() === language.toUpperCase()) ||
      updatedQuestion.translations[0];

    const newHash = computeQuestionContentHash({
      statement: currentT?.statement,
      options: currentT?.options,
      correctOptionIds: currentT?.correctOptionIds,
      solution: currentT?.solution,
      imageUrl: updatedQuestion.imageUrl,
      type: updatedQuestion.type,
      difficulty: updatedQuestion.difficulty,
      examLevel: updatedQuestion.examLevel,
      subject: updatedQuestion.subject,
      chapter: updatedQuestion.chapter,
      topic: updatedQuestion.topic,
      subTopic: updatedQuestion.subTopic,
      microConcept: updatedQuestion.microConcept,
    });

    await prisma.question.update({
      where: { id: params.id },
      data: { aiAuditHash: newHash },
    });

    return apiSuccess({
      question: updatedQuestion,
      message: `Successfully accepted AI suggestion for ${field}`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
