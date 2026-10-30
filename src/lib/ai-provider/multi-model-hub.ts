/**
 * ATOMIC PATHSHALA — MULTI-MODEL AI QUALITY CONTROL HUB
 * Coordinates Gemini L1, OpenAI L2, Claude L3, and Grok L4 independent reviews,
 * executes deterministic math and chemical validators, computes final consensus,
 * and records auditable reviews to PostgreSQL.
 */

import { prisma } from "@/lib/prisma";
import {
  CompleteReviewPayload,
  GenerateGroundedQuestionRequest,
  QuestionSnapshot,
  SingleModelReview,
} from "./types";
import { generateQuestionWithGemini, reviewQuestionWithGemini } from "./gemini";
import { reviewQuestionWithOpenAI } from "./openai";
import { reviewQuestionWithClaude } from "./claude";
import { reviewQuestionWithGroq } from "./groq";
import { reviewQuestionWithGrok } from "./grok";
import { validateMathematics } from "../question-qc/math-validator";
import { validateChemistry } from "../question-qc/chemical-validator";
import { evaluateFinalQualityDecision } from "../question-qc/decision-engine";

function withReviewTimeout<T>(promise: Promise<T>, ms: number = 25_000, providerName: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${providerName} review timed out after ${Math.round(ms / 1000)}s`));
    }, ms);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export async function runMultiModelAudit(
  snapshot: QuestionSnapshot,
  sourceContext?: string,
  options?: {
    persist?: boolean;
    userId?: string;
    sourceMaterialId?: string;
  }
): Promise<CompleteReviewPayload> {
  // Execute all four independent AI reviews in parallel: Gemini, OpenAI, Claude, Grok
  const [geminiResult, openaiResult, claudeResult, grokResult] = await Promise.allSettled([
    withReviewTimeout(reviewQuestionWithGemini(snapshot, sourceContext), 25_000, "Gemini"),
    withReviewTimeout(reviewQuestionWithOpenAI(snapshot, sourceContext), 25_000, "OpenAI"),
    withReviewTimeout(reviewQuestionWithClaude(snapshot, sourceContext), 25_000, "Claude"),
    withReviewTimeout(reviewQuestionWithGrok(snapshot, sourceContext), 25_000, "Grok"),
  ]);

  const geminiReview: SingleModelReview =
    geminiResult.status === "fulfilled"
      ? geminiResult.value
      : {
          provider: "gemini",
          model: "gemini-1.5-flash",
          solvedAnswer: "",
          answerMatches: false,
          isScientificallyCorrect: false,
          isMathematicallyCorrect: false,
          scientificErrors: [`Gemini failed: ${String(geminiResult.reason)}`],
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
        };

  const openaiReview: SingleModelReview =
    openaiResult.status === "fulfilled"
      ? openaiResult.value
      : {
          provider: "openai",
          model: "gpt-4o",
          solvedAnswer: "",
          answerMatches: false,
          isScientificallyCorrect: false,
          isMathematicallyCorrect: false,
          scientificErrors: [`OpenAI failed: ${String(openaiResult.reason)}`],
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
        };

  const claudeReview: SingleModelReview =
    claudeResult.status === "fulfilled"
      ? claudeResult.value
      : {
          provider: "claude",
          model: "claude-3-5-sonnet",
          solvedAnswer: "",
          answerMatches: false,
          isScientificallyCorrect: false,
          isMathematicallyCorrect: false,
          scientificErrors: [`Claude failed: ${String(claudeResult.reason)}`],
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
        };

  const grokReview: SingleModelReview =
    grokResult.status === "fulfilled"
      ? grokResult.value
      : {
          provider: "grok",
          model: "grok-2-latest",
          solvedAnswer: "",
          answerMatches: false,
          isScientificallyCorrect: false,
          isMathematicallyCorrect: false,
          scientificErrors: [`Grok failed: ${String(grokResult.reason)}`],
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
        };

  // Run deterministic math & chemical checks
  const mathValidation = validateMathematics(snapshot.statement, snapshot.solution);
  const chemValidation = validateChemistry(snapshot.statement, snapshot.solution);

  // Compute final quality decision using strict deterministic consensus logic across all 4 models
  const finalDecision = evaluateFinalQualityDecision(
    snapshot,
    geminiReview,
    openaiReview,
    claudeReview,
    mathValidation,
    chemValidation,
    grokReview
  );

  let auditId: string | undefined;

  // Persist review audit to PostgreSQL if requested
  if (options?.persist) {
    try {
      const created = await prisma.questionReviewAudit.create({
        data: {
          questionId: snapshot.id || null,
          questionCode: snapshot.questionCode || null,
          sourceMaterialId: options.sourceMaterialId || null,
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
            openai: openaiReview.tokenUsage,
            claude: claudeReview.tokenUsage,
            grok: grokReview.tokenUsage,
            totalCostUsd:
              geminiReview.tokenUsage.estimatedCostUsd +
              openaiReview.tokenUsage.estimatedCostUsd +
              claudeReview.tokenUsage.estimatedCostUsd +
              grokReview.tokenUsage.estimatedCostUsd,
          } as any,
        },
      });
      auditId = created.id;
    } catch (dbErr) {
      console.error("[MultiModelHub] Error persisting audit to database:", dbErr);
    }
  }

  return {
    questionSnapshot: snapshot,
    geminiReview,
    openaiReview,
    claudeReview,
    grokReview,
    mathValidation,
    chemValidation,
    finalDecision,
    auditId,
  };
}

export async function generateAndAuditQuestion(
  request: GenerateGroundedQuestionRequest,
  sourceContext?: string,
  options?: { userId?: string }
): Promise<CompleteReviewPayload> {
  // Step 1: Gemini Generation
  const generatedSnapshot = await generateQuestionWithGemini(request, sourceContext);

  // Step 2-4: Multi-model L1, L2, L3, L4 Review + Deterministic Validation
  return runMultiModelAudit(generatedSnapshot, sourceContext, {
    persist: true,
    userId: options?.userId,
    sourceMaterialId: request.sourceMaterialId,
  });
}
