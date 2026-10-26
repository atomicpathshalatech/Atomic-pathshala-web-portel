import crypto from "crypto";
import { waitUntil } from "@vercel/functions";
import { prisma } from "@/lib/db";
import { defaultAiProvider, matchSelectedTopic } from "./gemini-provider";
import { runQuestionValidationPipeline } from "./validator-pipeline";
import { withNewQuestionCode, toDifficulty } from "@/lib/questions/create-with-code";
import { bankTypeOf } from "./type-formats";
import { attachFigure } from "./prepare-figure";
import { runMultiModelAudit } from "@/lib/ai-provider/multi-model-hub";
import { QuestionSnapshot } from "@/lib/ai-provider/types";
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

const DRAFTABLE = new Set(["PASSED", "APPROVED_BY_ALL", "APPROVED_AFTER_VERIFICATION"]);

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
    // A question about a real photograph needs one to look at: without any
    // source image those are asked as diagram questions (drawn figure) instead.
    let note = "";
    if (questionTypeCounts.IMAGE_BASED && sourceImages.length === 0) {
      questionTypeCounts.DIAGRAM_BASED = (questionTypeCounts.DIAGRAM_BASED ?? 0) + questionTypeCounts.IMAGE_BASED;
      note = `No source image for "Image Based" — ${questionTypeCounts.IMAGE_BASED} asked as "Diagram Based" (drawn figure).`;
      delete questionTypeCounts.IMAGE_BASED;
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

    // Pictures first: the validator needs to know whether each visual question really has one.
    await prisma.aiGenerationBatch.update({ where: { id: batchId }, data: { progress: 50, currentStep: "Drawing figures for visual questions..." } });
    for (const q of rawQuestions) {
      if (q.figure || q.sourceImageId) await attachFigure(q, batchId);
    }

    // Persist all generated questions immediately so they are never lost if a worker timeout occurs!
    const persistedQuestions = await Promise.all(
      rawQuestions.map((q, i) =>
        prisma.aiGeneratedQuestion.create({
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
            imageUrl: q.imageUrl || null,
            sourcePdfId: params.sourcePdfId || null,
            sourcePageNumbers: q.sourcePageNumbers || [],
            sourceExcerpt: q.sourceExcerpt || null,
            sourceImageId: q.sourceImageId || null,
            validationStatus: "PROCESSING",
          },
        })
      )
    );

    await prisma.aiGenerationBatch.update({
      where: { id: batchId },
      data: {
        progress: 55,
        generatedCount: rawQuestions.length,
        currentStep: `Multi-AI Verification in progress (0 of ${rawQuestions.length}) — L1 Gemini, L2 OpenAI, L3 Groq, Math/Chem validation...`,
      },
    });

    let passedCount = 0;
    let needsReviewCount = 0;
    let failedCount = 0;
    let draftedCount = 0;
    let done = 0;

    // Validate in parallel (a few at a time) inside the time budget.
    await mapLimit(rawQuestions, VALIDATION_CONCURRENCY, async (q, i) => {
      const persistedQ = persistedQuestions[i]!;
      let report: QuestionValidationReport;
      let scores: QuestionQualityScores;
      let qcPayload: any = null;

      const snapshot: QuestionSnapshot = {
        statement: q.statementEn || q.statementHi || "",
        options: (q.optionsEn as Record<string, string>) || {},
        storedAnswer: Array.isArray(q.correctAnswer) ? q.correctAnswer : [String(q.correctAnswer || "A")],
        solution: q.solutionEn || q.solutionHi || "",
        subject: q.subject,
        chapter: q.chapter,
        topic: q.topic,
        subTopic: q.subTopic || undefined,
        difficulty: q.difficulty,
      };

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
        // Run full adversarial multi-model QC audit (Gemini L1, OpenAI L2, Claude/Groq L3, Math, Chem, Consensus)
        try {
          qcPayload = await runMultiModelAudit(snapshot, sourceText || undefined, { persist: false });
        } catch (auditErr) {
          console.error(`[JobRunner] Multi-model audit exception for Q#${i + 1}:`, auditErr);
        }

        // Run structural, topic-relevance, and duplicate detection (skip legacy AI check since multi-model audit already ran)
        ({ report, scores } = await runQuestionValidationPipeline({
          question: q,
          aiProvider: defaultAiProvider,
          batchQuestionsSoFar: rawQuestions.slice(0, i),
          allowedTopics: params.selectedTopics,
          skipLegacyAiCheck: true,
        }));

        if (qcPayload) {
          if (qcPayload.finalDecision?.disagreements?.length > 0) {
            report.issues.push(...qcPayload.finalDecision.disagreements);
          }
          if (qcPayload.finalDecision?.reasons?.length > 0) {
            report.issues.push(...qcPayload.finalDecision.reasons);
          }

          // Safe Approval Gate: If consensus or deterministic checks failed, mark status accurately
          const finalStatus = qcPayload.finalDecision.finalStatus;
          const eligible = qcPayload.finalDecision.eligibleForApproval && report.isValid;
          report.validationStatus = finalStatus;
          report.isValid = eligible;
          (report as any).qcPayload = qcPayload;

          const avgConfidence = Math.round(
            ((qcPayload.geminiReview?.confidenceScore || 0) +
              (qcPayload.openaiReview?.confidenceScore || 0) +
              (qcPayload.claudeReview?.confidenceScore || 0)) /
              3 *
              100
          );
          if (eligible) {
            scores.overallScore = Math.max(scores.overallScore, avgConfidence || 95);
            scores.contentAccuracy = Math.max(scores.contentAccuracy, avgConfidence || 95);
          } else {
            scores.overallScore = Math.min(scores.overallScore || 50, 40);
          }
        }
      }

      // Question Bank draft — ONLY for questions that strictly passed multi-model consensus
      let draftQuestionId: string | null = null;
      if (DRAFTABLE.has(report.validationStatus)) {
        try {
          const methodTag = params.method === "PDF" ? "PDF" : "AI";
          const translations: any[] = [];
          if (q.statementEn?.trim()) {
            translations.push({
              language: "ENGLISH",
              statement: q.statementEn.trim(),
              options: q.optionsEn as any,
              correctOptionIds: q.correctAnswer,
              solution: q.solutionEn || null,
            });
          }
          if (q.statementHi?.trim()) {
            translations.push({
              language: "HINDI",
              statement: q.statementHi.trim(),
              options: (q.optionsHi as any) || {},
              correctOptionIds: q.correctAnswer,
              solution: q.solutionHi || null,
            });
          }
          const created = await withNewQuestionCode(q.subject, (questionCode) =>
            prisma.question.create({
              data: {
                questionCode,
                subject: q.subject,
                chapter: q.chapter,
                topic: q.topic,
                subTopic: q.subTopic || null,
                type: bankTypeOf(q.questionType),
                difficulty: toDifficulty(q.difficulty),
                category: `AI_GENERATED:${methodTag}`,
                status: "DRAFT",
                isPublished: false,
                imageUrl: q.imageUrl || null,
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
          console.error(`[JobRunner] Could not create the Question Bank draft (batch ${batchId}):`, err);
          report.issues.push(
            `Question Bank draft could not be created: ${err instanceof Error ? err.message : String(err)}`
          );
        }
      }

      // Progressively update the persisted question record in PostgreSQL
      await prisma.aiGeneratedQuestion.update({
        where: { id: persistedQ.id },
        data: {
          validationStatus: report.validationStatus,
          validationReport: report as any,
          qualityScore: scores as any,
          draftQuestionId,
          isSavedToDraft: Boolean(draftQuestionId),
          savedAt: draftQuestionId ? new Date() : null,
        },
      });

      // Persist the QuestionReviewAudit record in PostgreSQL
      if (qcPayload) {
        try {
          await prisma.questionReviewAudit.create({
            data: {
              generatedQId: persistedQ.id,
              questionId: draftQuestionId || null,
              snapshot: snapshot as any,
              geminiReview: qcPayload.geminiReview as any,
              openaiReview: qcPayload.openaiReview as any,
              claudeReview: qcPayload.claudeReview as any,
              mathValidation: qcPayload.mathValidation as any,
              chemValidation: qcPayload.chemValidation as any,
              ncertValidation: qcPayload.finalDecision?.ncertValidation as any,
              finalDecision: qcPayload.finalDecision as any,
              finalStatus: qcPayload.finalDecision?.finalStatus || report.validationStatus,
              disagreements: (qcPayload.finalDecision?.disagreements as any) || [],
              reasons: (qcPayload.finalDecision?.reasons as any) || [],
              tokenUsage: {
                gemini: qcPayload.geminiReview?.tokenUsage,
                openai: qcPayload.openaiReview?.tokenUsage,
                claude: qcPayload.claudeReview?.tokenUsage,
              } as any,
            },
          });
        } catch (auditErr) {
          console.warn(`[JobRunner] Failed to persist QuestionReviewAudit for ${persistedQ.id}:`, auditErr);
        }
      }

      const status = report.validationStatus;
      if (status === "PASSED" || status === "APPROVED_BY_ALL" || status === "APPROVED_AFTER_VERIFICATION") {
        passedCount++;
      } else if (
        status === "NEEDS_REVIEW" ||
        status === "MANUAL_REVIEW_REQUIRED" ||
        status === "API_FAILURE" ||
        status === "SOURCE_UNVERIFIED"
      ) {
        needsReviewCount++;
      } else {
        failedCount++;
      }

      done++;
      await prisma.aiGenerationBatch
        .update({
          where: { id: batchId },
          data: {
            progress: Math.round(55 + (done / Math.max(1, rawQuestions.length)) * 40),
            generatedCount: rawQuestions.length,
            passedCount,
            needsReviewCount,
            failedCount,
            savedDraftCount: draftedCount,
            currentStep: `Multi-AI Verification in progress (${done} of ${rawQuestions.length}) — L1 Gemini, L2 OpenAI, L3 Groq...`,
          },
        })
        .catch(() => {});
    });

    const generated = rawQuestions.length;
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
              ? `Completed — ${generated} of ${params.totalQuestions} generated; run again for the rest.${note ? ` ${note}` : ""}`
              : `Generation & Validation Complete${note ? ` — ${note}` : ""}`,
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
