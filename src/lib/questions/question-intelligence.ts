/**
 * ATOMIC PATHSHALA — QUESTION INTELLIGENCE ENGINE
 * Comprehensive Academic & Quality Validation for NEET / JEE
 *
 * Implements:
 * - 100-Point Multi-Factor Quality Score
 * - Strict Critical Error Gate & Override
 * - Automatic Approval Rules
 * - Cognitive Levels (L1 to L6)
 * - Question Nature Classifications (14 Types)
 * - NCERT Grounding & Anti-Hallucination
 * - NEET Relevance Categorization (A, B, C, D)
 * - Multi-Concept Detection & Dependency Mapping
 * - Compact Solution Verification
 * - Canonical Question (QR) & Solution (SR) Reference Identifiers
 */

export type QuestionNature =
  | "Conceptual"
  | "Numerical"
  | "Analytical"
  | "Application-Based"
  | "Logical"
  | "Reasoning-Based"
  | "Memory-Based"
  | "Factual"
  | "Diagram-Based"
  | "Graph-Based"
  | "Experimental"
  | "Data-Based"
  | "Case-Based"
  | "Multi-Concept";

export const QUESTION_NATURES: QuestionNature[] = [
  "Conceptual",
  "Numerical",
  "Analytical",
  "Application-Based",
  "Logical",
  "Reasoning-Based",
  "Memory-Based",
  "Factual",
  "Diagram-Based",
  "Graph-Based",
  "Experimental",
  "Data-Based",
  "Case-Based",
  "Multi-Concept",
];

export type CognitiveLevel = "L1" | "L2" | "L3" | "L4" | "L5" | "L6";

export const COGNITIVE_LEVEL_INFO: Record<CognitiveLevel, { label: string; description: string; target: string }> = {
  L1: { label: "L1 — Recall", description: "Direct memory retrieval of definitions, facts, formulas, or units.", target: "Direct Recall" },
  L2: { label: "L2 — Understand", description: "Comprehension of concepts, principles, and direct interpretations.", target: "Conceptual Understanding" },
  L3: { label: "L3 — Apply", description: "Application of rules, formulas, or methods to standard problems.", target: "Standard Problem Solving" },
  L4: { label: "L4 — Analyze", description: "Decomposing complex situations, analyzing graphs, identifying hidden constraints.", target: "Analytical Thinking" },
  L5: { label: "L5 — Evaluate", description: "Judging scientific validity, evaluating multiple statements or experimental outcomes.", target: "Evaluation & Reasoning" },
  L6: { label: "L6 — Synthesis / Multi-Concept", description: "Integrating at least 2 distinct concepts or principles across topics/chapters.", target: "Multi-Concept Synthesis" },
};

export type NeetRelevanceCategory = "A" | "B" | "C" | "D";

export function getNeetRelevanceCategory(score: number): { category: NeetRelevanceCategory; label: string } {
  if (score >= 85) return { category: "A", label: "A — Highly Relevant (85-100)" };
  if (score >= 70) return { category: "B", label: "B — Relevant (70-84)" };
  if (score >= 50) return { category: "C", label: "C — Peripheral (50-69)" };
  return { category: "D", label: "D — Low / Irrelevant (0-49)" };
}

export type NcertAlignmentStatus =
  | "Direct"
  | "Conceptual"
  | "Derived"
  | "Extension"
  | "Not Found"
  | "NCERT_REFERENCE_UNVERIFIED";

export interface QualityScoreBreakdown {
  questionAccuracy: number;  // max 20
  optionQuality: number;     // max 10
  answerAccuracy: number;    // max 20
  solutionAccuracy: number;  // max 15
  languageQuality: number;   // max 5
  ncertAlignment: number;    // max 10
  neetRelevance: number;     // max 10
  uniqueness: number;        // max 5
  examValue: number;         // max 5
  totalScore: number;        // max 100
}

export interface MultiConceptAnalysis {
  isMultiConcept: boolean;
  mode?: "MULTI_TOPIC" | "MULTI_CHAPTER" | "MULTI_UNIT" | "CROSS_SUBJECT";
  conceptsUsed: string[];
  conceptRelationship?: string;
  dependencyMap?: Record<string, string[]>;
  integrationReason?: string;
}

export interface CompactSolutionResult {
  fullSolution: string;
  compactSolution: string;
  lineCount: number;
  maxRecommendedLines: number;
  isCompliant: boolean;
}

export interface QuestionIntelligenceReport {
  canonicalQuestionId: string;
  questionReference: string; // QR-P260001234-V1
  solutionReference: string; // SR-P260001234-V1
  version: number;
  scores: QualityScoreBreakdown;
  neetRelevanceCategory: NeetRelevanceCategory;
  ncertAlignmentStatus: NcertAlignmentStatus;
  ncertReference?: {
    book?: string;
    class?: string;
    chapter?: string;
    page?: string;
    section?: string;
    paragraphOrLine?: string;
    verified: boolean;
  };
  cognitiveLevel: CognitiveLevel;
  primaryNature: QuestionNature;
  secondaryNatures: QuestionNature[];
  multiConcept: MultiConceptAnalysis;
  compactSolution: CompactSolutionResult;
  criticalErrors: string[];
  warnings: string[];
  recommendation: "AUTO_APPROVED" | "PENDING_REVIEW" | "REVISION_REQUIRED" | "REJECTED";
  canAutoApprove: boolean;
  auditorConfidence: number; // 0–100%
  promptVersion: string;
}

/**
 * Format canonical references for question and solution
 */
export function formatQuestionReference(canonicalId: string, version: number = 1): string {
  return `QR-${canonicalId.toUpperCase()}-V${version}`;
}

export function formatSolutionReference(canonicalId: string, version: number = 1): string {
  return `SR-${canonicalId.toUpperCase()}-V${version}`;
}

/**
 * Validates quality score breakdown and checks all critical gates
 */
export function evaluateQualityGate(
  scores: QualityScoreBreakdown,
  criticalErrors: string[],
  options: {
    answerVerified: boolean;
    solutionVerified: boolean;
    noAmbiguity: boolean;
    duplicateRiskScore: number; // 0–100
    neetRelevanceScore: number; // 0–100
    hasUnverifiedNcertClaim: boolean;
  }
): {
  recommendation: "AUTO_APPROVED" | "PENDING_REVIEW" | "REVISION_REQUIRED" | "REJECTED";
  canAutoApprove: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];

  // Critical Error Override (Section 27):
  if (criticalErrors.length > 0) {
    return {
      recommendation: "REVISION_REQUIRED",
      canAutoApprove: false,
      reasons: criticalErrors,
    };
  }

  // Check mandatory auto-approval conditions (Section 26):
  let passesAutoApproval = true;

  if (!options.answerVerified) {
    passesAutoApproval = false;
    reasons.push("Correct answer not independently verified.");
  }
  if (!options.solutionVerified) {
    passesAutoApproval = false;
    reasons.push("Solution steps not independently verified.");
  }
  if (!options.noAmbiguity) {
    passesAutoApproval = false;
    reasons.push("Possible ambiguity detected in wording or options.");
  }
  if (options.duplicateRiskScore > 20) {
    passesAutoApproval = false;
    reasons.push(`Duplicate risk score too high (${options.duplicateRiskScore}% > 20%).`);
  }
  if (options.neetRelevanceScore < 70) {
    passesAutoApproval = false;
    reasons.push(`NEET relevance score below threshold (${options.neetRelevanceScore} < 70).`);
  }
  if (options.hasUnverifiedNcertClaim) {
    passesAutoApproval = false;
    reasons.push("Claimed NCERT reference could not be verified against catalog.");
  }
  if (scores.totalScore < 85) {
    passesAutoApproval = false;
    reasons.push(`Overall quality score below auto-approval threshold (${scores.totalScore} < 85).`);
  }

  if (passesAutoApproval) {
    return {
      recommendation: "AUTO_APPROVED",
      canAutoApprove: true,
      reasons: ["All multi-factor quality gates passed (Score >= 85, verified answer & solution, NEET >= 70)."],
    };
  }

  return {
    recommendation: "PENDING_REVIEW",
    canAutoApprove: false,
    reasons,
  };
}

/**
 * Calculates compact solution target limit by nature and checks compliance
 */
export function validateCompactSolution(
  compactSolutionText: string,
  primaryNature: QuestionNature
): { lineCount: number; maxLines: number; isCompliant: boolean } {
  const lines = compactSolutionText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const lineCount = lines.length;

  let maxLines = 5;
  if (primaryNature === "Memory-Based" || primaryNature === "Factual") maxLines = 4;
  else if (primaryNature === "Conceptual" || primaryNature === "Reasoning-Based") maxLines = 5;
  else if (primaryNature === "Numerical") maxLines = 8;
  else if (primaryNature === "Multi-Concept" || primaryNature === "Analytical" || primaryNature === "Case-Based") maxLines = 12;

  return {
    lineCount,
    maxLines,
    isCompliant: lineCount <= maxLines,
  };
}
