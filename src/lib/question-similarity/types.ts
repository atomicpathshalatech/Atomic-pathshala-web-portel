// src/question-similarity/types.ts

export type SimilarityLevel =
  | "LOW_SIMILARITY"      // 0–29% (🟢)
  | "SIMILAR"             // 30–69% (🟡)
  | "HIGHLY_SIMILAR"      // 70–89% (🔴)
  | "EXACT_OR_NEAR_DUPLICATE"; // 90–100% (🔴)

export interface DiffToken {
  text: string;
  isMatched: boolean;
  isNumber?: boolean;
  isFormula?: boolean;
}

export interface HighlightedComparison {
  originalTokens: DiffToken[];
  newTokens: DiffToken[];
  matchedPhrases: string[];
}

export interface SimilarityMatch {
  questionId: string;
  questionCode: string;
  statementEn: string;
  statementHi?: string | null;
  subject: string;
  chapter?: string | null;
  topic?: string | null;
  subTopic?: string | null;
  difficulty?: string;
  optionsEn?: Record<string, string> | null;
  optionsHi?: Record<string, string> | null;
  correctAnswer?: string[];
  solutionEn?: string | null;
  
  // Core Similarity Metrics
  exactDuplicatePct: number;    // 0 - 100
  contentSimilarityPct: number; // 0 - 100 (semantics, concepts, keywords)
  structuralSimilarityPct: number; // 0 - 100 (formula pattern, sentence structure, numbers stripped)
  overallSimilarityPct: number; // 0 - 100 (weighted composite score)

  classification: SimilarityLevel;
  highlightedDiff?: HighlightedComparison;
}

export interface SimilarityReport {
  overallScore: number;         // 0 - 100 (highest match score)
  classification: SimilarityLevel;
  duplicateDetected: boolean;   // true if overallScore >= 70%
  isExactDuplicate: boolean;    // true if overallScore >= 90%
  highestMatch: SimilarityMatch | null;
  totalMatchesFound: number;
  matches: SimilarityMatch[];
  analysisTimeMs: number;
}

export interface QuestionInputForDetection {
  id?: string;
  questionCode?: string;
  statementEn: string;
  statementHi?: string;
  optionsEn?: Record<string, string>;
  optionsHi?: Record<string, string>;
  correctAnswer?: string[];
  subject?: string;
  chapter?: string;
  topic?: string;
  excludeQuestionId?: string;
}
