import crypto from "crypto";
import { prisma } from "@/lib/db";
import { defaultAiProvider } from "./gemini-provider";
import { runQuestionValidationPipeline } from "./validator-pipeline";
import {
  GenerationLanguage,
  GenerationPlan,
  NeetDifficulty,
  RawAiGeneratedQuestion,
} from "./types";
import { PROMPT_VERSION } from "./prompt-templates";

export function generateBatchCode(): string {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randPart = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `GEN-${datePart}-${randPart}`;
}

export interface StartJobParams {
  method: "AI" | "PDF";
  subject: string;
  chapter: string;
  selectedTopics: string[];
  selectedSubtopics?: string[];
  difficulties: NeetDifficulty[];
  questionTypes: string[];
  language: GenerationLanguage;
  totalQuestions: number;
  generationPlan: GenerationPlan;
  sourcePdfId?: string;
  userId: string;
}

/**
 * Initiates an asynchronous AI Question Generation Job
 */
export async function startGenerationJob(params: StartJobParams): Promise<{
  batchId: string;
  batchCode: string;
}> {
  const batchCode = generateBatchCode();

  // Create batch record in PENDING status
  const batch = await prisma.aiGenerationBatch.create({
    data: {
      batchCode,
      method: params.method,
      subject: params.subject,
      chapter: params.chapter,
      topics: params.selectedTopics,
      subtopics: params.selectedSubtopics || [],
      difficulties: params.difficulties,
      questionTypes: params.questionTypes,
      language: params.language,
      totalRequested: params.totalQuestions,
      status: "PROCESSING",
      progress: 5,
      currentStep: "Initializing generation job...",
      generationPlan: params.generationPlan as any,
      sourcePdfId: params.sourcePdfId || null,
      modelProvider: "Gemini",
      modelName: "gemini-1.5-flash",
      promptVersion: PROMPT_VERSION,
      costEstimate: {
        totalQuestions: params.totalQuestions,
        estimatedAiCalls: Math.ceil(params.totalQuestions / 10) + params.totalQuestions,
      },
      createdById: params.userId,
    },
  });

  // Launch background execution asynchronously without blocking the API caller
  runGenerationJobWorker(batch.id, params).catch((err) => {
    console.error(`[JobRunner] Unhandled worker error for batch ${batch.id}:`, err);
  });

  return { batchId: batch.id, batchCode: batch.batchCode };
}

/**
 * Background worker executing question generation, multi-stage validation, and persistence
 */
async function runGenerationJobWorker(batchId: string, params: StartJobParams): Promise<void> {
  try {
    // 1. Prepare Source Context (if PDF mode)
    let sourceText = "";
    let sourceImages: Array<{ id: string; page: number; description: string }> = [];

    if (params.method === "PDF" && params.sourcePdfId) {
      await prisma.aiGenerationBatch.update({
        where: { id: batchId },
        data: { progress: 15, currentStep: "Reading extracted PDF chunks and diagrams..." },
      });

      const pdf = await prisma.aiSourcePdf.findUnique({
        where: { id: params.sourcePdfId },
        include: {
          chunks: { take: 30, orderBy: [{ pageNumber: "asc" }, { chunkIndex: "asc" }] },
          images: { take: 10, orderBy: { pageNumber: "asc" } },
        },
      });

      if (pdf) {
        sourceText = pdf.chunks.map((c) => `[Page ${c.pageNumber}] ${c.content}`).join("\n\n");
        sourceImages = pdf.images.map((img) => ({
          id: img.id,
          page: img.pageNumber,
          description: img.associatedText || `Figure on page ${img.pageNumber}`,
        }));
      }
    }

    // 2. Build Type and Difficulty Quotas
    const questionTypeCounts: Record<string, number> = {};
    for (const item of params.generationPlan.items) {
      if (item.count > 0) {
        questionTypeCounts[item.questionTypeId] = item.count;
      }
    }

    await prisma.aiGenerationBatch.update({
      where: { id: batchId },
      data: { progress: 30, currentStep: "Synthesizing NEET questions via AI Engine..." },
    });

    // 3. Call AI Provider for Generation
    const rawQuestions = await defaultAiProvider.generateQuestions({
      method: params.method,
      subject: params.subject,
      chapter: params.chapter,
      selectedTopics: params.selectedTopics,
      selectedSubtopics: params.selectedSubtopics,
      difficultyMix: params.generationPlan.difficultyMix,
      questionTypeCounts,
      language: params.language,
      sourceText: sourceText || undefined,
      sourceImageDescriptions: sourceImages.length > 0 ? sourceImages : undefined,
    });

    await prisma.aiGenerationBatch.update({
      where: { id: batchId },
      data: {
        progress: 55,
        generatedCount: rawQuestions.length,
        currentStep: "Running independent solver and adversarial verification...",
      },
    });

    // 4. Validate and Persist Each Question Independently (Partial Failure Recovery)
    let passedCount = 0;
    let needsReviewCount = 0;
    let failedCount = 0;
    const validatedQuestionsSoFar: RawAiGeneratedQuestion[] = [];

    const totalToValidate = rawQuestions.length;
    for (let i = 0; i < totalToValidate; i++) {
      const q = rawQuestions[i];
      if (!q) continue;
      const stepPercent = Math.round(55 + ((i + 1) / totalToValidate) * 40);

      // Validate single question
      const { report, scores } = await runQuestionValidationPipeline({
        question: q,
        aiProvider: defaultAiProvider,
        batchQuestionsSoFar: validatedQuestionsSoFar,
      });

      validatedQuestionsSoFar.push(q);

      if (report.validationStatus === "PASSED") {
        passedCount++;
      } else if (report.validationStatus === "NEEDS_REVIEW") {
        needsReviewCount++;
      } else {
        failedCount++;
      }

      // Resolve diagram image URL if question references one
      let imageUrl: string | undefined = undefined;
      if (q.sourceImageId && params.sourcePdfId) {
        const matchingImg = await prisma.aiSourcePdfImage.findUnique({
          where: { id: q.sourceImageId },
          select: { publicUrl: true },
        });
        if (matchingImg) imageUrl = matchingImg.publicUrl;
      }

      // Persist generated question item in DB immediately
      await prisma.aiGeneratedQuestion.create({
        data: {
          batchId,
          questionIndex: q.questionIndex || i + 1,
          statementEn: q.statementEn,
          statementHi: q.statementHi || null,
          optionsEn: q.optionsEn as any,
          optionsHi: (q.optionsHi as any) || null,
          correctAnswer: q.correctAnswer,
          solutionEn: q.solutionEn,
          solutionHi: q.solutionHi || null,
          subject: q.subject,
          chapter: q.chapter,
          topic: q.topic,
          subTopic: q.subTopic || null,
          difficulty: q.difficulty,
          questionType: q.questionType,
          pyqStyle: q.pyqStyle,
          language: q.language,
          imageUrl,
          sourcePdfId: params.sourcePdfId || null,
          sourcePageNumbers: q.sourcePageNumbers || [],
          sourceExcerpt: q.sourceExcerpt || null,
          sourceImageId: q.sourceImageId || null,
          validationStatus: report.validationStatus,
          validationReport: report as any,
          qualityScore: scores as any,
          isSavedToDraft: false,
        },
      });

      // Periodic batch update
      if (i % 3 === 0 || i === totalToValidate - 1) {
        await prisma.aiGenerationBatch.update({
          where: { id: batchId },
          data: {
            progress: stepPercent,
            passedCount,
            needsReviewCount,
            failedCount,
            currentStep: `Validated question ${i + 1} of ${totalToValidate}...`,
          },
        });
      }
    }

    // 5. Finalize Batch Completion
    await prisma.aiGenerationBatch.update({
      where: { id: batchId },
      data: {
        status: "COMPLETED",
        progress: 100,
        currentStep: "Generation & Validation Complete",
        generatedCount: rawQuestions.length,
        passedCount,
        needsReviewCount,
        failedCount,
      },
    });

    // 6. Record Audit Log
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        action: "AI_QUESTION_GENERATION_COMPLETED",
        entityType: "AiGenerationBatch",
        entityId: batchId,
        metadata: {
          method: params.method,
          subject: params.subject,
          chapter: params.chapter,
          totalRequested: params.totalQuestions,
          generated: rawQuestions.length,
          passed: passedCount,
          needsReview: needsReviewCount,
          failed: failedCount,
        },
      },
    });
  } catch (err: any) {
    console.error(`[JobRunner] Generation batch ${batchId} failed:`, err);
    await prisma.aiGenerationBatch.update({
      where: { id: batchId },
      data: {
        status: "FAILED",
        currentStep: "Generation failed due to an error.",
        errorDetails: err?.message || String(err),
      },
    });
  }
}
