import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { generateDppCode } from "@/lib/dpp/code";
import { LanguageMode } from "@prisma/client";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.DPP_CREATE);

    const chapter = await prisma.chapter.findUnique({
      where: { id: params.id },
      include: { subject: true },
    });
    if (!chapter) return apiError("Chapter not found", 404);

    const body = await request.json().catch(() => ({}));
    const questionCount = Math.max(5, Math.min(30, typeof body.count === "number" ? body.count : 10));
    const difficultyPreference = body.difficulty || "BALANCED"; // "EASY" | "MEDIUM" | "HARD" | "BALANCED"

    // 1. Fetch available questions for this chapter/subject from the question bank
    const availableQuestions = await prisma.question.findMany({
      where: {
        OR: [
          { chapter: { contains: chapter.title, mode: "insensitive" } },
          { subject: { contains: chapter.subject.title, mode: "insensitive" } },
        ],
        status: "ACTIVE",
      },
      select: {
        id: true,
        difficulty: true,
        type: true,
      },
      take: 100,
    });

    let selectedQuestionIds: string[] = [];

    if (availableQuestions.length > 0) {
      if (difficultyPreference === "BALANCED") {
        // Pick roughly 30% EASY, 50% MEDIUM, 20% HARD
        const easy = availableQuestions.filter((q) => q.difficulty === "EASY");
        const medium = availableQuestions.filter((q) => q.difficulty === "MEDIUM" || !q.difficulty);
        const hard = availableQuestions.filter((q) => q.difficulty === "HARD");

        const easyCount = Math.round(questionCount * 0.3);
        const hardCount = Math.round(questionCount * 0.2);
        const medCount = questionCount - easyCount - hardCount;

        const pickedEasy = easy.slice(0, easyCount).map((q) => q.id);
        const pickedMed = medium.slice(0, medCount).map((q) => q.id);
        const pickedHard = hard.slice(0, hardCount).map((q) => q.id);

        selectedQuestionIds = [...pickedEasy, ...pickedMed, ...pickedHard];

        // Fill remainder from any available question if category pools were small
        if (selectedQuestionIds.length < questionCount) {
          const remaining = availableQuestions
            .filter((q) => !selectedQuestionIds.includes(q.id))
            .slice(0, questionCount - selectedQuestionIds.length)
            .map((q) => q.id);
          selectedQuestionIds.push(...remaining);
        }
      } else {
        const filtered = availableQuestions.filter((q) => q.difficulty === difficultyPreference);
        selectedQuestionIds = (filtered.length >= questionCount ? filtered : availableQuestions)
          .slice(0, questionCount)
          .map((q) => q.id);
      }
    }

    const code = await generateDppCode(prisma);
    const existingDppCount = await prisma.dpp.count({ where: { chapterId: chapter.id } });
    const slot = existingDppCount + 1;
    const dppName = body.name?.trim() || `${chapter.title} - DPP ${slot}`;

    const dpp = await prisma.dpp.create({
      data: {
        code,
        name: dppName,
        subject: chapter.subject.title,
        chapter: chapter.title,
        chapterId: chapter.id,
        level: slot,
        difficulty: difficultyPreference === "BALANCED" ? "MEDIUM" : difficultyPreference,
        estimatedTimeMin: questionCount * 2, // 2 mins per question default
        correctMarks: 4,
        incorrectMarks: -1,
        topics: [chapter.title],
        languageMode: LanguageMode.BOTH,
        status: "ACTIVE",
        createdById: session.user.id,
      },
    });

    // 2. Link selected questions
    if (selectedQuestionIds.length > 0) {
      await prisma.dppQuestion.createMany({
        data: selectedQuestionIds.map((questionId, index) => ({
          dppId: dpp.id,
          questionId,
          order: index + 1,
        })),
        skipDuplicates: true,
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "DPP_AUTO_GENERATED",
        entityType: "Dpp",
        entityId: dpp.id,
        metadata: {
          chapterId: chapter.id,
          name: dpp.name,
          questionsCount: selectedQuestionIds.length,
        },
      },
    });

    return apiSuccess(
      {
        dpp,
        questionsAttached: selectedQuestionIds.length,
        message: `DPP created successfully with ${selectedQuestionIds.length} questions attached.`,
      },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
