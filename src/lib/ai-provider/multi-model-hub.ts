/**
 * ATOMIC PATHSHALA — MULTI-MODEL AI QUALITY CONTROL HUB
 * Coordinates Gemini L1, OpenAI L2, and Claude L3 independent reviews,
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
import { validateMathematics } from "../question-qc/math-validator";
import { validateChemistry } from "../question-qc/chemical-validator";
import { evaluateFinalQualityDecision } from "../question-qc/decision-engine";

export async function runMultiModelAudit(
  snapshot: QuestionSnapshot,
  sourceContext?: string,
  options?: {
    persist?: boolean;
    userId?: string;
    sourceMaterialId?: string;
  }
): Promise<CompleteReviewPayload> {
  // Execute all three independent AI reviews in parallel
  const [geminiResult, openaiResult, claudeResult] = await Promise.allSettled([
    reviewQuestionWithGemini(snapshot, sourceContext),
    reviewQuestionWithOpenAI(snapshot, sourceContext),
    // Prefer Groq as requested; fallback to Claude only if GROQ_API_KEY is not set but ANTHROPIC_API_KEY is
    process.env.GROQ_API_KEY || !process.env.ANTHROPIC_API_KEY
      ? reviewQuestionWithGroq(snapshot, sourceContext)
      : reviewQuestionWithClaude(snapshot, sourceContext),
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

  // Run deterministic math & chemical checks
  const mathValidation = validateMathematics(snapshot.statement, snapshot.solution);
  const chemValidation = validateChemistry(snapshot.statement, snapshot.solution);

  // Compute final quality decision using strict deterministic consensus logic
  const finalDecision = evaluateFinalQualityDecision(
    snapshot,
    geminiReview,
    openaiReview,
    claudeReview,
    mathValidation,
    chemValidation
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
            totalCostUsd:
              geminiReview.tokenUsage.estimatedCostUsd +
              openaiReview.tokenUsage.estimatedCostUsd +
              claudeReview.tokenUsage.estimatedCostUsd,
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

  // Step 2-4: Multi-model L1, L2, L3 Review + Deterministic Validation
  return runMultiModelAudit(generatedSnapshot, sourceContext, {
    persist: true,
    userId: options?.userId,
    sourceMaterialId: request.sourceMaterialId,
  });
}
