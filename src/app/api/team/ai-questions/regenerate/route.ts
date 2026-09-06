import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { defaultAiProvider } from "@/lib/ai-question-engine/gemini-provider";
import { runQuestionValidationPipeline } from "@/lib/ai-question-engine/validator-pipeline";
import { GenerationLanguage, NeetDifficulty } from "@/lib/ai-question-engine/types";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_CREATE);

    const body = await request.json();
    const { questionId, mode = "same_concept" } = body;
    // mode: "same_concept" | "same_difficulty" | "same_type" | "different_concept" | "from_image"

    if (!questionId) return apiError("questionId is required.", 400);

    const existing = await prisma.aiGeneratedQuestion.findUnique({
      where: { id: questionId },
      include: { batch: true },
    });

    if (!existing) return apiError("Question not found.", 404);

    let difficulty: NeetDifficulty = existing.difficulty as NeetDifficulty;
    let questionType = existing.questionType;
    let topic = existing.topic;

    if (mode === "different_concept") {
      const batchTopics = Array.isArray(existing.batch.topics) ? (existing.batch.topics as string[]) : [];
      const alternativeTopics = batchTopics.filter((t) => t.toLowerCase() !== topic.toLowerCase());
      if (alternativeTopics.length > 0) {
        topic = alternativeTopics[Math.floor(Math.random() * alternativeTopics.length)]!;
      }
    }

    const rawList = await defaultAiProvider.generateQuestions({
      method: (existing.batch.method as "AI" | "PDF") || "AI",
      subject: existing.subject,
      chapter: existing.chapter,
      selectedTopics: [topic],
      selectedSubtopics: existing.subTopic ? [existing.subTopic] : undefined,
      difficultyMix: { [difficulty]: 1 } as any,
      questionTypeCounts: { [questionType]: 1 },
      language: (existing.language as GenerationLanguage) || "BOTH",
      sourceText: existing.sourceExcerpt || undefined,
    });

    if (rawList.length === 0) {
      return apiError("Regeneration returned no question.", 500);
    }

    const newQ = rawList[0]!;
    const { report, scores } = await runQuestionValidationPipeline({
      question: newQ,
      aiProvider: defaultAiProvider,
    });

    const updated = await prisma.aiGeneratedQuestion.update({
      where: { id: questionId },
      data: {
        statementEn: newQ.statementEn,
        statementHi: newQ.statementHi || null,
        optionsEn: newQ.optionsEn as any,
        optionsHi: (newQ.optionsHi as any) || null,
        correctAnswer: newQ.correctAnswer,
        solutionEn: newQ.solutionEn,
        solutionHi: newQ.solutionHi || null,
        topic: newQ.topic,
        subTopic: newQ.subTopic || null,
        difficulty: newQ.difficulty,
        questionType: newQ.questionType,
        validationStatus: report.validationStatus,
        validationReport: report as any,
        qualityScore: scores as any,
        editSource: "AI",
      },
    });

    return apiSuccess({ question: updated, report, scores });
  } catch (error) {
    return handleApiError(error);
  }
}
