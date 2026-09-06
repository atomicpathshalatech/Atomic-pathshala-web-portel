import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { QuestionType, Difficulty } from "@prisma/client";

function mapQuestionTypeToPrisma(typeStr: string): QuestionType {
  const upper = typeStr.toUpperCase();
  if (upper.includes("MULTI") && upper.includes("CORRECT")) return QuestionType.MULTIPLE_CORRECT;
  if (upper.includes("INTEGER")) return QuestionType.INTEGER;
  if (upper.includes("NUMERICAL")) return QuestionType.NUMERICAL;
  if (upper.includes("STATEMENT")) return QuestionType.STATEMENT_BASED;
  if (upper.includes("MATCH")) return QuestionType.MATCH_COLUMN;
  if (upper.includes("ASSERTION")) return QuestionType.ASSERTION_REASON;
  return QuestionType.SINGLE_CORRECT;
}

function mapDifficultyToPrisma(diffStr: string): Difficulty {
  const upper = diffStr.toUpperCase();
  if (upper === "EASY") return Difficulty.EASY;
  if (upper === "HARD" || upper === "ULTRA") return Difficulty.HARD;
  return Difficulty.MEDIUM;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_CREATE);

    const body = await request.json();
    const { questionIds, submitToReview = false } = body;

    const ids: string[] = Array.isArray(questionIds)
      ? questionIds
      : body.questionId
      ? [body.questionId]
      : [];

    if (ids.length === 0) {
      return apiError("At least one questionId is required.", 400);
    }

    const aiQuestions = await prisma.aiGeneratedQuestion.findMany({
      where: { id: { in: ids } },
      include: { batch: true },
    });

    if (aiQuestions.length === 0) {
      return apiError("No matching generated questions found.", 404);
    }

    const savedIds: string[] = [];
    const now = new Date();

    for (const aiQ of aiQuestions) {
      // Build translation records
      const translations: any[] = [];
      const optionsEn = (aiQ.optionsEn as Record<string, string>) || {};
      const optionsHi = (aiQ.optionsHi as Record<string, string>) || {};

      if (aiQ.statementEn?.trim()) {
        translations.push({
          language: "ENGLISH",
          statement: aiQ.statementEn.trim(),
          options: optionsEn,
          correctOptionIds: aiQ.correctAnswer,
          solution: aiQ.solutionEn || null,
        });
      }

      if (aiQ.statementHi?.trim()) {
        translations.push({
          language: "HINDI",
          statement: aiQ.statementHi.trim(),
          options: optionsHi,
          correctOptionIds: aiQ.correctAnswer,
          solution: aiQ.solutionHi || null,
        });
      }

      // Generation method for category filter
      const method = aiQ.batch.method === "PDF" ? "PDF" : "AI";
      const category = `AI_GENERATED:${method}`;
      const status = submitToReview ? "REVIEW_1" : "DRAFT";
      const review1Status = submitToReview ? "PENDING" : null;

      const tags = [
        "AI_GENERATED",
        `METHOD_${method}`,
        aiQ.batch.batchCode,
        aiQ.questionType,
        aiQ.difficulty,
      ].join(", ");

      // Create canonical Question row in Question Bank
      const createdQuestion = await prisma.question.create({
        data: {
          subject: aiQ.subject,
          chapter: aiQ.chapter,
          topic: aiQ.topic,
          subTopic: aiQ.subTopic || null,
          type: mapQuestionTypeToPrisma(aiQ.questionType),
          difficulty: mapDifficultyToPrisma(aiQ.difficulty),
          imageUrl: aiQ.imageUrl || null,
          category,
          pyqSource: aiQ.pyqStyle === "STANDARD" ? null : aiQ.pyqStyle,
          solution: aiQ.solutionEn || aiQ.solutionHi || null,
          tags,
          status,
          review1Status,
          isPublished: false, // Never auto-published
          createdById: session.user.id,
          translations: {
            create: translations,
          },
          versions: {
            create: {
              versionNumber: 1,
              editedById: session.user.id,
              changeType: "AI_GENERATED_IMPORT",
              snapshot: {
                aiQuestionId: aiQ.id,
                batchCode: aiQ.batch.batchCode,
                method,
                qualityScore: aiQ.qualityScore,
                validationReport: aiQ.validationReport,
              },
            },
          },
        },
      });

      // Update AI generated question pointer
      await prisma.aiGeneratedQuestion.update({
        where: { id: aiQ.id },
        data: {
          isSavedToDraft: true,
          draftQuestionId: createdQuestion.id,
          savedAt: now,
        },
      });

      savedIds.push(createdQuestion.id);
    }

    // Increment batch savedDraftCount
    if (aiQuestions[0]?.batchId) {
      await prisma.aiGenerationBatch.update({
        where: { id: aiQuestions[0].batchId },
        data: {
          savedDraftCount: { increment: savedIds.length },
        },
      });
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: submitToReview ? "AI_QUESTIONS_SUBMITTED_TO_REVIEW" : "AI_QUESTIONS_SAVED_TO_DRAFT",
        entityType: "Question",
        metadata: {
          count: savedIds.length,
          savedQuestionIds: savedIds,
          submitToReview,
        },
      },
    });

    return apiSuccess({
      savedCount: savedIds.length,
      questionIds: savedIds,
      status: submitToReview ? "REVIEW_1" : "DRAFT",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
