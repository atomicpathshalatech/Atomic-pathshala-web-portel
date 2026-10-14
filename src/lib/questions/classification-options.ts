/**
 * Fixed choices for a question's teaching classification, so everyone fills
 * them the same way. Stored as the value; shown with the label.
 */
export const BLOOM_LEVELS = [
  { value: "REMEMBER", label: "Remember" },
  { value: "UNDERSTAND", label: "Understand" },
  { value: "APPLY", label: "Apply" },
  { value: "ANALYZE", label: "Analyze" },
  { value: "EVALUATE", label: "Evaluate" },
  { value: "CREATE", label: "Create" },
] as const;

export const IMPORTANCE_LEVELS = [
  { value: "HIGH_YIELD", label: "High Yield" },
  { value: "MEDIUM_YIELD", label: "Medium Yield" },
  { value: "LOW_YIELD", label: "Low Yield" },
] as const;

export const SOLVE_TIMES = [
  { value: "QUICK", label: "Quick (under 1 min)" },
  { value: "MODERATE", label: "Moderate (1–2 min)" },
  { value: "LENGTHY", label: "Lengthy (over 2 min)" },
] as const;

export const KEY_SKILLS = [
  { value: "CONCEPTUAL_UNDERSTANDING", label: "Conceptual Understanding" },
  { value: "NUMERICAL_CALCULATION", label: "Numerical Calculation" },
  { value: "FACT_RECALL", label: "Fact Recall" },
  { value: "DIAGRAM_INTERPRETATION", label: "Diagram Interpretation" },
  { value: "GRAPH_ANALYSIS", label: "Graph Analysis" },
  { value: "APPLICATION", label: "Application" },
  { value: "REASONING", label: "Reasoning" },
] as const;

/** The values the database accepts (src/prisma: enum Difficulty / QuestionType). */
export const DIFFICULTIES = [
  { value: "EASY", label: "Easy" },
  { value: "MEDIUM", label: "Medium" },
  { value: "HARD", label: "Hard" },
] as const;

export const QUESTION_TYPE_OPTIONS = [
  { value: "SINGLE_CORRECT", label: "Single Correct (MCQ)" },
  { value: "MULTIPLE_CORRECT", label: "Multiple Correct" },
  { value: "ASSERTION_REASON", label: "Assertion-Reason" },
  { value: "STATEMENT_BASED", label: "Statement Based" },
  { value: "MATCH_COLUMN", label: "Match the Column" },
  { value: "INTEGER", label: "Integer" },
  { value: "NUMERICAL", label: "Numerical" },
] as const;

type Option = { readonly value: string; readonly label: string };
export const labelOf = (options: readonly Option[], value: string | null | undefined) =>
  value ? options.find((o) => o.value === value)?.label ?? value : "";

/** The value if it is one of the choices; "" / null clears it; anything else is refused. */
export function pickChoice(options: readonly Option[], value: unknown): { ok: true; value: string | null } | { ok: false } {
  if (value === null || value === "") return { ok: true, value: null };
  if (typeof value === "string" && options.some((o) => o.value === value)) return { ok: true, value };
  return { ok: false };
}
