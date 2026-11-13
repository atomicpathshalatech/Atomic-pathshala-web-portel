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
    const { field, value, language = "ENGLISH", action } = body;

    const question = await prisma.question.findUnique({
      where: { id: params.id },
      include: { translations: true },
    });

    if (!question) {
      return apiError("Question not found", 404);
    }

    const now = new Date();

    // 1. Snapshot previous state into QuestionVersion before modifying
    try {
      await prisma.questionVersion.create({
        data: {
          questionId: question.id,
          versionNumber: question.version || 1,
          editedById: session.user.id,
          editedAt: now,
          reason: action === "ACCEPT_ALL" ? "Accepted all AI suggestions" : `Accepted AI suggestion for ${field}`,
          changeType: "AI_SUGGESTION_APPLIED",
          snapshot: {
            subject: question.subject,
            chapter: question.chapter,
            topic: question.topic,
            subTopic: question.subTopic,
            difficulty: question.difficulty,
            type: question.type,
            examLevel: question.examLevel,
            translations: question.translations,
          },
        },
      });
    } catch (verErr) {
      console.warn("[AcceptAI] Could not create version snapshot:", verErr);
    }

    // 2. Handle ACCEPT_ALL action
    if (action === "ACCEPT_ALL") {
      const auditResult: any = question.aiAuditResult;
      const suggestions: any[] = auditResult?.suggestions || [];

      const updateData: any = {
        editedById: session.user.id,
        editedAt: now,
        lastHumanEditedAt: now,
        lastHumanEditedById: session.user.id,
        version: { increment: 1 },
      };

      for (const sugg of suggestions) {
        if (sugg.field === "difficulty") updateData.difficulty = sugg.suggested;
        if (sugg.field === "examLevel") updateData.examLevel = sugg.suggested;
        if (sugg.field === "topic") updateData.topic = sugg.suggested;
        if (sugg.field === "subTopic") updateData.subTopic = sugg.suggested;
        if (sugg.field === "microConcept") updateData.microConcept = sugg.suggested;
        if (sugg.field === "type") updateData.type = sugg.suggested;

        if (sugg.field === "translation") {
          try {
            const draft = typeof sugg.suggested === "string" ? JSON.parse(sugg.suggested) : sugg.suggested;
            const targetLang = (draft.language || "HINDI").toUpperCase();
            const existingT = question.translations.find((t) => t.language.toUpperCase() === targetLang);

            if (existingT) {
              await prisma.questionTranslation.update({
                where: { id: existingT.id },
                data: {
                  statement: draft.statement || existingT.statement,
                  options: draft.options || existingT.options,
                  solution: draft.solution || existingT.solution,
                },
              });
            } else {
              await prisma.questionTranslation.create({
                data: {
                  questionId: question.id,
                  language: targetLang,
                  statement: draft.statement || "",
                  options: draft.options || {},
                  correctOptionIds: question.translations[0]?.correctOptionIds || ["A"],
                  solution: draft.solution || "",
                },
              });
            }
          } catch (tErr) {
            console.warn("[AcceptAI] Error applying draft translation:", tErr);
          }
        }
      }

      // Clear applied suggestions
      if (auditResult) {
        auditResult.suggestions = [];
        updateData.aiAuditResult = auditResult;
      }

      const updated = await prisma.question.update({
        where: { id: params.id },
        data: updateData,
        include: { translations: true },
      });

      return apiSuccess({
        question: updated,
        message: "Successfully accepted all AI suggestions",
      });
    }

    // 3. Handle Translation acceptance
    if (field === "translation") {
      try {
        const draft = typeof value === "string" ? JSON.parse(value) : value;
        const targetLang = (draft.language || language || "HINDI").toUpperCase();
        const existingT = question.translations.find((t) => t.language.toUpperCase() === targetLang);

        if (existingT) {
          await prisma.questionTranslation.update({
            where: { id: existingT.id },
            data: {
              statement: draft.statement || existingT.statement,
              options: draft.options || existingT.options,
              solution: draft.solution || existingT.solution,
            },
          });
        } else {
          await prisma.questionTranslation.create({
            data: {
              questionId: question.id,
              language: targetLang,
              statement: draft.statement || "",
              options: draft.options || {},
              correctOptionIds: question.translations[0]?.correctOptionIds || ["A"],
              solution: draft.solution || "",
            },
          });
        }

        // Remove translation suggestion from list
        const auditResult: any = question.aiAuditResult;
        if (auditResult && Array.isArray(auditResult.suggestions)) {
          auditResult.suggestions = auditResult.suggestions.filter((s: any) => s.field !== "translation");
          await prisma.question.update({
            where: { id: params.id },
            data: { aiAuditResult: auditResult },
          });
        }

        const updated = await prisma.question.findUnique({
          where: { id: params.id },
          include: { translations: true },
        });

        return apiSuccess({
          question: updated,
          message: `Successfully accepted and saved ${targetLang} translation`,
        });
      } catch (err: any) {
        return apiError(`Failed to apply translation: ${err.message}`, 400);
      }
    }

    const primaryT =
      question.translations.find((t) => t.language.toUpperCase() === language.toUpperCase()) ||
      question.translations[0];

    const updateData: any = {
      editedById: session.user.id,
      editedAt: now,
      lastHumanEditedAt: now,
      lastHumanEditedById: session.user.id,
      needsReaudit: true, // Content changed by reviewer -> needs re-audit eligibility
      version: { increment: 1 },
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
