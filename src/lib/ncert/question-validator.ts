import { CandidateNcertQuestion } from "./ai-generator";
import { NCERTLanguage } from "@prisma/client";

export interface ValidationResult {
  isValid: boolean;
  rejectReason?: string;
}

/**
 * Calculates word-level Jaccard similarity between two strings to detect duplicates.
 */
function jaccardSimilarity(str1: string, str2: string): number {
  const words1 = new Set(
    str1
      .toLowerCase()
      .replace(/[^\w\s\u0900-\u097F]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
  const words2 = new Set(
    str2
      .toLowerCase()
      .replace(/[^\w\s\u0900-\u097F]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );

  if (words1.size === 0 || words2.size === 0) return 0;

  let intersection = 0;
  for (const w of words1) {
    if (words2.has(w)) intersection++;
  }

  const union = new Set([...words1, ...words2]).size;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Multi-point validation layer for NCERT questions.
 * Enforces:
 * 1. Source page grounding: sourceTextReference keywords must exist in the pageText.
 * 2. Option validity: Exactly 4 distinct, non-empty options.
 * 3. Exactly one valid correct answer pointer.
 * 4. Language consistency (Hindi questions must use Devanagari script; English must use Latin).
 * 5. Deduplication: Not similar to existing questions in the page pool.
 */
export function validateNcertQuestion(
  candidate: CandidateNcertQuestion,
  pageText: string,
  language: NCERTLanguage,
  existingQuestions: string[] = []
): ValidationResult {
  const normPage = pageText.toLowerCase();

  // Check 1: Options formation
  if (!candidate.options || candidate.options.length !== 4) {
    return { isValid: false, rejectReason: "Must have exactly 4 options" };
  }

  const optionTexts = candidate.options.map((o) => o.text.trim().toLowerCase());
  const uniqueOptionTexts = new Set(optionTexts);
  if (uniqueOptionTexts.size !== 4) {
    return { isValid: false, rejectReason: "Options contain duplicate values" };
  }

  if (optionTexts.some((t) => t.length === 0)) {
    return { isValid: false, rejectReason: "One or more options are empty" };
  }

  // Check 2: Correct answer pointer
  if (!["A", "B", "C", "D"].includes(candidate.correctAnswer)) {
    return { isValid: false, rejectReason: "Correct answer must be A, B, C, or D" };
  }

  // Check 3: Language purity
  const qText = candidate.question.trim();
  if (qText.length < 10) {
    return { isValid: false, rejectReason: "Question text too short" };
  }

  if (language === "HINDI") {
    // Check for Devanagari script characters (Unicode \u0900-\u097F)
    const hasDevanagari = /[\u0900-\u097F]/.test(qText);
    if (!hasDevanagari) {
      return { isValid: false, rejectReason: "Selected language is Hindi, but question lacks Hindi text" };
    }
  }

  // Check 4: Source grounding
  const sourceRef = candidate.sourceTextReference?.trim().toLowerCase() || "";
  if (sourceRef.length < 10) {
    return { isValid: false, rejectReason: "Missing or insufficient source text reference" };
  }

  // Check if at least key words from sourceTextReference appear in the pageText
  const keyWords = sourceRef
    .replace(/[^\w\s\u0900-\u097F]/g, "")
    .split(/\s+/)
    .filter((w) => w.length >= 4);

  if (keyWords.length > 0) {
    let matchedWords = 0;
    for (const kw of keyWords) {
      if (normPage.includes(kw)) matchedWords++;
    }
    const matchRatio = matchedWords / keyWords.length;
    if (matchRatio < 0.4) {
      return {
        isValid: false,
        rejectReason: "Source text reference does not align with page text (possible hallucination)",
      };
    }
  }

  // Check 5: Deduplication against existing questions on this page
  for (const eq of existingQuestions) {
    const similarity = jaccardSimilarity(candidate.question, eq);
    if (similarity > 0.7) {
      return {
        isValid: false,
        rejectReason: `Too similar to an existing question (similarity: ${(similarity * 100).toFixed(1)}%)`,
      };
    }
  }

  return { isValid: true };
}
