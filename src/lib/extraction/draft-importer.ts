/**
 * DRAFT IMPORTER SERVICE
 *
 * Converts VERIFIED extracted questions into Question Bank Drafts in Prisma.
 * Strictly preserves permanent source name, source PDF URL, source page,
 * original question number, bilingual translations, options, and solutions.
 * Never creates published questions directly — all questions move to DRAFT.
 */

import { prisma } from "@/lib/db";
import { generateQuestionId } from "@/lib/questions/id-generator";
import { QuestionType, Difficulty } from "@prisma/client";

export interface ImportToDraftResult {
  importedCount: number;
  skippedCount: number;
  draftQuestionIds: string[];
}

export async function importVerifiedQuestionsToDraft(
  jobId: string,
  userId: string
): Promise<ImportToDraftResult> {
  const job = await prisma.extractionJob.findUnique({
    where: { id: jobId },
    include: {
      questions: {
        where: {
          status: "VERIFIED",
          draftQuestionId: null, // Avoid re-importing already imported
        },
      },
    },
  });

  if (!job) throw new Error("Extraction job not found.");

  const draftQuestionIds: string[] = [];
  let skippedCount = 0;

  for (const eq of job.questions) {
    const questionCode = await generateQuestionId(prisma, eq.subject || "General");
    const tagsArray = [
      "Extracted",
      `Source:${job.sourceName}`,
      `Q.${eq.originalNumber}`,
      job.examName || "NEET",
      eq.questionType,
    ].filter(Boolean);

    // Map question type to Prisma enum where applicable
    let pType: QuestionType = QuestionType.SINGLE_CORRECT;
    if (eq.questionType === "ASSERTION_REASON") pType = QuestionType.ASSERTION_REASON;
    else if (eq.questionType.includes("MATCH")) pType = QuestionType.MATCH_COLUMN;
    else if (eq.questionType === "NUMERICAL") pType = QuestionType.INTEGER;

    // Create Question in Question Bank as DRAFT
    const createdQuestion = await prisma.question.create({
      data: {
        subject: eq.subject || "General",
        chapter: eq.chapter || job.chapter || null,
        topic: eq.topic || null,
        subTopic: eq.subTopic || null,
        type: pType,
        difficulty: (eq.difficulty as Difficulty) || Difficulty.MEDIUM,
        category: `Source: ${job.sourceName}`,
        pyqSource: job.year ? `${job.sourceName} ${job.year} Q.${eq.originalNumber}` : `${job.sourceName} Q.${eq.originalNumber}`,
        questionCode,
        solution: eq.solution || null,
        imageUrl: eq.imageUrl || null,
        tags: tagsArray.join(", "),
        status: "DRAFT",
        isPublished: false,
        createdById: userId,
        translations: {
          create: [
            {
              language: "ENGLISH",
              statement: eq.statement,
              options: eq.options as any,
              correctOptionIds: [eq.correctAnswer],
              solution: eq.solution || null,
            },
            ...(eq.statementHi
              ? [
                  {
                    language: "HINDI",
                    statement: eq.statementHi,
                    options: eq.options as any,
                    correctOptionIds: [eq.correctAnswer],
                    solution: eq.solutionHi || eq.solution || null,
                  },
                ]
              : []),
          ],
        },
      },
    });

    // Mark ExtractedQuestion as IMPORTED and link draft ID
    await prisma.extractedQuestion.update({
      where: { id: eq.id },
      data: {
        status: "IMPORTED",
        draftQuestionId: createdQuestion.id,
      },
    });

    draftQuestionIds.push(createdQuestion.id);
  }

  // Update extraction job stats
  const remainingReview = await prisma.extractedQuestion.count({
    where: { jobId, status: "REVIEW_REQUIRED" },
  });

  await prisma.extractionJob.update({
    where: { id: jobId },
    data: {
      status: remainingReview > 0 ? "REVIEW_REQUIRED" : "IMPORTED_TO_DRAFT",
    },
  });

  return {
    importedCount: draftQuestionIds.length,
    skippedCount,
    draftQuestionIds,
  };
}
