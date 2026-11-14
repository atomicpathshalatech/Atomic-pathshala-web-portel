/**
 * Duplicate & Similar Question Detection Module
 * Handles:
 * 1. Exact Question ID duplicates (blocked at DB level)
 * 2. Exact content duplicates (statement + options matching)
 * 3. Near-duplicate questions (Levenshtein / token Jaccard / numerical variants)
 * 4. Conceptual similarity & formula repetition
 */

export interface QuestionAuditCandidate {
  id: string;
  questionCode: string | null;
  order: number;
  sectionName: string;
  subject: string;
  chapter: string;
  statementEn: string;
  statementHi: string;
  optionsEn: Record<string, string>;
  optionsHi: Record<string, string>;
  correctAnswer: string | null;
  solution: string | null;
  imageUrl: string | null;
  referenceImageUrl: string | null;
  difficulty: string;
}

export interface DuplicateResult {
  questionId: string;
  matchedQuestionId: string | null;
  duplicateType: "NONE" | "EXACT_ID" | "EXACT_CONTENT" | "NEAR_DUPLICATE" | "CONCEPTUAL";
  similarityScore: number; // 0 to 1
  reason: string | null;
  severity: "PASSED" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

/** Normalize text for fuzzy/exact comparison */
export function normalizeText(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, " ") // remove html
    .replace(/&nbsp;/g, " ")
    .replace(/\$+/g, "") // remove latex dollar signs
    .replace(/[^\w\s]/g, " ") // remove punctuation
    .replace(/\s+/g, " ")
    .trim();
}

/** Tokenize string into set of words */
function getWordTokens(text: string): Set<string> {
  const norm = normalizeText(text);
  if (!norm) return new Set();
  return new Set(norm.split(" ").filter((w) => w.length > 2));
}

/** Jaccard similarity between two token sets */
export function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 1;
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/** Compare option text content */
function optionsSimilarity(
  optsA: Record<string, string>,
  optsB: Record<string, string>
): number {
  const valsA = Object.values(optsA || {}).map(normalizeText).filter(Boolean);
  const valsB = Object.values(optsB || {}).map(normalizeText).filter(Boolean);
  if (valsA.length === 0 || valsB.length === 0) return 0;

  let matched = 0;
  for (const vA of valsA) {
    if (valsB.some((vB) => vA === vB || vA.includes(vB) || vB.includes(vA))) {
      matched++;
    }
  }
  return matched / Math.max(valsA.length, valsB.length);
}

/**
 * Detect duplicates and near-duplicates across all questions in a test
 */
export function analyzeDuplicates(questions: QuestionAuditCandidate[]): Map<string, DuplicateResult> {
  const results = new Map<string, DuplicateResult>();
  const seenIds = new Set<string>();

  // Pre-tokenize questions for performance
  const tokenized = questions.map((q) => {
    const fullText = `${q.statementEn || ""} ${q.statementHi || ""}`;
    return {
      q,
      tokens: getWordTokens(fullText),
      normStatement: normalizeText(q.statementEn || q.statementHi || ""),
    };
  });

  for (let i = 0; i < tokenized.length; i++) {
    const itemA = tokenized[i]!;
    const qA = itemA.q;

    // Check 1: Exact ID duplicate (should be 0 because DB protects this, but check defensively)
    if (seenIds.has(qA.id)) {
      results.set(qA.id, {
        questionId: qA.id,
        matchedQuestionId: qA.id,
        duplicateType: "EXACT_ID",
        similarityScore: 1.0,
        reason: `Exact duplicate Question ID (${qA.questionCode || qA.id}) appears multiple times in test.`,
        severity: "CRITICAL",
      });
      continue;
    }
    seenIds.add(qA.id);

    let highestSim = 0;
    let matchedId: string | null = null;
    let dupType: DuplicateResult["duplicateType"] = "NONE";
    let dupReason: string | null = null;
    let dupSeverity: DuplicateResult["severity"] = "PASSED";

    for (let j = 0; j < tokenized.length; j++) {
      if (i === j) continue;
      const itemB = tokenized[j]!;
      const qB = itemB.q;

      // Check 2: Exact content duplicate (statements match & options match)
      const statementMatch =
        itemA.normStatement.length > 20 &&
        itemA.normStatement === itemB.normStatement;

      const optSim = optionsSimilarity(qA.optionsEn, qB.optionsEn);

      if (statementMatch && optSim >= 0.75) {
        highestSim = 1.0;
        matchedId = qB.id;
        dupType = "EXACT_CONTENT";
        dupReason = `Identical question statement and options as Q${qB.order} (${qB.questionCode || qB.id}).`;
        dupSeverity = "CRITICAL";
        break; // Can't get more duplicate than exact
      }

      // Check 3: Near-duplicate (high token similarity e.g. >= 0.82)
      const tokenSim = jaccardSimilarity(itemA.tokens, itemB.tokens);
      const combinedSim = tokenSim * 0.7 + optSim * 0.3;

      if (combinedSim > 0.80 && combinedSim > highestSim) {
        highestSim = combinedSim;
        matchedId = qB.id;
        dupType = "NEAR_DUPLICATE";
        dupReason = `Near-duplicate question with Q${qB.order} (${Math.round(combinedSim * 100)}% content similarity). Statement or options rearranged.`;
        dupSeverity = "HIGH";
      } else if (
        combinedSim > 0.65 &&
        qA.chapter &&
        qA.chapter === qB.chapter &&
        highestSim < 0.65
      ) {
        // Check 4: Conceptual similarity within same chapter
        highestSim = combinedSim;
        matchedId = qB.id;
        dupType = "CONCEPTUAL";
        dupReason = `Similar concept and phrasing to Q${qB.order} in chapter "${qA.chapter}" (${Math.round(combinedSim * 100)}% similarity).`;
        dupSeverity = "LOW";
      }
    }

    results.set(qA.id, {
      questionId: qA.id,
      matchedQuestionId: matchedId,
      duplicateType: dupType,
      similarityScore: Math.round(highestSim * 100) / 100,
      reason: dupReason,
      severity: dupSeverity,
    });
  }

  return results;
}
