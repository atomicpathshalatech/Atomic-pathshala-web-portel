/**
 * ATOMIC PATHSHALA — MULTI-AI QUESTION VERIFICATION SERVICE (PHASE 2 - 11)
 *
 * Orchestrates independent verification across 4 AI providers:
 * 1. Google Gemini
 * 2. Anthropic Claude
 * 3. xAI Grok (with Groq fallback)
 * 4. OpenAI GPT
 *
 * Key guarantees:
 * - Durable background execution (question creation never fails if an AI is down)
 * - Safe human approval gate (AI changes never overwrite question automatically)
 * - Revision-aware suggestions and human decision audit trail
 * - Full disagreement detection across all 4 models
 */

import { prisma } from "@/lib/db";
import {
  QuestionSnapshot,
  SingleModelReview,
  CompleteReviewPayload,
  QualityStatus,
  ReviewDecision,
} from "@/lib/ai-provider/types";
import { reviewQuestionWithGemini } from "@/lib/ai-provider/gemini";
import { reviewQuestionWithClaude } from "@/lib/ai-provider/claude";
import { reviewQuestionWithGrok } from "@/lib/ai-provider/grok";
import { reviewQuestionWithOpenAI } from "@/lib/ai-provider/openai";
import { validateMathematics } from "@/lib/question-qc/math-validator";
import { validateChemistry } from "@/lib/question-qc/chemical-validator";
import { evaluateFinalQualityDecision } from "@/lib/question-qc/decision-engine";
import { computeQuestionContentHash } from "./content-hash";
import { analyzeQuestionSimilarity } from "./similarity";

export interface VerificationTriggerOptions {
  triggerSource?: "MANUAL" | "AI_GENERATED" | "PDF_EXTRACTION" | "PYQ_IMPORT" | "QUESTION_BANK_IMPORT" | "BATCH_IMPORT";
  forceReverify?: boolean;
  userId?: string;
}

export interface AcceptSuggestionOptions {
  suggestionId: string;
  questionId: string;
  reviewerId: string;
  decisionNote?: string;
  editedValue?: string;
}

export interface RejectSuggestionOptions {
  suggestionId: string;
  questionId: string;
  reviewerId: string;
  decisionNote?: string;
}

function timeoutPromise<T>(p: Promise<T>, ms = 30_000, providerName = "AI"): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${providerName} review timed out after ${Math.round(ms / 1000)}s`));
    }, ms);
    p.then((v) => {
      clearTimeout(timer);
      resolve(v);
    }).catch((err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Builds a standardized question snapshot from a Question record in PostgreSQL.
 */
export function buildSnapshotFromQuestion(question: any): QuestionSnapshot {
  const transEn =
    question.translations?.find((t: any) => t.language?.toUpperCase() === "ENGLISH") ||
    question.translations?.[0];
  const transHi = question.translations?.find((t: any) => t.language?.toUpperCase() === "HINDI");

  const statement = transEn?.statement || transHi?.statement || "";
  const options = (transEn?.options as Record<string, string>) || (transHi?.options as Record<string, string>) || {};
  const storedAnswer = Array.isArray(transEn?.correctOptionIds)
    ? transEn.correctOptionIds
    : Array.isArray(transHi?.correctOptionIds)
    ? transHi.correctOptionIds
    : ["A"];
  const solution = transEn?.solution || transHi?.solution || question.solution || "";

  return {
    id: question.id,
    questionCode: question.questionCode,
    statement,
    options,
    storedAnswer,
    solution,
    subject: question.subject,
    chapter: question.chapter || "",
    topic: question.topic || "",
    subTopic: question.subTopic || "",
    difficulty: question.difficulty || "MEDIUM",
    type: question.type || "SINGLE_CORRECT",
    language: transHi ? "BOTH" : "ENGLISH",
    diagramUrl: question.imageUrl || undefined,
  };
}

/**
 * Triggers the 4-provider verification pipeline for a question.
 * Runs non-blocking / asynchronously so caller is never blocked or failed.
 */
export async function triggerQuestionVerification(
  questionId: string,
  options: VerificationTriggerOptions = {}
): Promise<{ jobId: string; status: string }> {
  const { triggerSource = "MANUAL", forceReverify = false, userId } = options;

  // 1. Fetch Question from DB
  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { translations: true, assets: true },
  });

  if (!question) {
    throw new Error(`Question ${questionId} not found`);
  }

  const snapshot = buildSnapshotFromQuestion(question);
  const contentHash = computeQuestionContentHash({
    statement: snapshot.statement,
    options: snapshot.options,
    correctOptionIds: snapshot.storedAnswer,
    solution: snapshot.solution,
    subject: question.subject,
    chapter: question.chapter,
    topic: question.topic,
    difficulty: question.difficulty,
  });

  // 2. Check if a completed job already exists for this exact revision and hash
  if (!forceReverify) {
    const existingJob = await prisma.questionVerificationJob.findFirst({
      where: {
        questionId,
        contentHash,
        status: { in: ["COMPLETED", "PARTIALLY_COMPLETED"] },
      },
      include: { modelRuns: true },
    });

    if (existingJob && existingJob.modelRuns.length >= 4) {
      return { jobId: existingJob.id, status: existingJob.status };
    }
  }

  // 3. Create or reuse active QuestionVerificationJob
  const job = await prisma.questionVerificationJob.create({
    data: {
      questionId,
      questionCode: question.questionCode,
      revision: question.version || 1,
      contentHash,
      triggerSource,
      status: "PROCESSING",
    },
  });

  // 4. Execute verification in background without awaiting blocking caller
  executeVerificationJob(job.id, question, snapshot, contentHash, userId).catch((err) => {
    console.error(`[VerificationService] Background job ${job.id} failed:`, err);
  });

  return { jobId: job.id, status: "PROCESSING" };
}

/**
 * Executes all 4 providers, deterministic checks, and persists runs and suggestions.
 */
async function executeVerificationJob(
  jobId: string,
  question: any,
  snapshot: QuestionSnapshot,
  contentHash: string,
  userId?: string
) {
  const transHi = question.translations?.find((t: any) => t.language?.toUpperCase() === "HINDI");

  // Optional source retrieval if NCERT document chunks exist
  let sourceContext: string | undefined;
  try {
    const ncertDoc = await (prisma as any).ncertDocument.findFirst({
      where: {
        academicSubject: { name: { contains: question.subject, mode: "insensitive" } },
        academicChapter: { title: { contains: question.chapter || "", mode: "insensitive" } },
      },
      include: {
        pages: { take: 3 },
      },
    });
    if (ncertDoc?.pages && ncertDoc.pages.length > 0) {
      sourceContext = ncertDoc.pages.map((p: any) => p.content || "").filter(Boolean).join("\n---\n");
    }
  } catch {
    // Non-critical if source text query fails
  }

  // A. Execute 4 AI providers independently in parallel
  const [geminiSettled, claudeSettled, grokSettled, openaiSettled] = await Promise.allSettled([
    timeoutPromise(reviewQuestionWithGemini(snapshot, sourceContext), 30_000, "Gemini"),
    timeoutPromise(reviewQuestionWithClaude(snapshot, sourceContext), 30_000, "Claude"),
    timeoutPromise(reviewQuestionWithGrok(snapshot, sourceContext), 30_000, "Grok"),
    timeoutPromise(reviewQuestionWithOpenAI(snapshot, sourceContext), 30_000, "OpenAI"),
  ]);

  const geminiReview: SingleModelReview =
    geminiSettled.status === "fulfilled"
      ? geminiSettled.value
      : createFallbackReview("gemini", "gemini-1.5-flash", geminiSettled.reason);

  const claudeReview: SingleModelReview =
    claudeSettled.status === "fulfilled"
      ? claudeSettled.value
      : createFallbackReview("claude", "claude-3-5-sonnet", claudeSettled.reason);

  const grokReview: SingleModelReview =
    grokSettled.status === "fulfilled"
      ? grokSettled.value
      : createFallbackReview("grok", "grok-2", grokSettled.reason);

  const openaiReview: SingleModelReview =
    openaiSettled.status === "fulfilled"
      ? openaiSettled.value
      : createFallbackReview("openai", "gpt-4o", openaiSettled.reason);

  // B. Deterministic Mathematical & Chemical Validation
  const mathValidation = validateMathematics(snapshot.statement, snapshot.solution);
  const chemValidation = validateChemistry(snapshot.statement, snapshot.solution);

  // C. Evaluate Consensus & Final Quality Decision
  const finalDecision = evaluateFinalQualityDecision(
    snapshot,
    geminiReview,
    openaiReview,
    claudeReview,
    mathValidation,
    chemValidation,
    grokReview
  );

  // D. Persist each provider run into AiModelRun table
  const allReviews = [geminiReview, claudeReview, grokReview, openaiReview];
  for (const rev of allReviews) {
    try {
      const isFailed = rev.confidenceScore === 0 && Boolean(rev.apiError?.isApiError);
      const isNotConfig = rev.rejectionReasons?.some((r) => r.includes("not configured"));

      await prisma.aiModelRun.create({
        data: {
          jobId,
          provider: rev.provider,
          modelId: rev.model,
          status: isNotConfig ? "NOT_CONFIGURED" : isFailed ? "FAILED" : "COMPLETED",
          completedAt: new Date(),
          durationMs: rev.tokenUsage?.durationMs || 0,
          inputTokens: rev.tokenUsage?.inputTokens || 0,
          outputTokens: rev.tokenUsage?.outputTokens || 0,
          estimatedCostUsd: rev.tokenUsage?.estimatedCostUsd || 0,
          errorCode: rev.apiError?.errorType || null,
          errorMessage: rev.apiError?.message || (rev.scientificErrors?.[0] ?? null),
          rawOutput: rev.rawOutput || null,
          report: rev as any,
          confidenceScore: rev.confidenceScore,
        },
      });
    } catch (saveErr) {
      console.error(`[VerificationService] Error saving run for ${rev.provider}:`, saveErr);
    }
  }

  // E. Generate field-level suggestions for discrepancies
  const suggestionsToCreate: Array<{
    field: string;
    language: string;
    currentValue: string;
    suggestedValue: string;
    reason: string;
    severity: string;
    provider: string;
  }> = [];

  for (const rev of allReviews) {
    if (rev.confidenceScore === 0 || rev.decision === "REJECT" && rev.apiError?.isApiError) {
      continue;
    }

    // 1. Answer key suggestion
    if (!rev.answerMatches && rev.solvedAnswer) {
      suggestionsToCreate.push({
        field: "correctAnswer",
        language: "ENGLISH",
        currentValue: (snapshot.storedAnswer || []).join(", "),
        suggestedValue: rev.solvedAnswer,
        reason: `${rev.provider.toUpperCase()} independently solved this as Option (${rev.solvedAnswer}). ${rev.identifiedMistakes?.[0] || ""}`,
        severity: "CRITICAL",
        provider: rev.provider,
      });
    }

    // 2. Solution suggestion
    if (rev.stepByStepSolution || rev.solutionCorrections) {
      const suggestedSol = rev.stepByStepSolution || rev.solutionCorrections || "";
      if (suggestedSol.trim() && suggestedSol.trim() !== snapshot.solution?.trim()) {
        suggestionsToCreate.push({
          field: "solution",
          language: "ENGLISH",
          currentValue: snapshot.solution || "None provided",
          suggestedValue: suggestedSol,
          reason: `${rev.provider.toUpperCase()} provided a verified step-by-step KaTeX derivation.`,
          severity: "HIGH",
          provider: rev.provider,
        });
      }
    }

    // 3. Question statement correction if flawed
    if (rev.suggestedQuestion && rev.suggestedQuestion.trim() !== snapshot.statement.trim()) {
      suggestionsToCreate.push({
        field: "statement",
        language: "ENGLISH",
        currentValue: snapshot.statement,
        suggestedValue: rev.suggestedQuestion,
        reason: `${rev.provider.toUpperCase()} refined statement to resolve ambiguity/scientific errors.`,
        severity: "HIGH",
        provider: rev.provider,
      });
    }

    // 4. Topic correction if suggested
    if (rev.topicCorrections?.topic && rev.topicCorrections.topic !== snapshot.topic) {
      suggestionsToCreate.push({
        field: "topic",
        language: "ENGLISH",
        currentValue: snapshot.topic || "None",
        suggestedValue: rev.topicCorrections.topic,
        reason: `${rev.provider.toUpperCase()} classified concept as ${rev.topicCorrections.topic}`,
        severity: "MEDIUM",
        provider: rev.provider,
      });
    }
  }

  // Deduplicate and persist suggestions
  for (const s of suggestionsToCreate) {
    try {
      await prisma.aiFieldSuggestion.create({
        data: {
          jobId,
          questionId: question.id,
          provider: s.provider,
          field: s.field,
          language: s.language,
          currentValue: s.currentValue,
          suggestedValue: s.suggestedValue,
          reason: s.reason,
          severity: s.severity,
          status: "PROPOSED",
        },
      });
    } catch (sugErr) {
      console.warn("[VerificationService] Warning saving suggestion:", sugErr);
    }
  }

  // F. Check Bank Similarity
  let simReport: any = null;
  try {
    simReport = await analyzeQuestionSimilarity(prisma, {
      statementEn: snapshot.statement,
      statementHi: transHi?.statement,
      subject: snapshot.subject,
      chapter: snapshot.chapter,
      topic: snapshot.topic,
      optionsEn: snapshot.options,
    });
  } catch (simErr) {
    console.warn("[VerificationService] Similarity check warning:", simErr);
  }

  // G. Update QuestionVerificationJob status
  const hasDisagreements = finalDecision.disagreements?.length > 0;
  const isPartiallyFailed = allReviews.some((r) => r.confidenceScore === 0);

  const aggregateStatus =
    finalDecision.finalStatus === "APPROVED_BY_ALL"
      ? "VERIFIED"
      : hasDisagreements
      ? "DISAGREEMENT"
      : finalDecision.finalStatus === "API_FAILURE"
      ? "FAILED"
      : "NEEDS_REVIEW";

  await prisma.questionVerificationJob.update({
    where: { id: jobId },
    data: {
      status: isPartiallyFailed ? "PARTIALLY_COMPLETED" : "COMPLETED",
      aggregateStatus,
      completedAt: new Date(),
    },
  });

  // H. Persist consolidated QuestionReviewAudit for historical dashboard compatibility
  try {
    await prisma.questionReviewAudit.create({
      data: {
        questionId: question.id,
        questionCode: question.questionCode,
        snapshot: snapshot as any,
        geminiReview: geminiReview as any,
        openaiReview: openaiReview as any,
        claudeReview: claudeReview as any,
        grokReview: grokReview as any,
        mathValidation: mathValidation as any,
        chemValidation: chemValidation as any,
        ncertValidation: finalDecision.ncertValidation as any,
        finalDecision: finalDecision as any,
        finalStatus: finalDecision.finalStatus,
        disagreements: finalDecision.disagreements as any,
        reasons: finalDecision.reasons as any,
        tokenUsage: {
          gemini: geminiReview.tokenUsage,
          claude: claudeReview.tokenUsage,
          grok: grokReview.tokenUsage,
          openai: openaiReview.tokenUsage,
          totalCostUsd:
            (geminiReview.tokenUsage?.estimatedCostUsd || 0) +
            (claudeReview.tokenUsage?.estimatedCostUsd || 0) +
            (grokReview.tokenUsage?.estimatedCostUsd || 0) +
            (openaiReview.tokenUsage?.estimatedCostUsd || 0),
        } as any,
      },
    });
  } catch (auditErr) {
    console.warn("[VerificationService] Warning persisting QuestionReviewAudit:", auditErr);
  }

  // I. Update Question aiVerified / aiAuditStatus flags
  await prisma.question.update({
    where: { id: question.id },
    data: {
      aiVerified: aggregateStatus === "VERIFIED",
      aiAuditStatus: aggregateStatus,
      aiAuditedAt: new Date(),
      needsReaudit: false,
    },
  });
}

function createFallbackReview(provider: string, model: string, reason: any): SingleModelReview {
  const msg = reason instanceof Error ? reason.message : String(reason);
  return {
    provider: provider as any,
    model,
    solvedAnswer: "",
    stepByStepSolution: null,
    identifiedMistakes: [`Execution failed: ${msg}`],
    recommendApproval: false,
    answerMatches: false,
    isScientificallyCorrect: false,
    isMathematicallyCorrect: false,
    scientificErrors: [`${provider.toUpperCase()} failed: ${msg}`],
    mathematicalErrors: [],
    solutionCorrections: null,
    suggestedQuestion: null,
    suggestedOptions: null,
    suggestedAnswer: null,
    topicCorrections: null,
    ncertAlignment: { supported: false, status: "UNVERIFIED" },
    ambiguityDetected: false,
    multipleCorrectOptionsDetected: false,
    decision: "REJECT",
    rejectionReasons: ["API_ERROR"],
    confidenceScore: 0,
    tokenUsage: { inputTokens: 0, outputTokens: 0, durationMs: 0, estimatedCostUsd: 0 },
    apiError: { isApiError: true, errorType: "NETWORK_ERROR", message: msg },
    rawOutput: `API_ERROR: ${msg}`,
  };
}

/**
 * Retrieves the verification reports, suggestions, runs, and disagreement matrix for a question.
 */
export async function getQuestionVerificationStatus(questionId: string) {
  const latestJob = await prisma.questionVerificationJob.findFirst({
    where: { questionId },
    orderBy: { createdAt: "desc" },
    include: {
      modelRuns: { orderBy: { startedAt: "desc" } },
      suggestions: { orderBy: { createdAt: "desc" } },
      decisions: {
        orderBy: { createdAt: "desc" },
        include: { reviewer: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  const latestAudit = await prisma.questionReviewAudit.findFirst({
    where: { questionId },
    orderBy: { createdAt: "desc" },
  });

  return {
    job: latestJob,
    audit: latestAudit,
    hasJob: Boolean(latestJob),
    status: latestJob?.status || "NOT_STARTED",
    aggregateStatus: latestJob?.aggregateStatus || "UNVERIFIED",
    runs: latestJob?.modelRuns || [],
    suggestions: latestJob?.suggestions || [],
    decisions: latestJob?.decisions || [],
    disagreements: (latestAudit?.disagreements as string[]) || [],
  };
}

/**
 * Applies an accepted suggestion directly to the Question and registers an audit trail record.
 */
export async function acceptFieldSuggestion(options: AcceptSuggestionOptions) {
  const { suggestionId, questionId, reviewerId, decisionNote, editedValue } = options;

  const suggestion = await prisma.aiFieldSuggestion.findUnique({
    where: { id: suggestionId },
  });

  if (!suggestion || suggestion.questionId !== questionId) {
    throw new Error("Suggestion not found or does not match question");
  }

  const valueToApply = editedValue !== undefined ? editedValue : suggestion.suggestedValue;
  const action = editedValue !== undefined ? "EDIT" : "ACCEPT";

  const question = await prisma.question.findUnique({
    where: { id: questionId },
    include: { translations: true },
  });

  if (!question) throw new Error("Question not found");

  const transEn =
    question.translations.find((t) => t.language?.toUpperCase() === suggestion.language.toUpperCase()) ||
    question.translations[0];

  // Apply to Question or QuestionTranslation
  if (suggestion.field === "correctAnswer") {
    const arr = valueToApply.split(",").map((s) => s.trim().toUpperCase());
    if (transEn) {
      await prisma.questionTranslation.update({
        where: { id: transEn.id },
        data: { correctOptionIds: arr },
      });
    }
  } else if (suggestion.field === "solution") {
    if (transEn) {
      await prisma.questionTranslation.update({
        where: { id: transEn.id },
        data: { solution: valueToApply },
      });
    }
    await prisma.question.update({
      where: { id: questionId },
      data: { solution: valueToApply },
    });
  } else if (suggestion.field === "statement") {
    if (transEn) {
      await prisma.questionTranslation.update({
        where: { id: transEn.id },
        data: { statement: valueToApply },
      });
    }
  } else if (suggestion.field === "topic") {
    await prisma.question.update({
      where: { id: questionId },
      data: { topic: valueToApply },
    });
  } else if (suggestion.field === "difficulty") {
    await prisma.question.update({
      where: { id: questionId },
      data: { difficulty: valueToApply as any },
    });
  }

  // Increment version and mark edited
  await prisma.question.update({
    where: { id: questionId },
    data: {
      version: (question.version || 1) + 1,
      editedById: reviewerId,
      editedAt: new Date(),
      lastHumanEditedAt: new Date(),
      lastHumanEditedById: reviewerId,
      needsReaudit: true,
    },
  });

  // Update suggestion status
  await prisma.aiFieldSuggestion.update({
    where: { id: suggestionId },
    data: {
      status: action === "EDIT" ? "EDITED" : "ACCEPTED",
    },
  });

  // Record audit trail in ReviewDecisionRecord
  const record = await prisma.reviewDecisionRecord.create({
    data: {
      jobId: suggestion.jobId,
      questionId,
      suggestionId,
      revision: question.version || 1,
      reviewerId,
      field: suggestion.field,
      action,
      previousValue: suggestion.currentValue,
      acceptedValue: valueToApply,
      decisionNote,
    },
  });

  return { success: true, decisionRecord: record };
}

/**
 * Rejects a proposed suggestion and records an audit trail record.
 */
export async function rejectFieldSuggestion(options: RejectSuggestionOptions) {
  const { suggestionId, questionId, reviewerId, decisionNote } = options;

  const suggestion = await prisma.aiFieldSuggestion.findUnique({
    where: { id: suggestionId },
  });

  if (!suggestion || suggestion.questionId !== questionId) {
    throw new Error("Suggestion not found or does not match question");
  }

  await prisma.aiFieldSuggestion.update({
    where: { id: suggestionId },
    data: { status: "REJECTED" },
  });

  const record = await prisma.reviewDecisionRecord.create({
    data: {
      jobId: suggestion.jobId,
      questionId,
      suggestionId,
      reviewerId,
      field: suggestion.field,
      action: "REJECT",
      previousValue: suggestion.currentValue,
      acceptedValue: null,
      decisionNote,
    },
  });

  return { success: true, decisionRecord: record };
}
