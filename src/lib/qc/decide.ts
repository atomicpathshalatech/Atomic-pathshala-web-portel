import { valuesAgree, type CalcCheckResult } from "./calc";
import { isValueAnswerType, type QcQuestionInput } from "./question";
import type { DirectorAuditOutput, DirectorSolveOutput, ExpertOutput } from "./schema";

/**
 * The decision rules of the QC pipeline — plain code, no model. A status is
 * the outcome of these rules applied to what the agents derived and to the
 * deterministic checks; a model's own confidence is never an input.
 */

export type AnswerComparison = "MATCH" | "MISMATCH" | "UNDETERMINED";
type Derived = ExpertOutput["derivedAnswer"];

const firstNumber = (text: string | undefined | null): number | null => {
  if (!text) return null;
  const cleaned = text.replace(/[,\s]/g, "").replace(/[×x]10\^?\(?(-?\d+)\)?/i, "e$1").replace(/−/g, "-");
  const m = /-?\d+\.?\d*(e[+-]?\d+)?/i.exec(cleaned);
  return m ? Number(m[0]) : null;
};

const sameKeys = (a: string[], b: string[]) => {
  const x = [...new Set(a.map((k) => k.toUpperCase()))].sort();
  const y = [...new Set(b.map((k) => k.toUpperCase()))].sort();
  return x.length === y.length && x.every((k, i) => k === y[i]);
};

/** Does the answer an agent derived equal the stored answer key? */
export function compareWithStored(q: QcQuestionInput, derived: Derived): AnswerComparison {
  if (derived.outcome !== "SOLVED") return "UNDETERMINED";
  if (q.storedAnswer.length === 0) return "UNDETERMINED";
  if (isValueAnswerType(q.type) || q.options.length === 0) {
    const stored = firstNumber(q.storedAnswer[0]);
    const got = firstNumber(derived.value);
    if (stored === null || got === null) return "UNDETERMINED";
    return valuesAgree(stored, got) ? "MATCH" : "MISMATCH";
  }
  // Solved, but no option is right → the key cannot be right either.
  if (derived.optionKeys.length === 0) return "MISMATCH";
  return sameKeys(derived.optionKeys, q.storedAnswer) ? "MATCH" : "MISMATCH";
}

/** Did two agents reach the same answer? null when either could not solve. */
export function agentsAgree(q: QcQuestionInput, a: Derived, b: Derived): boolean | null {
  if (a.outcome !== "SOLVED" || b.outcome !== "SOLVED") return null;
  if (isValueAnswerType(q.type) || q.options.length === 0) {
    const x = firstNumber(a.value);
    const y = firstNumber(b.value);
    return x === null || y === null ? null : valuesAgree(x, y);
  }
  return sameKeys(a.optionKeys, b.optionKeys);
}

export const derivedLabel = (d: Derived) => (d.outcome !== "SOLVED" ? "CANNOT_SOLVE" : d.optionKeys.length ? d.optionKeys.join(",") : d.value ? `none of the options (${d.value})` : "none of the options");

export type DeterministicFinding = { category: string; severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"; description: string; evidence?: string };

/** Problems found without any model: structure of the stored record itself. */
export function structuralFindings(q: QcQuestionInput): DeterministicFinding[] {
  const out: DeterministicFinding[] = [];
  const valueType = isValueAnswerType(q.type);
  if (!valueType && q.options.length < 2) out.push({ category: "QUESTION_MISSING_INFORMATION", severity: "HIGH", description: `The question has ${q.options.length} option(s); an objective question needs at least two.` });
  if (q.storedAnswer.length === 0) out.push({ category: "ANSWER_KEY_MISMATCH", severity: "CRITICAL", description: "No answer key is stored for this question." });
  if (!valueType && q.options.length > 0) {
    const keys = new Set(q.options.map((o) => o.key));
    const unknown = q.storedAnswer.filter((k) => !keys.has(k.toUpperCase()));
    if (unknown.length) out.push({ category: "ANSWER_KEY_MISMATCH", severity: "CRITICAL", description: `The stored answer key (${unknown.join(", ")}) is not one of the options (${[...keys].join(", ")}).` });
    if (q.type === "SINGLE_CORRECT" && q.storedAnswer.length > 1) out.push({ category: "MULTIPLE_CORRECT_OPTIONS", severity: "HIGH", description: `A single-correct question has ${q.storedAnswer.length} keys stored (${q.storedAnswer.join(", ")}).` });
    const seen = new Map<string, string>();
    for (const o of q.options) {
      const norm = o.text.replace(/\s+/g, " ").trim().toLowerCase();
      const first = seen.get(norm);
      if (first) out.push({ category: "DUPLICATE_OR_EQUIVALENT_OPTIONS", severity: "HIGH", description: `Options ${first} and ${o.key} have the same text.`, evidence: o.text.slice(0, 200) });
      else seen.set(norm, o.key);
    }
  }
  if (q.otherLanguageAnswer && q.otherLanguageAnswer.length && q.storedAnswer.length && !sameKeys(q.otherLanguageAnswer, q.storedAnswer) && !valueType) {
    out.push({ category: "LANGUAGE_MISMATCH", severity: "HIGH", description: `The answer key differs between languages: ${q.language} says ${q.storedAnswer.join(", ")}, the other language says ${q.otherLanguageAnswer.join(", ")}.` });
  }
  if (!q.solution || !q.solution.trim()) out.push({ category: "SOLUTION_INCOMPLETE", severity: "MEDIUM", description: "No solution is stored for this question." });
  return out;
}

const blocking = (sev: string) => sev === "CRITICAL" || sev === "HIGH";
const calcTrouble = (checks: CalcCheckResult[]) => ({ wrong: checks.filter((c) => c.agrees === false), unevaluated: checks.filter((c) => !c.evaluated) });

export type ExpertStatus = { status: "PASS" | "FAIL" | "NEEDS_HUMAN_REVIEW"; comparison: AnswerComparison; reasons: string[] };

export function expertStatus(q: QcQuestionInput, out: ExpertOutput, calc: CalcCheckResult[], structural: DeterministicFinding[]): ExpertStatus {
  const comparison = compareWithStored(q, out.derivedAnswer);
  const fail: string[] = [];
  const review: string[] = [];
  if (comparison === "MISMATCH") fail.push(`Independently derived answer (${derivedLabel(out.derivedAnswer)}) differs from the stored key (${q.storedAnswer.join(", ")}).`);
  if (structural.some((f) => blocking(f.severity))) fail.push("The stored record has a structural problem.");
  if (out.findings.some((f) => blocking(f.severity))) fail.push("A critical / high finding was reported.");
  if (out.solutionCheck.status === "FAIL") fail.push("The stored solution is wrong.");
  if (out.formulaCheck.status === "FAIL") fail.push("A formula is wrong.");
  if (out.unitsCheck.status === "FAIL") fail.push("Units are wrong.");
  const { wrong, unevaluated } = calcTrouble(calc);
  if (wrong.length) review.push(`${wrong.length} calculation(s) did not reproduce when recomputed.`);
  if (unevaluated.length) review.push(`${unevaluated.length} calculation(s) could not be recomputed.`);
  if (comparison === "UNDETERMINED") review.push("The answer could not be derived independently.");
  if (q.hasImage) review.push("The question has a picture the reviewer could not see.");
  if ([out.solutionCheck.status, out.formulaCheck.status, out.unitsCheck.status].includes("INCONCLUSIVE")) review.push("A check was inconclusive.");
  if (out.findings.some((f) => f.severity === "MEDIUM") || structural.some((f) => f.severity === "MEDIUM")) review.push("A medium finding was reported.");
  if (fail.length) return { status: "FAIL", comparison, reasons: [...fail, ...review] };
  if (review.length) return { status: "NEEDS_HUMAN_REVIEW", comparison, reasons: review };
  return { status: "PASS", comparison, reasons: [] };
}

export type FinalDecision = {
  status: "VERIFIED" | "FAILED" | "NEEDS_HUMAN_REVIEW";
  reasons: string[];
  expertVsStored: AnswerComparison;
  directorVsStored: AnswerComparison;
  agentsAgree: boolean | null;
};

/**
 * The final status of a question after both agents.
 *
 * VERIFIED needs all of: both agents independently reach the stored answer;
 * every recomputed calculation agrees; no structural problem; no confirmed
 * finding above LOW; nothing left inconclusive; no unseen picture.
 * FAILED needs evidence both agents share: the same different answer, or a
 * critical / high finding the Director confirmed (or reported itself as well).
 * Everything else goes to a person.
 */
export function finalDecision(args: {
  q: QcQuestionInput;
  expert: ExpertOutput;
  expertCalc: CalcCheckResult[];
  structural: DeterministicFinding[];
  directorSolve: DirectorSolveOutput;
  directorCalc: CalcCheckResult[];
  directorAudit: DirectorAuditOutput;
}): FinalDecision {
  const { q, expert, directorSolve, directorAudit, structural } = args;
  const expertVsStored = compareWithStored(q, expert.derivedAnswer);
  const directorVsStored = compareWithStored(q, directorSolve.derivedAnswer);
  const agree = agentsAgree(q, expert.derivedAnswer, directorSolve.derivedAnswer);
  const verdictOf = (i: number) => directorAudit.verdicts.find((v) => v.finding === i + 1)?.decision ?? null;

  const failed: string[] = [];
  const review: string[] = [];

  if (structural.some((f) => blocking(f.severity))) failed.push("The stored record has a structural problem (see findings).");
  if (agree === true && expertVsStored === "MISMATCH" && directorVsStored === "MISMATCH") {
    failed.push(`Both reviewers independently reached ${derivedLabel(expert.derivedAnswer)}; the stored key says ${q.storedAnswer.join(", ") || "nothing"}.`);
  }

  expert.findings.forEach((f, i) => {
    const verdict = verdictOf(i);
    const confirmed = verdict === "CONFIRMED" || verdict === "PARTIALLY_CONFIRMED";
    if (blocking(f.severity)) {
      if (verdict === "CONFIRMED") failed.push(`${f.category}: confirmed by the Director.`);
      else if (verdict === "PARTIALLY_CONFIRMED") review.push(`${f.category}: only partly confirmed by the Director.`);
      else if (verdict === "INCONCLUSIVE" || verdict === "MISSED_CONTEXT" || verdict === null) review.push(`${f.category}: not settled by the Director (${verdict ?? "no verdict"}).`);
    } else if (f.severity === "MEDIUM" && confirmed) {
      review.push(`${f.category}: a confirmed medium finding with a correction to decide.`);
    }
  });

  for (const f of directorSolve.findings) {
    if (!blocking(f.severity) && f.severity !== "MEDIUM") continue;
    const alsoExpert = expert.findings.some((e) => e.category === f.category);
    if (blocking(f.severity) && alsoExpert) failed.push(`${f.category}: reported by both reviewers.`);
    else review.push(`${f.category}: found by the Director only.`);
  }

  if (agree === false) review.push(`The reviewers disagree: Expert ${derivedLabel(expert.derivedAnswer)}, Director ${derivedLabel(directorSolve.derivedAnswer)}.`);
  if (expertVsStored === "UNDETERMINED" || directorVsStored === "UNDETERMINED") review.push("At least one reviewer could not derive the answer.");
  if (agree === true && expertVsStored !== directorVsStored) review.push("The reviewers' answers compare differently with the stored key.");
  for (const [who, calc] of [["Expert", args.expertCalc], ["Director", args.directorCalc]] as const) {
    const { wrong, unevaluated } = calcTrouble(calc);
    if (wrong.length) review.push(`${who}: ${wrong.length} calculation(s) did not reproduce when recomputed.`);
    if (unevaluated.length) review.push(`${who}: ${unevaluated.length} calculation(s) could not be recomputed.`);
  }
  if (q.hasImage) review.push("The question has a picture the reviewers could not see.");
  if ([expert.solutionCheck.status, expert.formulaCheck.status, expert.unitsCheck.status].includes("INCONCLUSIVE")) review.push("An Expert check was inconclusive.");
  if (structural.some((f) => f.severity === "MEDIUM")) review.push("The stored record is incomplete (see findings).");

  const base = { expertVsStored, directorVsStored, agentsAgree: agree };
  if (failed.length) return { status: "FAILED", reasons: [...failed, ...review], ...base };
  if (review.length) return { status: "NEEDS_HUMAN_REVIEW", reasons: review, ...base };
  if (expertVsStored === "MATCH" && directorVsStored === "MATCH" && agree === true) return { status: "VERIFIED", reasons: [], ...base };
  return { status: "NEEDS_HUMAN_REVIEW", reasons: ["The mandatory answer check did not complete."], ...base };
}
