/**
 * ANSWER KEY & SOLUTION EXTRACTION ENGINE
 *
 * Scans for Answer Key sections (e.g. tables or lists: 1-B, 2-C, 3-A...).
 * Maps each key strictly to its question number.
 * Detects missing answers, invalid option symbols, and answer-solution conflicts.
 */

export interface ExtractedAnswerKey {
  questionNumber: number;
  answer: "A" | "B" | "C" | "D";
  rawKeyText: string;
  sourcePage: number;
}

export interface ExtractedSolution {
  questionNumber: number;
  solutionText: string;
  inferredAnswer?: "A" | "B" | "C" | "D";
  sourcePage: number;
}

export interface AnswerKeyValidationResult {
  answersMap: Map<number, ExtractedAnswerKey>;
  solutionsMap: Map<number, ExtractedSolution>;
  missingAnswers: number[];
  invalidAnswers: Array<{ questionNumber: number; raw: string }>;
  conflicts: Array<{
    questionNumber: number;
    answerKeyAnswer: string;
    solutionAnswer: string;
  }>;
}

/**
 * Scans document for Answer Key blocks
 */
export function extractAnswerKey(
  fullDocumentText: string,
  startNumber: number = 1,
  endNumber: number = 180
): Map<number, ExtractedAnswerKey> {
  const map = new Map<number, ExtractedAnswerKey>();

  // Look for Answer Key section headers
  const answerSectionRegex = /(?:ANSWER\s*KEY|ANSWERS|उत्तर\s*कुंजी|HINTS\s*&\s*SOLUTIONS)[\s\S]*$/i;
  const sectionMatch = fullDocumentText.match(answerSectionRegex);
  const searchTarget = sectionMatch ? sectionMatch[0] : fullDocumentText;

  // Patterns:
  // "1. (B)" | "1 - B" | "1: B" | "1	B" | "Q1 -> B" | "1 B"
  const pairRegex = /(?:(?:Q|Q\.)?\s*([0-9]{1,4})\s*[:\.\-\t\)]*\s*[\(\[]?([A-D1-4])[\)\]]?)/gi;

  const matches = Array.from(searchTarget.matchAll(pairRegex));

  for (const m of matches) {
    const qNum = parseInt(m[1] || "0", 10);
    const rawVal = (m[2] || "").toUpperCase();

    if (qNum >= startNumber && qNum <= endNumber) {
      let resolved: "A" | "B" | "C" | "D" = "A";
      if (rawVal === "1" || rawVal === "A") resolved = "A";
      else if (rawVal === "2" || rawVal === "B") resolved = "B";
      else if (rawVal === "3" || rawVal === "C") resolved = "C";
      else if (rawVal === "4" || rawVal === "D") resolved = "D";
      else continue;

      if (!map.has(qNum)) {
        map.set(qNum, {
          questionNumber: qNum,
          answer: resolved,
          rawKeyText: m[0],
          sourcePage: 1,
        });
      }
    }
  }

  return map;
}

/**
 * Extracts step-by-step solutions linked to question numbers
 */
export function extractSolutions(
  fullDocumentText: string,
  startNumber: number = 1,
  endNumber: number = 180
): Map<number, ExtractedSolution> {
  const map = new Map<number, ExtractedSolution>();

  // Look for Solutions section
  const solHeaderRegex = /(?:HINTS\s*&\s*SOLUTIONS|EXPLANATIONS|SOLUTIONS|हल\s*एवं\s*व्याख्या)[\s\S]*$/i;
  const solMatch = fullDocumentText.match(solHeaderRegex);
  if (!solMatch) return map;

  const solText = solMatch[0];
  const solItemRegex = /(?:^|\n)(?:Sol(?:ution|\.)?\s*([0-9]{1,4})\s*[:\.\)-]|([0-9]{1,4})\s*[\.\)]\s+)/gi;
  const matches = Array.from(solText.matchAll(solItemRegex));

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    if (!current) continue;
    const next = matches[i + 1];

    const qNum = parseInt(current[1] || current[2] || "0", 10);
    if (isNaN(qNum) || qNum < startNumber || qNum > endNumber) continue;

    const sIdx = (current.index ?? 0) + current[0].length;
    const eIdx = next && next.index !== undefined ? next.index : solText.length;
    const content = solText.substring(sIdx, eIdx).trim();

    // Check inferred answer in solution: "Hence, option (B) is correct"
    let inferred: "A" | "B" | "C" | "D" | undefined;
    const ansInSol = content.match(/(?:option|correct\s*option|ans(?:wer)?)\s*[:=-]?\s*[\(\[]?([A-D1-4])[\)\]]?/i);
    if (ansInSol && ansInSol[1]) {
      const v = ansInSol[1].toUpperCase();
      if (v === "1" || v === "A") inferred = "A";
      else if (v === "2" || v === "B") inferred = "B";
      else if (v === "3" || v === "C") inferred = "C";
      else if (v === "4" || v === "D") inferred = "D";
    }

    if (!map.has(qNum)) {
      map.set(qNum, {
        questionNumber: qNum,
        solutionText: content,
        inferredAnswer: inferred,
        sourcePage: 1,
      });
    }
  }

  return map;
}
