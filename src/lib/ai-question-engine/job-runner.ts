import crypto from "crypto";
import { waitUntil } from "@vercel/functions";
import { prisma } from "@/lib/db";
import { defaultAiProvider, matchSelectedTopic } from "./gemini-provider";
import { runQuestionValidationPipeline } from "./validator-pipeline";
import { withNewQuestionCode, toQuestionType, toDifficulty } from "@/lib/questions/create-with-code";
import {
  GenerationLanguage,
  GenerationPlan,
  NeetDifficulty,
  QuestionQualityScores,
  QuestionValidationReport,
  RawAiGeneratedQuestion,
} from "./types";
import { PROMPT_VERSION } from "./prompt-templates";
import { GEMINI_TEXT_MODELS } from "@/lib/ai/gemini-models";

/**
 * The generate route runs for at most 300 s on Vercel (maxDuration). The
 * worker keeps inside that: generation stops starting new chunks after
 * GENERATE_BUDGET_MS, validation after WORK_BUDGET_MS — anything left is
 * saved as "needs review" so nothing is lost and the batch always finishes.
 */
const GENERATE_BUDGET_MS = 150_000;
const WORK_BUDGET_MS = 265_000;
const VALIDATION_CONCURRENCY = 3;
/** A PROCESSING batch with no update for this long has been cut off (see recoverStaleBatch). */
export const STALE_BATCH_MS = 6 * 60 * 1000;

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
  primaryNature?: string;
  cognitiveLevel?: string;
  sourceMode?: "NCERT_ONLY" | "NCERT_PYQ" | "NCERT_VERIFIED" | "OPEN_ACADEMIC";
  imageMode?: "NCERT_FIGURE_ONLY" | "NCERT_GENERATED" | "GENERATED_DIAGRAM" | "USER_UPLOADED" | "NONE";
  figurePreference?: "AUTO" | "MANUAL";
  language: GenerationLanguage;
  totalQuestions: number;
  generationPlan: GenerationPlan;
  sourcePdfId?: string;
  userId: string;
}

/**
 * Starts an AI Question Generation job and returns at once; the work runs in
 * the background. waitUntil() keeps the Vercel function alive until it is
 * done — before, the worker was fire-and-forget, so the function froze as
 * soon as the response was sent and batches hung at "Synthesizing…" with
 * half their questions missing.
 */
export async function startGenerationJob(params: StartJobParams): Promise<{
  batchId: string;
  batchCode: string;
}> {
  const batchCode = generateBatchCode();

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
      modelName: GEMINI_TEXT_MODELS[0],
      promptVersion: PROMPT_VERSION,
      costEstimate: {
        totalQuestions: params.totalQuestions,
        // one generation call per 5 questions + one audit call per question
        estimatedAiCalls: Math.ceil(params.totalQuestions / 5) + params.totalQuestions,
      },
      createdById: params.userId,
    },
  });

  const work = runGenerationJobWorker(batch.id, params, Date.now()).catch((err) => {
    console.error(`[JobRunner] Unhandled worker error for batch ${batch.id}:`, err);
  });
  waitUntil(work);

  return { batchId: batch.id, batchCode: batch.batchCode };
}

/** Picks the PDF chunks that belong to the selected topics (not just the first 30 chunks of the file). */
async function loadSourceContext(sourcePdfId: string, topics: string[]) {
  const pdf = await prisma.aiSourcePdf.findUnique({
    where: { id: sourcePdfId },
    include: {
      chunks: { orderBy: [{ pageNumber: "asc" }, { chunkIndex: "asc" }] },
      images: { orderBy: { pageNumber: "asc" } },
    },
  });
  if (!pdf) return { sourceText: "", sourceImages: [] as Array<{ id: string; page: number; description: string }> };

  const words = topics.flatMap((t) => t.toLowerCase().split(/[^\p{L}\p{N}]+/u)).filter((w) => w.length > 3);
  const scoreOf = (c: { detectedTopic: string | null; heading: string | null; content: string }) => {
    if (!topics.length) return 1;
    if (c.detectedTopic && matchSelectedTopic(c.detectedTopic, topics)) return 100;
    const hay = `${c.heading ?? ""} ${c.content}`.toLowerCase();
    return words.reduce((n, w) => n + (hay.includes(w) ? 1 : 0), 0);
  };

  const ranked = pdf.chunks.map((c) => ({ c, score: scoreOf(c) }));
  const relevant = ranked.filter((r) => r.score > 0);
  // Keep page order inside the budget; fall back to the whole file if nothing matched.
  const picked = (relevant.length ? relevant : ranked)
    .sort((a, b) => b.score - a.score)
    .reduce<{ list: typeof ranked; chars: number }>(
      (acc, r) => (acc.chars + r.c.content.length > 15000 ? acc : { list: [...acc.list, r], chars: acc.chars + r.c.content.length }),
      { list: [], chars: 0 }
    )
    .list.sort((a, b) => a.c.pageNumber - b.c.pageNumber || a.c.chunkIndex - b.c.chunkIndex);

  const pages = new Set(picked.map((r) => r.c.pageNumber));
  const sourceText = picked.map((r) => `[Page ${r.c.pageNumber}] ${r.c.content}`).join("\n\n");
  const sourceImages = pdf.images
    .filter((img) => pages.has(img.pageNumber) || (img.topic && matchSelectedTopic(img.topic, topics)))
    .slice(0, 10)
    .map((img) => ({ id: img.id, page: img.pageNumber, description: img.associatedText || `Figure on page ${img.pageNumber}` }));
  return { sourceText, sourceImages };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!, i);
      }
    })
  );
  return out;
}

const DRAFTABLE = new Set(["PASSED", "NEEDS_REVIEW", "BILINGUAL_VALIDATION_FAILED"]);

/**
 * Background worker: generate → validate (real AI audit) → persist.
 * Each AI question is stored once in the batch and, unless it failed
 * validation, once in the Question Bank as a DRAFT with its Question ID —
 * linked through draftQuestionId so "Save to draft" reuses it instead of
 * making a second copy.
 */
async function runGenerationJobWorker(batchId: string, params: StartJobParams, startedAt: number): Promise<void> {
  try {
    let sourceText = "";
    let sourceImages: Array<{ id: string; page: number; description: string }> = [];

    if (params.method === "PDF" && params.sourcePdfId) {
      await prisma.aiGenerationBatch.update({
        where: { id: batchId },
        data: { progress: 15, currentStep: "Reading the PDF sections for the selected topics..." },
      });
      ({ sourceText, sourceImages } = await loadSourceContext(params.sourcePdfId, params.selectedTopics));
    } else if (
      params.imageMode === "NCERT_FIGURE_ONLY" ||
      params.primaryNature === "Diagram-Based" ||
      params.questionTypes.includes("DIAGRAM_BASED") ||
      params.questionTypes.includes("IMAGE_BASED")
    ) {
      // Automatic NCERT Figure Discovery (Section 99, 100, 111)
      await prisma.aiGenerationBatch.update({
        where: { id: batchId },
        data: { progress: 15, currentStep: "Inspecting NCERT repository for authentic textbook diagrams..." },
      });

      const matchingImages = await prisma.aiSourcePdfImage.findMany({
        where: {
          OR: [
            { topic: { contains: params.chapter, mode: "insensitive" } },
            { associatedText: { contains: params.chapter, mode: "insensitive" } },
            { sourcePdf: { fileName: { contains: params.chapter, mode: "insensitive" } } },
            { sourcePdf: { fileName: { contains: params.subject, mode: "insensitive" } } },
          ],
        },
        take: 20,
      });

      if (matchingImages.length > 0) {
        sourceImages = matchingImages.map((img) => ({
          id: img.id,
          page: img.pageNumber,
          description: img.associatedText || img.topic || `NCERT Figure on page ${img.pageNumber}`,
        }));
      }
    }

    const questionTypeCounts: Record<string, number> = {};
    for (const item of params.generationPlan.items) {
      if (item.count > 0) questionTypeCounts[item.questionTypeId] = item.count;
    }

    await prisma.aiGenerationBatch.update({
      where: { id: batchId },
      data: { progress: 30, currentStep: "Generating questions with the AI engine..." },
    });

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
      deadlineMs: startedAt + GENERATE_BUDGET_MS,
    });

    await prisma.aiGenerationBatch.update({
      where: { id: batchId },
      data: {
        progress: 55,
        generatedCount: rawQuestions.length,
        currentStep: `Checking answers with an independent AI solver (0 of ${rawQuestions.length})...`,
      },
    });

    // Validate in parallel (a few at a time) inside the time budget.
    let done = 0;
    const results = await mapLimit(rawQuestions, VALIDATION_CONCURRENCY, async (q, i) => {
      let report: QuestionValidationReport;
      let scores: QuestionQualityScores;
      if (Date.now() - startedAt > WORK_BUDGET_MS) {
        report = {
          isValid: false,
          validationStatus: "NEEDS_REVIEW",
          solverConfidence: 0,
          solverReasoning: "Not checked — the batch reached its time limit.",
          isAmbiguous: false,
          isScientificallySound: true,
          solutionConsistentWithAnswer: true,
          duplicateScore: 0,
          duplicateRisk: "NONE",
          bilingualEquivalent: true,
          issues: ["Not checked by the AI solver (time limit) — please verify the answer."],
          aiValidated: false,
        };
        scores = { contentAccuracy: 0, answerConfidence: 0, ncertAlignment: 0, neetRelevance: 0, languageQuality: 0, overallScore: 0 };
      } else {
        ({ report, scores } = await runQuestionValidationPipeline({
          question: q,
          aiProvider: defaultAiProvider,
          batchQuestionsSoFar: rawQuestions.slice(0, i),
          allowedTopics: params.selectedTopics,
        }));
      }
      done++;
      if (done % 3 === 0 || done === rawQuestions.length) {
        await prisma.aiGenerationBatch
          .update({
            where: { id: batchId },
            data: {
              progress: Math.round(55 + (done / Math.max(1, rawQuestions.length)) * 35),
              currentStep: `Checking answers with an independent AI solver (${done} of ${rawQuestions.length})...`,
            },
          })
          .catch(() => {});
      }
      return { q, report, scores };
    });

    await prisma.aiGenerationBatch.update({
      where: { id: batchId },
      data: { progress: 92, currentStep: "Saving questions..." },
    });

    let passedCount = 0;
    let needsReviewCount = 0;
    let failedCount = 0;
    let draftedCount = 0;

    for (const [i, { q, report, scores }] of results.entries()) {
      if (report.validationStatus === "PASSED") passedCount++;
      else if (report.validationStatus === "NEEDS_REVIEW") needsReviewCount++;
      else failedCount++;

      let imageUrl: string | undefined;
      if (q.sourceImageId && params.sourcePdfId) {
        const img = await prisma.aiSourcePdfImage.findUnique({ where: { id: q.sourceImageId }, select: { publicUrl: true } });
        if (img) imageUrl = img.publicUrl;
      }

      // Question Bank draft — only for questions that didn't fail outright.
      let draftQuestionId: string | null = null;
      if (DRAFTABLE.has(report.validationStatus)) {
        try {
          const methodTag = params.method === "PDF" ? "PDF" : "AI";
          const translations: any[] = [];
          if (q.statementEn?.trim()) {
            translations.push({ language: "ENGLISH", statement: q.statementEn.trim(), options: q.optionsEn as any, correctOptionIds: q.correctAnswer, solution: q.solutionEn || null });
          }
          if (q.statementHi?.trim()) {
            translations.push({ language: "HINDI", statement: q.statementHi.trim(), options: (q.optionsHi as any) || {}, correctOptionIds: q.correctAnswer, solution: q.solutionHi || null });
          }
          const created = await withNewQuestionCode(q.subject, (questionCode) =>
            prisma.question.create({
              data: {
                questionCode,
                subject: q.subject,
                chapter: q.chapter,
                topic: q.topic,
                subTopic: q.subTopic || null,
                type: toQuestionType(q.questionType),
                difficulty: toDifficulty(q.difficulty),
                category: `AI_GENERATED:${methodTag}`,
                status: "DRAFT",
                isPublished: false,
                imageUrl,
                solution: q.solutionEn || q.solutionHi || null,
                tags: `AI_AUTO_DRAFT, METHOD_${methodTag}, BATCH_${batchId}, ${q.difficulty}, VALIDATION_${report.validationStatus}`,
                createdById: params.userId,
                translations: { create: translations },
              },
              select: { id: true },
            })
          );
          draftQuestionId = created.id;
          draftedCount++;
        } catch (err) {
          // Not swallowed silently any more: the batch question records why.
          console.error(`[JobRunner] Could not create the Question Bank draft (batch ${batchId}):`, err);
          report.issues.push(`Question Bank draft could not be created: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

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
          draftQuestionId,
          isSavedToDraft: Boolean(draftQuestionId),
          savedAt: draftQuestionId ? new Date() : null,
        },
      });
    }

    const generated = results.length;
    const shortBy = Math.max(0, params.totalQuestions - generated);
    await prisma.aiGenerationBatch.update({
      where: { id: batchId },
      data: {
        status: generated > 0 ? "COMPLETED" : "FAILED",
        progress: 100,
        currentStep:
          generated === 0
            ? "No questions generated."
            : shortBy > 0
              ? `Completed — ${generated} of ${params.totalQuestions} generated (time limit); run again for the rest.`
              : "Generation & Validation Complete",
        generatedCount: generated,
        passedCount,
        needsReviewCount,
        failedCount,
        savedDraftCount: draftedCount,
      },
    });

    await prisma.auditLog
      .create({
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
            generated,
            passed: passedCount,
            needsReview: needsReviewCount,
            failed: failedCount,
            drafted: draftedCount,
          },
        },
      })
      .catch(() => {});
  } catch (err: any) {
    console.error(`[JobRunner] Generation batch ${batchId} error:`, err);
    try {
      const existingCount = await prisma.aiGeneratedQuestion.count({ where: { batchId } });
      await prisma.aiGenerationBatch.update({
        where: { id: batchId },
        data: {
          status: existingCount > 0 ? "COMPLETED" : "FAILED",
          progress: 100,
          currentStep: existingCount > 0 ? "Generation completed (partial)" : "Generation failed due to an error.",
          generatedCount: existingCount,
          errorDetails: err?.message || String(err),
        },
      });
    } catch (dbErr) {
      console.error(`[JobRunner] Could not update batch status for ${batchId}:`, dbErr);
    }
  }
}

/**
 * A batch still PROCESSING long after its last update was cut off (deploy,
 * crash, timeout). Mark it finished with what was saved so the screen stops
 * spinning forever. Returns true if it changed the batch.
 */
export async function recoverStaleBatch(batch: { id: string; status: string; updatedAt: Date }): Promise<boolean> {
  if (batch.status !== "PROCESSING" || Date.now() - batch.updatedAt.getTime() < STALE_BATCH_MS) return false;
  const saved = await prisma.aiGeneratedQuestion.count({ where: { batchId: batch.id } });
  await prisma.aiGenerationBatch.update({
    where: { id: batch.id },
    data: {
      status: saved > 0 ? "COMPLETED" : "FAILED",
      progress: 100,
      generatedCount: saved,
      currentStep: saved > 0 ? `Stopped early — ${saved} question(s) were saved.` : "Generation stopped before any question was saved. Please try again.",
      errorDetails: "Background job was cut off before it finished.",
    },
  });
  return true;
}
