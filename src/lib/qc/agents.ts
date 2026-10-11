import { runCalcChecks, type CalcCheckResult } from "./calc";
import { QC_GROUND_RULES, qcDirectorModels, qcExpertModels, type ModelCaller, type QcModelUsage } from "./model";
import { renderQuestion, type QcQuestionInput } from "./question";
import { directorAuditSchema, directorSolveSchema, expertOutputSchema, FINDING_CATEGORIES, type DirectorAuditOutput, type DirectorSolveOutput, type ExpertOutput } from "./schema";

/**
 * The two QC agents. Neither touches the database: they take a question (and
 * reference text), call a model through the caller they are given, and return
 * validated output plus the deterministic recomputation of their arithmetic.
 *
 *   QC Expert   — first-level review of the whole record.
 *   QC Director — (1) solves the question blind: it is shown neither the
 *                 stored key, nor the stored solution, nor anything the Expert
 *                 wrote; (2) only then audits each Expert finding and looks
 *                 for what the Expert missed.
 */

export const EXPERT_PROMPT_VERSION = "qc-expert-1.0";
export const DIRECTOR_PROMPT_VERSION = "qc-director-1.0";

const SUBJECT_NOTES: Record<string, string> = {
  physics:
    "Physics: check the formula used, dimensional consistency, vector vs scalar, sign conventions, SI units and unit conversions, the validity of approximations, and that the numerical answer follows from the stated data only.",
  chemistry:
    "Chemistry: check formulas and balancing, stoichiometry, concentration terms, oxidation numbers, reaction conditions, the actual product for the reagents and conditions given (not a look-alike reaction), nomenclature, thermodynamic signs, equilibrium expressions, logarithms and units.",
  biology:
    "Biology: check terminology, NCERT facts, taxonomic names, each statement of statement-based questions, assertion–reason logic and match-the-column pairs, qualifiers and exceptions. An equivalent wording of a correct fact is not an error.",
  mathematics:
    "Mathematics: check algebra and signs, domain restrictions, extraneous roots, identities, calculus steps, probability, boundary cases, and that every solution satisfies the original condition.",
};

function subjectNote(subject: string): string {
  const s = subject.toLowerCase();
  if (s.includes("phys")) return SUBJECT_NOTES.physics!;
  if (s.includes("chem")) return SUBJECT_NOTES.chemistry!;
  if (s.includes("bio") || s.includes("bot") || s.includes("zoo")) return SUBJECT_NOTES.biology!;
  if (s.includes("math")) return SUBJECT_NOTES.mathematics!;
  return "Check facts, logic, calculations and units as the subject requires.";
}

const ANSWER_SHAPE = `"derivedAnswer": { "optionKeys": ["B"], "value": "25 m/s", "outcome": "SOLVED" | "CANNOT_SOLVE", "reasoning": "how you reached it, briefly" }`;
const CALC_SHAPE = `"calculations": [ { "label": "what this step is", "expression": "0.5*2*10^2", "claimedValue": 100 } ]`;
const FINDING_SHAPE = `{ "category": one of [${FINDING_CATEGORIES.join(", ")}], "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW", "description": "what is wrong", "evidence": "the calculation / fact that shows it", "correction": { "field": "correctAnswer" | "solution" | "statement" | "options" | "topic" | "subTopic" | "microConcept" | "difficulty", "language": "ENGLISH" | "HINDI", "proposedValue": "the corrected value (for correctAnswer: the option letter(s), e.g. C)", "reason": "why" } or null }`;

const ANSWER_RULES = `How to state your answer:
- optionKeys: the letter(s) of every option that is correct. If NO option is correct, give [] and put the right answer in "value".
- For numerical / integer questions without options, put the number (with unit) in "value" and leave optionKeys [].
- "calculations": for every arithmetic step your answer depends on, write the step as a plain expression using only numbers, + - * / ^, parentheses and sqrt, log (base 10), ln, exp, sin, cos, tan (radians), sind, cosd, tand (degrees), pi, e — and the value you got. Use [] when the question needs no arithmetic. These are recomputed by a calculator, so write them exactly.
- Severity: CRITICAL = the keyed answer is wrong or the question cannot be answered; HIGH = the solution / formula / units / options are wrong in a way that misleads; MEDIUM = incomplete or misclassified; LOW = typo or formatting.`;

export type ExpertRun = { output: ExpertOutput; calc: CalcCheckResult[]; model: string; usage: QcModelUsage[] };

export async function runExpert(q: QcQuestionInput, passagesText: string, call: ModelCaller): Promise<ExpertRun> {
  const system = `You are QC Expert, the first-level academic reviewer of a question bank for NEET / JEE / board exams.
Your job: find what is wrong with a stored question — you do not assume it is right.
${QC_GROUND_RULES}`;

  const prompt = `${renderQuestion(q, { withStoredAnswer: true, withSolution: true })}

${passagesText}

WHAT TO DO, IN THIS ORDER:
1. Solve the question yourself from the QUESTION and OPTIONS alone. Do this before you weigh the stored key or solution — a key and a solution that agree with each other can both be wrong.
2. Compare: your answer vs the STORED ANSWER KEY; the stored solution's steps, formulae, arithmetic, units; whether exactly the expected number of options is correct; duplicate or equivalent options; missing conditions; ambiguity.
3. ${subjectNote(q.subject)}
4. Classification: is the stored chapter / topic / sub-topic / difficulty right? Name the micro-concept(s) the question really tests (several if it tests several).
5. NCERT: say how the question relates to NCERT. Cite a passage only if one of the REFERENCE PASSAGES above actually supports the answer — give its number in "supportingPassage". If none does, use NCERT_NOT_FOUND or REFERENCE_UNVERIFIED and leave supportingPassage null. Never state a page number yourself.
6. Report each problem as a finding. No problem → "findings": []. Do not report a difference of wording as an error.

${ANSWER_RULES}

REPLY WITH THIS JSON:
{
  ${ANSWER_SHAPE},
  ${CALC_SHAPE},
  "solutionCheck": { "status": "PASS" | "FAIL" | "INCONCLUSIVE", "notes": "" },
  "formulaCheck": { "status": "PASS" | "FAIL" | "NOT_APPLICABLE" | "INCONCLUSIVE", "notes": "" },
  "unitsCheck": { "status": "PASS" | "FAIL" | "NOT_APPLICABLE" | "INCONCLUSIVE", "notes": "" },
  "classification": { "chapter": "", "topic": "", "subTopic": "", "microConcepts": [""], "difficulty": "EASY" | "MEDIUM" | "HARD", "storedClassificationCorrect": true },
  "ncert": { "status": "NCERT_DIRECT" | "NCERT_CONCEPTUAL" | "NCERT_APPLICATION" | "NCERT_EXTENDED" | "NCERT_NOT_FOUND" | "NCERT_CONFLICT" | "REFERENCE_UNVERIFIED", "supportingPassage": 1 or null, "note": "" },
  "findings": [ ${FINDING_SHAPE} ],
  "confidence": 0.0 to 1.0
}`;

  const { data, model, usage } = await call({ feature: "QC_EXPERT", models: qcExpertModels(), system, prompt, schema: expertOutputSchema });
  return { output: data, calc: runCalcChecks(data.calculations), model, usage };
}

export type DirectorRun = {
  solve: DirectorSolveOutput;
  solveCalc: CalcCheckResult[];
  audit: DirectorAuditOutput;
  model: string;
  /** True when the Director ended up on the same model as the Expert (fallback) — less independent. */
  sameModelAsExpert: boolean;
  usage: QcModelUsage[];
};

export async function runDirector(q: QcQuestionInput, expert: { output: ExpertOutput; model: string }, call: ModelCaller): Promise<DirectorRun> {
  const system = `You are QC Director, the senior reviewer who audits another reviewer's work on a question bank for NEET / JEE / board exams.
You reach your own conclusions from the question itself. You do not defer to anyone's earlier conclusion.
${QC_GROUND_RULES}`;

  // Step 1 — blind: no stored key, no stored solution, nothing from the Expert.
  const solvePrompt = `${renderQuestion(q, { withStoredAnswer: false, withSolution: false })}

Solve this question yourself. ${subjectNote(q.subject)}
Also report any problem you see in the question or its options themselves (ambiguous, missing information, no correct option, more than one correct option, duplicate options, wrong units in options).

${ANSWER_RULES}

REPLY WITH THIS JSON:
{
  ${ANSWER_SHAPE},
  ${CALC_SHAPE},
  "findings": [ ${FINDING_SHAPE} ],
  "confidence": 0.0 to 1.0
}`;
  const models = qcDirectorModels();
  const solved = await call({ feature: "QC_DIRECTOR_SOLVE", models, system, prompt: solvePrompt, schema: directorSolveSchema });
  const solveCalc = runCalcChecks(solved.data.calculations);

  // Step 2 — audit, now with the stored key / solution and the Expert's findings.
  const findingsText = expert.output.findings.length
    ? expert.output.findings
        .map((f, i) => `Finding ${i + 1} [${f.category}, ${f.severity}]: ${f.description}${f.evidence ? `\n  Evidence given: ${f.evidence}` : ""}${f.correction ? `\n  Proposed correction (${f.correction.field}): ${f.correction.proposedValue}` : ""}`)
        .join("\n")
    : "(the first reviewer reported no findings)";

  const auditPrompt = `${renderQuestion(q, { withStoredAnswer: true, withSolution: true })}

YOUR OWN ANSWER (from solving it blind): ${solved.data.derivedAnswer.outcome === "SOLVED" ? `${solved.data.derivedAnswer.optionKeys.join(", ") || "no option"} ${solved.data.derivedAnswer.value ?? ""}` : "could not solve"}
THE FIRST REVIEWER'S ANSWER: ${expert.output.derivedAnswer.outcome === "SOLVED" ? `${expert.output.derivedAnswer.optionKeys.join(", ") || "no option"} ${expert.output.derivedAnswer.value ?? ""}` : "could not solve"}

THE FIRST REVIEWER'S FINDINGS:
${findingsText}

WHAT TO DO:
1. For EACH finding above, check it against the question, the stored key and the stored solution yourself, and give a verdict:
   CONFIRMED (it is a real error), PARTIALLY_CONFIRMED (partly right), FALSE_POSITIVE (not an error), MISSED_CONTEXT (the reviewer overlooked something that changes it), INCONCLUSIVE (cannot be settled from what is here).
   A proposed correction that is itself wrong makes the finding at most PARTIALLY_CONFIRMED — say so in the reason.
2. Then look for errors the first reviewer did NOT report — in the stored key, the stored solution (steps, formula, arithmetic, units, final statement), the classification — and list them in "additionalFindings". None → [].

REPLY WITH THIS JSON:
{
  "verdicts": [ { "finding": 1, "decision": "CONFIRMED" | "PARTIALLY_CONFIRMED" | "FALSE_POSITIVE" | "MISSED_CONTEXT" | "INCONCLUSIVE", "reason": "", "finalAction": "what should be done" } ],
  "additionalFindings": [ ${FINDING_SHAPE} ]
}`;
  const audited = await call({ feature: "QC_DIRECTOR_AUDIT", models, system, prompt: auditPrompt, schema: directorAuditSchema });

  return {
    solve: solved.data,
    solveCalc,
    audit: audited.data,
    model: solved.model,
    sameModelAsExpert: solved.model === expert.model,
    usage: [...solved.usage, ...audited.usage],
  };
}
