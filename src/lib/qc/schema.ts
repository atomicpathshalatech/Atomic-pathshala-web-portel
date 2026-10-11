import { z } from "zod";

/**
 * Data contracts of the two QC agents. A model's reply is parsed against
 * these before anything is stored; a reply that does not fit is an ERROR
 * review, never a guessed default.
 */

export const FINDING_CATEGORIES = [
  "ANSWER_KEY_MISMATCH",
  "CORRECT_ANSWER_NOT_IN_OPTIONS",
  "MULTIPLE_CORRECT_OPTIONS",
  "DUPLICATE_OR_EQUIVALENT_OPTIONS",
  "SOLUTION_ERROR",
  "SOLUTION_ANSWER_DISAGREE",
  "SOLUTION_INCOMPLETE",
  "FORMULA_ERROR",
  "CALCULATION_ERROR",
  "UNIT_ERROR",
  "QUESTION_AMBIGUOUS",
  "QUESTION_MISSING_INFORMATION",
  "FACTUAL_ERROR",
  "CLASSIFICATION_ERROR",
  "DIFFICULTY_MISMATCH",
  "LANGUAGE_MISMATCH",
  "TYPO_OR_FORMATTING",
  "NCERT_CONFLICT",
  "OTHER",
] as const;
export type FindingCategory = (typeof FINDING_CATEGORIES)[number];

export const SEVERITIES = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;

export const NCERT_STATUSES = [
  "NCERT_DIRECT",
  "NCERT_CONCEPTUAL",
  "NCERT_APPLICATION",
  "NCERT_EXTENDED",
  "NCERT_NOT_FOUND",
  "NCERT_CONFLICT",
  "REFERENCE_UNVERIFIED",
] as const;

export const CORRECTION_FIELDS = ["correctAnswer", "solution", "statement", "options", "topic", "subTopic", "microConcept", "difficulty"] as const;

/** Models sometimes send numbers as strings, or null for "none". */
const looseNumber = z.preprocess((v) => (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v)) ? Number(v) : v), z.number());
const optionalText = z.preprocess((v) => (v === null || v === undefined ? undefined : String(v).trim() || undefined), z.string().max(6000).optional());
const text = (max = 6000) => z.preprocess((v) => (typeof v === "number" ? String(v) : v), z.string().trim().min(1).max(max));
const upper = (values: readonly [string, ...string[]]) => z.preprocess((v) => (typeof v === "string" ? v.trim().toUpperCase().replace(/[\s-]+/g, "_") : v), z.enum(values));

/**
 * The answer the agent reached BY SOLVING the question itself.
 * optionKeys: the option letter(s) that are correct ([] when none of the options is).
 * value: the answer itself (number with unit, or the fact) — needed when no option matches.
 */
export const derivedAnswerSchema = z.object({
  optionKeys: z.preprocess(
    (v) => (Array.isArray(v) ? v.map((x) => String(x).trim().toUpperCase().replace(/[^A-Z0-9]/g, "")).filter(Boolean) : typeof v === "string" && v.trim() ? [v.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")] : []),
    z.array(z.string().max(4)).max(8)
  ),
  value: optionalText,
  /** SOLVED: reached an answer. CANNOT_SOLVE: needs a figure / information that is not there, or outside what can be verified. */
  outcome: upper(["SOLVED", "CANNOT_SOLVE"]),
  reasoning: text(4000),
});

export const calcCheckSchema = z.object({
  label: optionalText,
  expression: text(400),
  claimedValue: looseNumber,
});

export const proposedCorrectionSchema = z.object({
  field: z.enum(CORRECTION_FIELDS),
  language: z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim().toUpperCase() : undefined), z.enum(["ENGLISH", "HINDI"]).optional()),
  proposedValue: text(12000),
  reason: text(2000),
});

export const findingSchema = z.object({
  category: upper(FINDING_CATEGORIES),
  severity: upper(SEVERITIES),
  description: text(3000),
  evidence: optionalText,
  correction: z.preprocess((v) => (v === null ? undefined : v), proposedCorrectionSchema.optional()),
});

export const expertOutputSchema = z.object({
  derivedAnswer: derivedAnswerSchema,
  /** Every arithmetic step the derived answer depends on, as a plain expression. [] for non-numerical questions. */
  calculations: z.preprocess((v) => (Array.isArray(v) ? v : []), z.array(calcCheckSchema).max(30)),
  solutionCheck: z.object({ status: upper(["PASS", "FAIL", "INCONCLUSIVE"]), notes: optionalText }),
  formulaCheck: z.object({ status: upper(["PASS", "FAIL", "NOT_APPLICABLE", "INCONCLUSIVE"]), notes: optionalText }),
  unitsCheck: z.object({ status: upper(["PASS", "FAIL", "NOT_APPLICABLE", "INCONCLUSIVE"]), notes: optionalText }),
  classification: z.object({
    chapter: optionalText,
    topic: optionalText,
    subTopic: optionalText,
    microConcepts: z.preprocess((v) => (Array.isArray(v) ? v.map(String).filter((x) => x.trim()) : []), z.array(z.string().max(200)).max(8)),
    difficulty: z.preprocess((v) => (typeof v === "string" ? v.trim().toUpperCase() : v), z.enum(["EASY", "MEDIUM", "HARD"]).optional().catch(undefined)),
    storedClassificationCorrect: z.preprocess((v) => (v === null ? undefined : v), z.boolean().optional()),
  }),
  ncert: z.object({
    status: upper(NCERT_STATUSES),
    /** Index (1-based) of the supplied passage that supports the answer; null when none does. Never a page number invented by the model. */
    supportingPassage: z.preprocess((v) => (v === null || v === undefined || v === "" ? undefined : Number(v)), z.number().int().min(1).max(10).optional().catch(undefined)),
    note: optionalText,
  }),
  findings: z.preprocess((v) => (Array.isArray(v) ? v : []), z.array(findingSchema).max(20)),
  confidence: z.preprocess((v) => (typeof v === "string" ? Number(v) : v), z.number().min(0).max(1).catch(0)),
});
export type ExpertOutput = z.infer<typeof expertOutputSchema>;

/** Director, step 1: solves the question knowing nothing of the Expert's review. */
export const directorSolveSchema = z.object({
  derivedAnswer: derivedAnswerSchema,
  calculations: z.preprocess((v) => (Array.isArray(v) ? v : []), z.array(calcCheckSchema).max(30)),
  /** Problems the Director sees in the question / options / stored solution on its own reading. */
  findings: z.preprocess((v) => (Array.isArray(v) ? v : []), z.array(findingSchema).max(20)),
  confidence: z.preprocess((v) => (typeof v === "string" ? Number(v) : v), z.number().min(0).max(1).catch(0)),
});
export type DirectorSolveOutput = z.infer<typeof directorSolveSchema>;

export const DIRECTOR_DECISIONS = ["CONFIRMED", "PARTIALLY_CONFIRMED", "FALSE_POSITIVE", "MISSED_CONTEXT", "INCONCLUSIVE"] as const;

/** Director, step 2: a verdict on each Expert finding (by its number). */
export const directorAuditSchema = z.object({
  verdicts: z.preprocess(
    (v) => (Array.isArray(v) ? v : []),
    z
      .array(
        z.object({
          finding: z.preprocess((v) => Number(v), z.number().int().min(1).max(50)),
          decision: upper(DIRECTOR_DECISIONS),
          reason: text(2000),
          finalAction: optionalText,
        })
      )
      .max(30)
  ),
  /** Problems in the stored key / solution / classification that the Expert did not report. */
  additionalFindings: z.preprocess((v) => (Array.isArray(v) ? v : []), z.array(findingSchema).max(20)),
});
export type DirectorAuditOutput = z.infer<typeof directorAuditSchema>;
