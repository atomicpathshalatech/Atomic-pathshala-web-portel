/**
 * Structured Solution Definition and Serialization for Atomic Pathshala PYQ & Question Bank.
 * 
 * Provides a clean, pedagogical, subject-adaptive 3-part structure:
 * 1. Concept: Brief, essential theoretical/NCERT context (only when genuinely needed).
 * 2. Solution: Direct, complete, question-specific explanation:
 *    - Biology: Direct biological reasoning/fact without artificial formulas or procedures.
 *    - Physics: Formula, calculation, and reasoning integrated into one coherent solution.
 *    - Chemistry: Reactions, mechanisms, equations, and calculations integrated cleanly.
 * 3. Option Analysis: Meaningful explanation of why the correct option is right and incorrect options are wrong.
 * 
 * Backward compatibility:
 * Seamlessly parses and displays legacy 6-section solutions without data loss.
 */

import {
  StandardSolution,
  formatStandardSolutionMarkdown,
  parseStandardSolution,
  formatLogicalStepSpacing,
} from "@/lib/solutions/standard-solution";

export interface StructuredSolution {
  /** 1. Correct Answer */
  correctAnswer?: string;
  correctOptionKey?: string;
  /** 2. Core theoretical / NCERT concept */
  concept: string;
  /** 3. Direct, comprehensive, question-specific explanation */
  solution: string;
  /** 4. Final Answer */
  finalAnswer?: string;
  /** Option-by-option analysis (why correct is correct, why incorrect are wrong) */
  optionExplanation?: string;

  // Backward-compatibility fields:
  formula?: string;
  stepByStep?: string;
  takeaway?: string;
  imageUrl?: string | null;
}

export function createEmptyStructuredSolution(): StructuredSolution {
  return {
    correctAnswer: "",
    correctOptionKey: "",
    concept: "",
    solution: "",
    finalAnswer: "",
    optionExplanation: "",
    formula: "",
    stepByStep: "",
    takeaway: "",
    imageUrl: null,
  };
}

export function isEmptyStructuredSolution(sol: StructuredSolution | null | undefined): boolean {
  if (!sol) return true;
  return (
    !(sol.correctAnswer || "").trim() &&
    !(sol.concept || "").trim() &&
    !(sol.solution || "").trim() &&
    !(sol.stepByStep || "").trim() &&
    !(sol.formula || "").trim() &&
    !(sol.finalAnswer || "").trim() &&
    !(sol.optionExplanation || "").trim() &&
    !(sol.takeaway || "").trim()
  );
}

/**
 * Formats a StructuredSolution into the platform's mandatory 4-section format:
 * 1. Correct Answer
 * 2. Concept Used
 * 3. Step-by-Step Solution
 * 4. Final Answer
 */
export function formatStructuredSolution(
  sol: StructuredSolution,
  lang: "EN" | "HI" = "EN"
): string {
  if (!sol) return "";

  const c = (sol.concept || "").trim();
  const mainSolution = (
    sol.solution?.trim() ||
    sol.stepByStep?.trim() ||
    [sol.formula?.trim(), sol.takeaway?.trim()].filter(Boolean).join("\n\n")
  ).trim();
  const o = (sol.optionExplanation || "").trim();

  // Combine main solution steps and option analysis into stepByStep
  const combinedSteps = [mainSolution, o].filter(Boolean).join("\n\n").trim();

  // Convert to canonical StandardSolution
  const std: StandardSolution = {
    correctAnswer: sol.correctAnswer || (sol.correctOptionKey ? `Option ${sol.correctOptionKey}` : ""),
    correctOptionKey: sol.correctOptionKey,
    conceptUsed: c,
    stepByStep: formatLogicalStepSpacing(combinedSteps),
    finalAnswer: sol.finalAnswer || (sol.correctOptionKey ? `Option ${sol.correctOptionKey}` : ""),
    imageUrl: sol.imageUrl,
  };

  return formatStandardSolutionMarkdown(std, lang);
}

/**
 * Parses raw solution string (Markdown, JSON, or legacy format) into StructuredSolution.
 * Fully compatible with the mandatory 4-section standard format.
 */
export function parseStructuredSolution(raw: string | null | undefined): StructuredSolution {
  const result: StructuredSolution = createEmptyStructuredSolution();
  if (!raw || !raw.trim()) return result;

  const std = parseStandardSolution(raw);
  return {
    correctAnswer: std.correctAnswer,
    correctOptionKey: std.correctOptionKey,
    concept: std.conceptUsed,
    solution: std.stepByStep,
    stepByStep: std.stepByStep,
    finalAnswer: std.finalAnswer,
    imageUrl: std.imageUrl,
    optionExplanation: "",
    formula: "",
    takeaway: "",
  };
}
