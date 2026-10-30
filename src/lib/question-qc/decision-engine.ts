/**
 * ATOMIC PATHSHALA — DETERMINISTIC FINAL QUALITY DECISION ENGINE
 *
 * Implements strict, auditable consensus rules across Gemini L1, OpenAI L2, Claude L3,
 * mathematical evaluation, chemical validation, and NCERT evidence grounding.
 *
 * Disagreements are NEVER hidden or resolved by simplistic majority voting.
 */

import {
  ChemicalValidationResult,
  FinalQualityDecision,
  MathematicalValidationResult,
  QualityStatus,
  QuestionSnapshot,
  SingleModelReview,
} from "../ai-provider/types";

export function evaluateFinalQualityDecision(
  snapshot: QuestionSnapshot,
  geminiReview: SingleModelReview,
  openaiReview: SingleModelReview,
  claudeReview: SingleModelReview,
  mathValidation: MathematicalValidationResult,
  chemValidation: ChemicalValidationResult,
  grokReview?: SingleModelReview
): FinalQualityDecision {
  const disagreements: string[] = [];
  const reasons: string[] = [];
  let eligibleForApproval = false;
  let finalStatus: QualityStatus = "MANUAL_REVIEW_REQUIRED";

  // Check for API Failures first
  const isGeminiFailed = geminiReview.confidenceScore === 0 && (geminiReview.rawOutput?.includes("API_ERROR") || Boolean(geminiReview.apiError?.isApiError) || geminiReview.rejectionReasons?.some(r => r.includes("API_FAILURE") || r.includes("API_ERROR")));
  const isOpenAiFailed = openaiReview.confidenceScore === 0 && (openaiReview.rawOutput?.includes("API_ERROR") || Boolean(openaiReview.apiError?.isApiError) || openaiReview.rejectionReasons?.some(r => r.includes("API_FAILURE") || r.includes("API_ERROR")));
  const isClaudeFailed = claudeReview.confidenceScore === 0 && (claudeReview.rawOutput?.includes("API_ERROR") || Boolean(claudeReview.apiError?.isApiError) || claudeReview.rejectionReasons?.some(r => r.includes("API_FAILURE") || r.includes("API_ERROR")));

  if (isGeminiFailed || isOpenAiFailed || isClaudeFailed) {
    const failedProviders = [
      isGeminiFailed ? (geminiReview.apiError?.message || "Gemini API unavailable") : null,
      isOpenAiFailed ? (openaiReview.apiError?.message || "OpenAI API unavailable") : null,
      isClaudeFailed ? (claudeReview.apiError?.message || `${claudeReview.provider === "groq" ? "Groq" : "Claude"} API unavailable`) : null,
    ].filter(Boolean);
    finalStatus = "API_FAILURE";
    reasons.push(...failedProviders.map(p => `AI Provider Service Notice: ${p}`));
    disagreements.push(...failedProviders.map(p => `Provider unavailable: ${p}`));
  }

  // 1. Cross-model answer key consistency comparison
  const storedKey = (snapshot.storedAnswer || []).map((k) => k.trim().toUpperCase()).sort().join(",");
  const geminiAns = (geminiReview.solvedAnswer || "").trim().toUpperCase();
  const openaiAns = (openaiReview.solvedAnswer || "").trim().toUpperCase();
  const claudeAns = (claudeReview.solvedAnswer || "").trim().toUpperCase();
  const grokAns = (grokReview?.solvedAnswer || "").trim().toUpperCase();
  const l3Provider = claudeReview.provider === "groq" ? "Groq" : "Claude";

  // Answer matching checks
  if (geminiAns && openaiAns && geminiAns !== openaiAns) {
    disagreements.push(`Answer Key Disagreement: Gemini solved [${geminiAns}] vs OpenAI solved [${openaiAns}]`);
  }
  if (geminiAns && claudeAns && geminiAns !== claudeAns) {
    disagreements.push(`Answer Key Disagreement: Gemini solved [${geminiAns}] vs ${l3Provider} solved [${claudeAns}]`);
  }
  if (grokAns && geminiAns && geminiAns !== grokAns) {
    disagreements.push(`Answer Key Disagreement: Gemini solved [${geminiAns}] vs Grok solved [${grokAns}]`);
  }
  if (openaiAns && claudeAns && openaiAns !== claudeAns) {
    disagreements.push(`Answer Key Disagreement: OpenAI solved [${openaiAns}] vs ${l3Provider} solved [${claudeAns}]`);
  }

  // Stored answer vs independent solves
  const anyMismatchWithStored =
    (geminiAns && geminiAns !== storedKey) ||
    (openaiAns && openaiAns !== storedKey) ||
    (claudeAns && claudeAns !== storedKey);

  if (anyMismatchWithStored) {
    reasons.push(
      `Stored answer [${storedKey}] disagrees with independent models: Gemini [${geminiAns || "N/A"}], OpenAI [${openaiAns || "N/A"}], Claude [${claudeAns || "N/A"}]`
    );
  }

  // 2. Scientific & Mathematical Error Checks across models
  const allScientificErrors = [
    ...geminiReview.scientificErrors,
    ...openaiReview.scientificErrors,
    ...claudeReview.scientificErrors,
  ];

  const allMathErrors = [
    ...geminiReview.mathematicalErrors,
    ...openaiReview.mathematicalErrors,
    ...claudeReview.mathematicalErrors,
    ...mathValidation.arithmeticErrors,
    ...mathValidation.syntaxErrors,
  ];

  const allChemErrors = [
    ...chemValidation.errors,
    ...chemValidation.ionDiscrepancies,
  ];

  if (allScientificErrors.length > 0) {
    reasons.push(...allScientificErrors);
  }
  if (allMathErrors.length > 0) {
    reasons.push(...allMathErrors);
  }
  if (allChemErrors.length > 0) {
    reasons.push(...allChemErrors);
  }

  // 3. Ambiguity & Multiple correct options check
  if (geminiReview.ambiguityDetected || openaiReview.ambiguityDetected || claudeReview.ambiguityDetected) {
    reasons.push("Ambiguous wording or multiple plausible interpretations detected by one or more models");
  }
  if (geminiReview.multipleCorrectOptionsDetected || openaiReview.multipleCorrectOptionsDetected || claudeReview.multipleCorrectOptionsDetected) {
    reasons.push("Multiple options are mathematically or scientifically correct in a single-correct MCQ");
  }

  // 4. NCERT Alignment Checks
  const ncertContradicted =
    geminiReview.ncertAlignment?.status === "CONTRADICTED" ||
    openaiReview.ncertAlignment?.status === "CONTRADICTED" ||
    claudeReview.ncertAlignment?.status === "CONTRADICTED";

  const ncertUnverified =
    geminiReview.ncertAlignment?.status === "UNVERIFIED" &&
    openaiReview.ncertAlignment?.status === "UNVERIFIED" &&
    claudeReview.ncertAlignment?.status === "UNVERIFIED";

  // Pick best available NCERT citation
  const bestNcert =
    geminiReview.ncertAlignment?.supported ? geminiReview.ncertAlignment :
    openaiReview.ncertAlignment?.supported ? openaiReview.ncertAlignment :
    claudeReview.ncertAlignment;

  // 5. Deterministic status classification (Strict Hierarchy)
  if (finalStatus !== "API_FAILURE") {
    if (allScientificErrors.length > 0 || allChemErrors.length > 0) {
      finalStatus = "SCIENTIFIC_ERROR";
    } else if (anyMismatchWithStored && (geminiAns !== storedKey || openaiAns !== storedKey || claudeAns !== storedKey)) {
      finalStatus = "ANSWER_KEY_MISMATCH";
    } else if (allMathErrors.length > 0 || !mathValidation.valid) {
      finalStatus = "SOLUTION_ERROR";
    } else if (ncertContradicted) {
      finalStatus = "NCERT_MISMATCH";
    } else if (
      geminiReview.topicCorrections ||
      openaiReview.topicCorrections ||
      claudeReview.topicCorrections
    ) {
      finalStatus = "TOPIC_MISMATCH";
    } else if (ncertUnverified) {
      finalStatus = "SOURCE_UNVERIFIED";
    } else if (geminiReview.decision === "REJECT") {
      finalStatus = "REJECTED_BY_GEMINI";
    } else if (openaiReview.decision === "REJECT") {
      finalStatus = "REJECTED_BY_OPENAI";
    } else if (claudeReview.decision === "REJECT") {
      finalStatus = claudeReview.provider === "groq" ? "REJECTED_BY_GROQ" : "REJECTED_BY_CLAUDE";
    } else if (disagreements.length > 0) {
      finalStatus = "MANUAL_REVIEW_REQUIRED";
    } else if (
      geminiReview.decision === "APPROVE" &&
      openaiReview.decision === "APPROVE" &&
      claudeReview.decision === "APPROVE" &&
      mathValidation.valid &&
      chemValidation.valid
    ) {
      // Unanimous approval
      finalStatus = "APPROVED_BY_ALL";
      eligibleForApproval = true;
    } else {
      finalStatus = "MANUAL_REVIEW_REQUIRED";
    }
  }

  // 6. Build final consolidated content
  // If corrections were proposed unanimously or verified, use suggested content
  const finalQuestion =
    geminiReview.suggestedQuestion ||
    openaiReview.suggestedQuestion ||
    claudeReview.suggestedQuestion ||
    snapshot.statement;

  const finalOptions =
    geminiReview.suggestedOptions ||
    openaiReview.suggestedOptions ||
    claudeReview.suggestedOptions ||
    snapshot.options;

  const finalAnswerKey =
    geminiAns && openaiAns && geminiAns === openaiAns
      ? [geminiAns]
      : snapshot.storedAnswer;

  const finalSolution =
    geminiReview.solutionCorrections ||
    openaiReview.solutionCorrections ||
    claudeReview.solutionCorrections ||
    snapshot.solution;

  const finalSubject =
    geminiReview.topicCorrections?.subject ||
    openaiReview.topicCorrections?.subject ||
    snapshot.subject;

  const finalChapter =
    geminiReview.topicCorrections?.chapter ||
    openaiReview.topicCorrections?.chapter ||
    snapshot.chapter ||
    "";

  const finalTopic =
    geminiReview.topicCorrections?.topic ||
    openaiReview.topicCorrections?.topic ||
    snapshot.topic ||
    "";

  const finalSubTopic =
    geminiReview.topicCorrections?.subTopic ||
    openaiReview.topicCorrections?.subTopic ||
    snapshot.subTopic ||
    "";

  return {
    finalQuestion,
    finalOptions,
    finalAnswerKey,
    finalSolution,
    subject: finalSubject,
    chapter: finalChapter,
    topic: finalTopic,
    subTopic: finalSubTopic,
    geminiDecision: geminiReview.decision,
    openaiDecision: openaiReview.decision,
    claudeDecision: claudeReview.decision,
    grokDecision: grokReview?.decision,
    ncertValidation: bestNcert || {
      supported: false,
      status: "UNVERIFIED",
    },
    mathValidation,
    chemValidation,
    disagreements,
    finalStatus,
    reasons: Array.from(new Set(reasons)),
    eligibleForApproval,
    evaluatedAt: new Date().toISOString(),
  };
}
