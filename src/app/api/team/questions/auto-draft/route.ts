import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { generateQuestionId } from "@/lib/questions/id-generator";
import { QuestionType, Difficulty } from "@prisma/client";

function mapQuestionType(typeStr?: string): QuestionType {
  if (!typeStr) return QuestionType.SINGLE_CORRECT;
  const upper = typeStr.toUpperCase();
  if (upper.includes("MULTI") && upper.includes("CORRECT")) return QuestionType.MULTIPLE_CORRECT;
  if (upper.includes("INTEGER")) return QuestionType.INTEGER;
  if (upper.includes("NUMERICAL")) return QuestionType.NUMERICAL;
  if (upper.includes("STATEMENT")) return QuestionType.STATEMENT_BASED;
  if (upper.includes("MATCH")) return QuestionType.MATCH_COLUMN;
  if (upper.includes("ASSERTION")) return QuestionType.ASSERTION_REASON;
  return QuestionType.SINGLE_CORRECT;
}

function mapDifficulty(diffStr?: string): Difficulty {
  if (!diffStr) return Difficulty.MEDIUM;
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
    const {
      existingQuestionId,
      statementEn = "",
      statementHi = "",
      optionsEn = {},
      optionsHi = {},
      correctAnswer = ["A"],
      solutionEn = "",
      solutionHi = "",
      subject = "Biology",
      chapter = "",
      topic = "",
      subTopic = "",
      difficulty = "MEDIUM",
      type = "SINGLE_CORRECT",
      figureUrl,
      referenceImageUrl,
      solutionImageUrl,
      source = "DIRECT_OCR",
      tags = "",
    } = body;

    const resolvedCorrect = Array.isArray(correctAnswer)
      ? correctAnswer.map((c: any) => String(c).toUpperCase())
      : [String(correctAnswer || "A").toUpperCase()];

    const optEn = optionsEn || {};
    const optHi = optionsHi || {};
    const refImg = figureUrl || referenceImageUrl || null;
    const solImg = solutionImageUrl || null;

    // 1. UPDATE EXISTING DRAFT IF ID PROVIDED
    if (existingQuestionId) {
      const existing = await prisma.question.findUnique({
        where: { id: existingQuestionId },
        include: { translations: true },
      });

      if (existing) {
        await prisma.questionTranslation.deleteMany({
          where: { questionId: existing.id },
        });

        const translationsToCreate: any[] = [];
        if (statementEn.trim() || Object.keys(optEn).length > 0) {
          translationsToCreate.push({
            language: "ENGLISH",
            statement: statementEn.trim(),
            options: optEn,
            correctOptionIds: resolvedCorrect,
            solution: solutionEn.trim() || null,
          });
        }
        if (statementHi.trim() || Object.keys(optHi).length > 0) {
          translationsToCreate.push({
            language: "HINDI",
            statement: statementHi.trim(),
            options: optHi,
            correctOptionIds: resolvedCorrect,
            solution: solutionHi.trim() || null,
          });
        }

        const updated = await prisma.question.update({
          where: { id: existing.id },
          data: {
            subject: subject.trim() || existing.subject,
            chapter: chapter.trim() || existing.chapter,
            topic: topic.trim() || existing.topic,
            subTopic: subTopic.trim() || existing.subTopic,
            type: mapQuestionType(type),
            difficulty: mapDifficulty(difficulty),
            imageUrl: refImg || existing.imageUrl,
            solution: solutionEn.trim() || solutionHi.trim() || existing.solution,
            status: "DRAFT",
            editedById: session.user.id,
            editedAt: new Date(),
            translations: {
              create: translationsToCreate,
            },
          },
        });

        if (solImg) {
          const existingSolAsset = await prisma.questionAsset.findFirst({
            where: { questionId: existing.id, type: "SOLUTION" },
          });
          if (existingSolAsset) {
            await prisma.questionAsset.update({
              where: { id: existingSolAsset.id },
              data: { publicUrl: solImg, sizeBytes: solImg.length },
            }).catch(() => null);
          } else {
            await prisma.questionAsset.create({
              data: {
                questionId: existing.id,
                type: "SOLUTION",
                storageKey: `sol-${existing.id}`,
                publicUrl: solImg,
                originalName: `solution-ref-${updated.questionCode}.png`,
                mimeType: "image/png",
                sizeBytes: solImg.length,
                createdById: session.user.id,
              },
            }).catch(() => null);
          }
        }

        return apiSuccess({
          questionId: updated.id,
          questionCode: updated.questionCode,
          isUpdated: true,
        });
      }
    }

    // 2. CREATE NEW AUTO-SAVED DRAFT
    const questionCode = await generateQuestionId(prisma as any, subject);
    const categoryName = `AI_DRAFT:${source.toUpperCase()}`;
    const autoTags = ["AI_AUTO_DRAFT", `SOURCE_${source.toUpperCase()}`, tags].filter(Boolean).join(", ");

    const translationsToCreate: any[] = [];
    if (statementEn.trim() || Object.keys(optEn).length > 0) {
      translationsToCreate.push({
        language: "ENGLISH",
        statement: statementEn.trim() || "Statement pending...",
        options: optEn,
        correctOptionIds: resolvedCorrect,
        solution: solutionEn.trim() || null,
      });
    }
    if (statementHi.trim() || Object.keys(optHi).length > 0) {
      translationsToCreate.push({
        language: "HINDI",
        statement: statementHi.trim() || "प्रश्न कथन...",
        options: optHi,
        correctOptionIds: resolvedCorrect,
        solution: solutionHi.trim() || null,
      });
    }
    if (translationsToCreate.length === 0) {
      translationsToCreate.push({
        language: "ENGLISH",
        statement: "Extracted question draft",
        options: { A: "", B: "", C: "", D: "" },
        correctOptionIds: resolvedCorrect,
        solution: null,
      });
    }

    const created = await prisma.question.create({
      data: {
        questionCode,
        subject: subject.trim() || "Biology",
        chapter: chapter.trim() || "General",
        topic: topic.trim() || "Core Concept",
        subTopic: subTopic.trim() || null,
        type: mapQuestionType(type),
        difficulty: mapDifficulty(difficulty),
        category: categoryName,
        status: "DRAFT",
        isPublished: false,
        imageUrl: refImg,
        solution: solutionEn.trim() || solutionHi.trim() || null,
        tags: autoTags,
        createdById: session.user.id,
        translations: {
          create: translationsToCreate,
        },
        versions: {
          create: {
            versionNumber: 1,
            editedById: session.user.id,
            changeType: "CREATE",
            snapshot: {
              source,
              statementEn,
              statementHi,
              optionsEn: optEn,
              optionsHi: optHi,
              correctAnswer: resolvedCorrect,
              solutionEn,
              solutionHi,
              subject,
              chapter,
              topic,
            },
          },
        },
      },
    });

    if (refImg) {
      await prisma.questionAsset.create({
        data: {
          questionId: created.id,
          type: "REFERENCE",
          storageKey: `ref-${created.id}`,
          publicUrl: refImg,
          originalName: `question-ref-${questionCode}.png`,
          mimeType: "image/png",
          sizeBytes: refImg.length,
          createdById: session.user.id,
        },
      }).catch(() => null);
    }

    if (solImg) {
      await prisma.questionAsset.create({
        data: {
          questionId: created.id,
          type: "SOLUTION",
          storageKey: `sol-${created.id}`,
          publicUrl: solImg,
          originalName: `solution-ref-${questionCode}.png`,
          mimeType: "image/png",
          sizeBytes: solImg.length,
          createdById: session.user.id,
        },
      }).catch(() => null);
    }

    return apiSuccess({
      questionId: created.id,
      questionCode: created.questionCode,
      isCreated: true,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
