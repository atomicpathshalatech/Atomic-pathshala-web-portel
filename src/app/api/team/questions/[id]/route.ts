import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { computeQuestionContentHash } from "@/lib/questions/content-hash";

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    await requirePermission(session?.user?.id, PERMISSIONS.QUESTION_READ);

    const question = await prisma.question.findUnique({
      where: { id: params.id },
      include: { translations: true, assets: true },
    });
    if (!question) return apiError("Question not found", 404);

    return apiSuccess({ question });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_UPDATE);

    const existing = await prisma.question.findUnique({
      where: { id: params.id },
      include: { translations: true },
    });
    if (!existing) return apiError("Question not found", 404);

    const body = await request.json();
    const lang = (body.language || "ENGLISH").toUpperCase();

    // Prepare Question level update
    const questionUpdateData: any = {
      editedById: session.user.id,
      editedAt: new Date(),
      lastHumanEditedAt: new Date(),
      lastHumanEditedById: session.user.id,
      needsReaudit: true, // Mark for AI re-audit on any human edit
    };

    if (body.subject) questionUpdateData.subject = body.subject;
    if (body.chapter) questionUpdateData.chapter = body.chapter;
    if (body.topic !== undefined) questionUpdateData.topic = body.topic;
    if (body.subTopic !== undefined) questionUpdateData.subTopic = body.subTopic;
    if (body.microConcept !== undefined) questionUpdateData.microConcept = body.microConcept;
    if (body.type) questionUpdateData.type = body.type;
    if (body.difficulty) questionUpdateData.difficulty = body.difficulty;
    if (body.examLevel) questionUpdateData.examLevel = body.examLevel;
    if (body.imageUrl !== undefined) questionUpdateData.imageUrl = body.imageUrl;

    // Translation level update
    if (body.statement || body.options || body.correctOptionIds || body.solution) {
      const translationPayload: any = {
        statement: body.statement || existing.translations[0]?.statement || "",
        options: body.options || existing.translations[0]?.options || {},
        correctOptionIds: Array.isArray(body.correctOptionIds)
          ? body.correctOptionIds
          : body.correctOptionIds
          ? [String(body.correctOptionIds)]
          : existing.translations[0]?.correctOptionIds || ["A"],
        solution: body.solution || existing.translations[0]?.solution || null,
      };

      questionUpdateData.translations = {
        upsert: {
          where: { questionId_language: { questionId: params.id, language: lang } },
          create: {
            language: lang,
            ...translationPayload,
          },
          update: translationPayload,
        },
      };
    }

    const updated = await prisma.question.update({
      where: { id: params.id },
      data: questionUpdateData,
      include: { translations: true },
    });

    // Recompute content hash
    const primaryT =
      updated.translations.find((t) => t.language.toUpperCase() === lang) || updated.translations[0];

    const newHash = computeQuestionContentHash({
      statement: primaryT?.statement,
      options: primaryT?.options,
      correctOptionIds: primaryT?.correctOptionIds,
      solution: primaryT?.solution,
      imageUrl: updated.imageUrl,
      type: updated.type,
      difficulty: updated.difficulty,
      examLevel: updated.examLevel,
      subject: updated.subject,
      chapter: updated.chapter,
      topic: updated.topic,
      subTopic: updated.subTopic,
      microConcept: updated.microConcept,
    });

    await prisma.question.update({
      where: { id: params.id },
      data: { aiAuditHash: newHash },
    });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "QUESTION_UPDATE",
        entityType: "Question",
        entityId: updated.id,
      },
    });

    return apiSuccess({ question: updated });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_DELETE);

    const existing = await prisma.question.findUnique({ where: { id: params.id } });
    if (!existing) return apiError("Question not found", 404);

    await prisma.question.delete({ where: { id: params.id } });

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "QUESTION_DELETE",
        entityType: "Question",
        entityId: params.id,
      },
    });

    return apiSuccess({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
