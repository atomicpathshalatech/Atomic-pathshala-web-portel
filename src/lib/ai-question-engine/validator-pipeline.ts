import { prisma } from "@/lib/db";
import { analyzeQuestionSimilarity } from "@/lib/questions/similarity";
import { isOptionBasedType } from "@/lib/questions/create-with-code";
import { AIProvider } from "./provider-interface";
import { matchSelectedTopic } from "./gemini-provider";
import {
  QuestionQualityScores,
  QuestionValidationReport,
  RawAiGeneratedQuestion,
} from "./types";

const AI_CHECK_TIMEOUT_MS = 60_000;

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`AI check timed out after ${Math.round(ms / 1000)}s`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

const sameAnswer = (a: string[] = [], b: string[] = []) => {
  const x = Array.from(new Set(a.map((s) => s.trim().toUpperCase()))).sort().join(",");
  const y = Array.from(new Set(b.map((s) => s.trim().toUpperCase()))).sort().join(",");
  return x !== "" && x === y;
};

/**
 * Multi-stage validation for one AI-generated question.
 *
 * Before this fix the "independent AI solver" was never called: the report
 * copied the generator's own answer as "solver verified", and every quality
 * score was a hard-coded 95–97 — so any question with a well-formed JSON
 * shape PASSED, including wrong answers and off-topic questions. Now:
 *  1. Structural checks (options, answer key in options, solution, languages).
 *  2. Topic check against the topics the teacher selected.
 *  3. Duplicate check (question bank + this batch).
 *  4. The AI auditor really solves it; a different answer → ANSWER_VALIDATION_FAILED,
 *     ambiguity / unsound / off-topic → NEEDS_REVIEW. If the audit can't run,
 *     the question goes to review (never auto-passes).
 *  5. Quality scores come from the auditor; without an audit they stay 0.
 */
export async function runQuestionValidationPipeline({
  question,
  aiProvider,
  batchQuestionsSoFar = [],
  allowedTopics = [],
}: {
  question: RawAiGeneratedQuestion;
  aiProvider: AIProvider;
  batchQuestionsSoFar?: RawAiGeneratedQuestion[];
  /** Topics the teacher selected for the batch (empty = any topic of the chapter). */
  allowedTopics?: string[];
}): Promise<{
  report: QuestionValidationReport;
  scores: QuestionQualityScores;
}> {
  const issues: string[] = [];
  const blocking: string[] = []; // problems that make the question unusable as-is

  // ==========================================
  // STAGE 1: STRUCTURAL VALIDATION
  // ==========================================
  const hasEn = Boolean(question.statementEn?.trim());
  const hasHi = Boolean(question.statementHi?.trim());
  if (!hasEn && !hasHi) blocking.push("Question statement is completely empty.");

  const optionBased = isOptionBasedType(question.questionType);
  const optsEn = (question.optionsEn || {}) as Record<string, string>;
  const optsHi = (question.optionsHi || {}) as Record<string, string>;
  const filled = (o: Record<string, string>) => ["A", "B", "C", "D"].filter((k) => String(o[k] ?? "").trim());

  if (optionBased) {
    const primary = hasEn ? optsEn : optsHi;
    if (filled(primary).length < 4) blocking.push("Options A–D are incomplete.");
    if (!question.correctAnswer?.length) {
      blocking.push("No correct answer given.");
    } else {
      const invalid = question.correctAnswer.filter((k) => !["A", "B", "C", "D"].includes(k) || !String(primary[k] ?? "").trim());
      if (invalid.length) blocking.push(`Correct answer '${invalid.join(", ")}' is not one of the options.`);
      if (question.questionType.toUpperCase().includes("SINGLE") && question.correctAnswer.length !== 1) {
        blocking.push("Single-correct question has more than one answer marked.");
      }
    }
  } else if (!question.correctAnswer?.length) {
    blocking.push("No numerical answer given.");
  }

  if (!question.solutionEn?.trim() && !question.solutionHi?.trim()) issues.push("Solution is missing.");

  // Visual / Image Dependency Enforcement (Section 93, 102, 119)
  const isVisualType =
    question.questionType === "DIAGRAM_BASED" ||
    question.questionType === "IMAGE_BASED" ||
    question.questionType === "GRAPH_BASED" ||
    question.primaryNature === "Diagram-Based" ||
    question.primaryNature === "Graph-Based" ||
    question.requiresImage;

  if (isVisualType) {
    if (!question.sourceImageId && !question.requiresImage) {
      blocking.push("Visual question requested but no image/diagram asset is attached.");
    }
    const depScore = question.imageDependencyScore ?? (question.sourceImageId ? 85 : 0);
    if (depScore < 60 && !blocking.length) {
      issues.push(`Image dependency score is low (${depScore}% < 60%). The question may not strictly require the diagram.`);
    }
  }

  // Languages actually requested must be present (statement AND options).
  if (question.language === "BOTH" || question.language === "HINDI") {
    if (!hasHi) blocking.push("Hindi statement is missing.");
    if (optionBased && filled(optsHi).length < 4) blocking.push("Hindi options are missing or incomplete.");
  }
  if ((question.language === "BOTH" || question.language === "ENGLISH") && !hasEn) {
    blocking.push("English statement is missing.");
  }

  // ==========================================
  // STAGE 2: TOPIC RELEVANCE (selected topics)
  // ==========================================
  if (allowedTopics.length > 0 && !matchSelectedTopic(question.topic || "", allowedTopics)) {
    issues.push(`Topic "${question.topic || "—"}" is not one of the selected topics (${allowedTopics.join(", ")}).`);
  }

  // ==========================================
  // STAGE 3: DUPLICATE DETECTION (BANK + CURRENT BATCH)
  // ==========================================
  let highestSimScore = 0;
  let dupRisk: QuestionValidationReport["duplicateRisk"] = "NONE";
  let potentialDuplicateCode: string | undefined;

  try {
    const simReport = await analyzeQuestionSimilarity(prisma, {
      statementEn: question.statementEn,
      statementHi: question.statementHi,
      subject: question.subject,
      chapter: question.chapter,
      topic: question.topic,
      optionsEn: question.optionsEn,
      optionsHi: question.optionsHi,
    });
    highestSimScore = simReport.highestScore;
    dupRisk = simReport.duplicateRisk;
    if (simReport.highestMatch) {
      potentialDuplicateCode = simReport.highestMatch.questionCode;
      if (simReport.highestScore >= 85) {
        issues.push(`High similarity (${simReport.highestScore}%) with existing question ${simReport.highestMatch.questionCode}.`);
      }
    }
  } catch (err) {
    console.warn("[Validator] Bank similarity check warning:", err);
  }

  const key = (t?: string) => (t || "").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  for (const prevQ of batchQuestionsSoFar) {
    const a = key(question.statementEn || question.statementHi);
    const b = key(prevQ.statementEn || prevQ.statementHi);
    if (a.length > 20 && a === b) {
      highestSimScore = 100;
      dupRisk = "CRITICAL";
      blocking.push(`Identical duplicate of Q#${prevQ.questionIndex} in this batch.`);
      break;
    }
  }

  // ==========================================
  // STAGE 4: INDEPENDENT AI SOLVER (fail-closed)
  // ==========================================
  let ai: QuestionValidationReport | null = null;
  let aiError: string | null = null;
  if (blocking.length === 0) {
    try {
      ai = await withTimeout(
        aiProvider.validateQuestion({
          statementEn: question.statementEn || question.statementHi || "",
          statementHi: question.statementHi,
          optionsEn: hasEn ? optsEn : optsHi,
          optionsHi: question.optionsHi,
          correctAnswer: question.correctAnswer,
          solutionEn: question.solutionEn || question.solutionHi,
          subject: question.subject,
          chapter: question.chapter,
          questionType: question.questionType,
          topic: question.topic,
          allowedTopics,
        }),
        AI_CHECK_TIMEOUT_MS
      );
    } catch (err) {
      aiError = err instanceof Error ? err.message : String(err);
      issues.push("Independent AI answer check could not run — please verify the answer manually.");
    }
  }

  let status: QuestionValidationReport["validationStatus"] = blocking.length > 0 ? "FAILED" : "PASSED";

  if (ai) {
    if (ai.solverVerifiedAnswer?.length && !sameAnswer(ai.solverVerifiedAnswer, question.correctAnswer)) {
      issues.push(`AI solver got answer (${ai.solverVerifiedAnswer.join(", ")}) but the question says (${question.correctAnswer.join(", ")}).`);
      status = "ANSWER_VALIDATION_FAILED";
    }
    if (ai.isAmbiguous) issues.push(`Ambiguous: ${ai.ambiguityReason || "more than one option may be correct."}`);
    if (ai.isScientificallySound === false) issues.push("Auditor flagged the question as scientifically unsound.");
    if (ai.solutionConsistentWithAnswer === false) issues.push("Solution does not lead to the marked answer.");
    if (ai.topicRelevant === false) issues.push("Auditor: the question does not test the requested topic.");
    if (question.language === "BOTH" && ai.bilingualEquivalent === false) {
      issues.push(`Hindi and English versions differ${ai.bilingualDiscrepancies?.length ? `: ${ai.bilingualDiscrepancies.join("; ")}` : "."}`);
      if (status === "PASSED") status = "BILINGUAL_VALIDATION_FAILED";
    }
    for (const i of ai.issues || []) issues.push(i);
    if (status === "PASSED" && (ai.validationStatus === "FAILED" || ai.validationStatus === "ANSWER_VALIDATION_FAILED")) status = ai.validationStatus;
    if (ai.solverConfidence > 0 && ai.solverConfidence < 80) issues.push(`Low solver confidence (${ai.solverConfidence}%).`);
  }

  if (status === "PASSED" && (issues.length > 0 || !ai)) status = "NEEDS_REVIEW";

  // ==========================================
  // STAGE 5: QUALITY SCORES (from the auditor, not invented)
  // ==========================================
  const scores: QuestionQualityScores = ai?.qualityScore
    ? { ...ai.qualityScore }
    : { contentAccuracy: 0, answerConfidence: 0, ncertAlignment: 0, neetRelevance: 0, languageQuality: 0, overallScore: 0 };
  if (ai && !ai.qualityScore) {
    const conf = ai.solverConfidence || 0;
    scores.answerConfidence = conf;
    scores.overallScore = status === "PASSED" ? conf : Math.min(conf, 60);
  }

  const report: QuestionValidationReport = {
    isValid: status === "PASSED",
    validationStatus: status,
    solverVerifiedAnswer: ai?.solverVerifiedAnswer,
    solverConfidence: ai?.solverConfidence ?? 0,
    solverReasoning:
      ai?.solverReasoning || (aiError ? `AI check failed: ${aiError}` : blocking.length ? "Not audited — fix the structural problems first." : ""),
    isAmbiguous: ai?.isAmbiguous ?? false,
    ambiguityReason: ai?.ambiguityReason,
    isScientificallySound: ai?.isScientificallySound ?? true,
    solutionConsistentWithAnswer: ai?.solutionConsistentWithAnswer ?? true,
    duplicateScore: highestSimScore,
    duplicateRisk: dupRisk,
    potentialDuplicateCode,
    bilingualEquivalent: ai?.bilingualEquivalent ?? true,
    bilingualDiscrepancies: ai?.bilingualDiscrepancies ?? [],
    issues: Array.from(new Set([...blocking, ...issues])),
    aiValidated: Boolean(ai),
    topicRelevant: ai?.topicRelevant,
    qualityScore: ai?.qualityScore,
  };

  return { report, scores };
}
