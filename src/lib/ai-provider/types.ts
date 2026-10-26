/**
 * ATOMIC PATHSHALA — MULTI-AI QUESTION INTELLIGENCE & QC ENGINE
 * Shared Types & Interfaces
 */

export type ModelProvider = "gemini" | "openai" | "claude";

export type QualityStatus =
  | "APPROVED_BY_ALL"
  | "APPROVED_AFTER_VERIFICATION"
  | "REJECTED_BY_GEMINI"
  | "REJECTED_BY_OPENAI"
  | "REJECTED_BY_CLAUDE"
  | "NCERT_MISMATCH"
  | "ANSWER_KEY_MISMATCH"
  | "SOLUTION_ERROR"
  | "SCIENTIFIC_ERROR"
  | "TOPIC_MISMATCH"
  | "SOURCE_UNVERIFIED"
  | "MANUAL_REVIEW_REQUIRED"
  | "API_FAILURE";

export type ReviewDecision = "APPROVE" | "REJECT" | "NEEDS_REVISION";

export type NcertSupportStatus =
  | "DIRECT"       // Directly supported by NCERT text/diagram
  | "DERIVED"      // Conceptually derived from NCERT
  | "SUPPLEMENTARY"// Supported by Allen or other reference material
  | "UNVERIFIED"   // Cannot verify against available sources
  | "CONTRADICTED"; // Contradicts NCERT statement

export interface NcertAlignmentResult {
  supported: boolean;
  status: NcertSupportStatus;
  book?: string;
  classLevel?: string;
  chapter?: string;
  pageNumber?: number;
  citation?: string;
  quote?: string;
  explanation?: string;
}

export interface QuestionOptionItem {
  key: string; // "A", "B", "C", "D"
  text: string;
}

export interface SourceReference {
  materialId?: string;
  sourceType: string; // "NCERT_TEXTBOOK" | "ALLEN_MODULE" | "PYQ" | "FACULTY_NOTES"
  bookTitle?: string;
  chapterNumber?: number;
  chapterTitle?: string;
  pageNumber?: number;
  section?: string;
  quoteOrFigure?: string;
}

export interface QuestionSnapshot {
  id?: string;
  questionCode?: string;
  statement: string;
  options: Record<string, string>; // { A: "...", B: "...", C: "...", D: "..." }
  storedAnswer: string[];          // ["A"] or ["B", "C"]
  solution: string;
  subject: string;
  classLevel?: string;
  chapter?: string;
  topic?: string;
  subTopic?: string;
  difficulty?: "EASY" | "MEDIUM" | "HARD" | "ULTRA";
  type?: string;                   // SINGLE_CORRECT | ASSERTION_REASON | STATEMENT | MATCH
  language?: "ENGLISH" | "HINDI" | "BOTH";
  diagramUrl?: string;
  sourceReferences?: SourceReference[];
}

export interface SingleModelReview {
  provider: ModelProvider;
  model: string;
  solvedAnswer: string;            // The model's own independent answer
  answerMatches: boolean;          // Does solvedAnswer match storedAnswer?
  isScientificallyCorrect: boolean;
  isMathematicallyCorrect: boolean;
  scientificErrors: string[];
  mathematicalErrors: string[];
  solutionCorrections: string | null;
  suggestedQuestion: string | null;
  suggestedOptions: Record<string, string> | null;
  suggestedAnswer: string[] | null;
  topicCorrections: {
    subject?: string;
    chapter?: string;
    topic?: string;
    subTopic?: string;
  } | null;
  ncertAlignment: NcertAlignmentResult;
  ambiguityDetected: boolean;
  multipleCorrectOptionsDetected: boolean;
  decision: ReviewDecision;
  rejectionReasons: string[];
  confidenceScore: number;        // 0.0 - 1.0 calibrated
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
    durationMs: number;
    estimatedCostUsd: number;
  };
  apiError?: {
    isApiError: boolean;
    errorType: "AUTH_ERROR" | "INSUFFICIENT_CREDITS" | "RATE_LIMIT" | "NETWORK_ERROR" | "CONFIG_ERROR";
    message: string;
    sanitizedDetails?: string;
  };
  rawOutput?: string;
}

export interface MathematicalValidationResult {
  valid: boolean;
  syntaxErrors: string[];          // KaTeX syntax errors
  arithmeticErrors: string[];      // Checked calculations
  detectedEquations: string[];
  details?: Record<string, any>;
}

export interface ChemicalValidationResult {
  valid: boolean;
  chargeBalanced: boolean;
  bracketBalanced: boolean;
  errors: string[];
  detectedFormulas: string[];
  ionDiscrepancies: string[];
  details?: Record<string, any>;
}

export interface FinalQualityDecision {
  finalQuestion: string;
  finalOptions: Record<string, string>;
  finalAnswerKey: string[];
  finalSolution: string;
  subject: string;
  chapter: string;
  topic: string;
  subTopic: string;
  
  // Independent Model verdicts
  geminiDecision: ReviewDecision;
  openaiDecision: ReviewDecision;
  claudeDecision: ReviewDecision;
  
  // Specialized validations
  ncertValidation: NcertAlignmentResult;
  mathValidation: MathematicalValidationResult;
  chemValidation: ChemicalValidationResult;
  
  // Disagreements across all models & checks
  disagreements: string[];
  
  // Final composite status
  finalStatus: QualityStatus;
  reasons: string[];
  eligibleForApproval: boolean;
  
  // Timestamp
  evaluatedAt: string;
}

export interface CompleteReviewPayload {
  questionSnapshot: QuestionSnapshot;
  geminiReview: SingleModelReview;
  openaiReview: SingleModelReview;
  claudeReview: SingleModelReview;
  mathValidation: MathematicalValidationResult;
  chemValidation: ChemicalValidationResult;
  finalDecision: FinalQualityDecision;
  auditId?: string;
}

export interface GenerateGroundedQuestionRequest {
  subject: string;
  classLevel: string;
  chapter: string;
  topic?: string;
  subTopic?: string;
  difficulty?: "EASY" | "MEDIUM" | "HARD" | "ULTRA";
  questionType?: "SINGLE_CORRECT" | "ASSERTION_REASON" | "STATEMENT" | "MATCH";
  sourceMaterialId?: string;
  sourceChunkIds?: string[];
  targetCount?: number;
  language?: "ENGLISH" | "HINDI" | "BOTH";
  customInstructions?: string;
}
