import "server-only";
import { prisma } from "@/lib/db";
import { geminiKeyManager } from "@/lib/ai/gemini-key-manager";
import { reviewQuestionWithOpenAI } from "@/lib/ai-provider/openai";
import { QuestionSnapshot } from "@/lib/ai-provider/types";

export interface AIOrchestrationResult {
  confidence: number;
  reviewedByOpenAi: boolean;
  openAiDecision?: {
    isScientificallyCorrect: boolean;
    isMathematicallyCorrect: boolean;
    suggestedAnswer: string | null;
    scientificErrors: string[];
  };
  warnings: string[];
}

/**
 * Conditionally coordinates secondary AI verification (OpenAI GPT-4o).
 * Only invoked for high-risk or low-confidence cases (<80% or conflicting answers)
 * to strictly minimize AI expenditure.
 */
export async function conditionallyVerifyWithAI(input: {
  questionId?: string;
  statement: string;
  options: Record<string, string>;
  extractedAnswer?: string | null;
  sourceAnswerKey?: string | null;
  baseConfidence: number;
  subject?: string;
  chapter?: string;
}): Promise<AIOrchestrationResult> {
  const warnings: string[] = [];
  const start = Date.now();

  const answerConflict =
    input.extractedAnswer &&
    input.sourceAnswerKey &&
    input.extractedAnswer.trim().toUpperCase() !== input.sourceAnswerKey.trim().toUpperCase();

  const needsSecondaryReview = input.baseConfidence < 80 || Boolean(answerConflict);

  if (answerConflict) {
    warnings.push(
      `Conflicting answer detected: Extracted '${input.extractedAnswer}' vs Key '${input.sourceAnswerKey}'. Secondary review required.`
    );
  }

  // Cost optimization: Skip secondary review for clear, high-confidence extractions
  if (!needsSecondaryReview) {
    return {
      confidence: input.baseConfidence,
      reviewedByOpenAi: false,
      warnings,
    };
  }

  // Run secondary review with OpenAI GPT-4o
  try {
    const snapshot: QuestionSnapshot = {
      id: input.questionId || "draft",
      subject: input.subject || "General",
      chapter: input.chapter || null,
      statement: input.statement,
      options: input.options,
      storedAnswer: input.extractedAnswer ? [input.extractedAnswer] : [],
      storedSolution: null,
      language: /[ऀ-ॿ]/.test(input.statement) ? "HINDI" : "ENGLISH",
      questionType: "SINGLE_CORRECT",
      difficulty: "MEDIUM",
    };

    const review = await reviewQuestionWithOpenAI(snapshot);
    const durationMs = Date.now() - start;

    // Log AI usage telemetry
    await prisma.aiUsageLog.create({
      data: {
        feature: "PYQ_SECONDARY_VERIFICATION",
        provider: "openai",
        model: review.model || "gpt-4o",
        questionId: input.questionId,
        inputTokens: 500, // estimated
        outputTokens: 200,
        durationMs,
        ok: true,
      },
    }).catch(() => undefined);

    let finalConfidence = input.baseConfidence;
    if (review.isScientificallyCorrect && review.isMathematicallyCorrect) {
      finalConfidence = Math.max(finalConfidence, 88);
    } else {
      finalConfidence = Math.min(finalConfidence, 60);
      warnings.push(...review.scientificErrors);
    }

    return {
      confidence: finalConfidence,
      reviewedByOpenAi: true,
      openAiDecision: {
        isScientificallyCorrect: review.isScientificallyCorrect,
        isMathematicallyCorrect: review.isMathematicallyCorrect,
        suggestedAnswer: review.suggestedAnswer,
        scientificErrors: review.scientificErrors,
      },
      warnings,
    };
  } catch (err: any) {
    // Fail safely without blocking workflow
    warnings.push(`Secondary review skipped: ${err.message}`);
    return {
      confidence: input.baseConfidence,
      reviewedByOpenAi: false,
      warnings,
    };
  }
}
