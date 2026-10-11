import { runDirector, runExpert, type DirectorRun, type ExpertRun } from "./agents";
import { expertStatus, finalDecision, structuralFindings, type DeterministicFinding, type ExpertStatus, type FinalDecision } from "./decide";
import { QcModelError, type ModelCaller, type QcModelUsage } from "./model";
import type { QcQuestionInput } from "./question";

/**
 * One full review of one question: structural checks → QC Expert → QC
 * Director → decision rules → proposed corrections. No database here; the
 * caller stores the result (pipeline.ts) or inspects it (tests).
 */

export type ProposedCorrection = {
  /** "EXPERT:3" = the Expert's 3rd finding; "DIRECTOR:1" = the Director's 1st. */
  from: string;
  field: string;
  language?: string;
  originalValue: string | null;
  proposedValue: string;
  reason: string;
  evidence?: string;
  /** The Director only partly agreed with the finding behind this. */
  partial: boolean;
};

export type QuestionReview = {
  structural: DeterministicFinding[];
  expert: ExpertRun;
  expertStatus: ExpertStatus;
  director: DirectorRun;
  decision: FinalDecision;
  corrections: ProposedCorrection[];
  usage: QcModelUsage[];
};

export class QcReviewError extends Error {
  constructor(
    message: string,
    public stage: "EXPERT" | "DIRECTOR",
    public usage: QcModelUsage[],
    public partial?: { structural: DeterministicFinding[]; expert?: ExpertRun; expertStatus?: ExpertStatus }
  ) {
    super(message);
  }
}

function originalOf(q: QcQuestionInput, field: string): string | null {
  switch (field) {
    case "correctAnswer":
      return q.storedAnswer.join(", ") || null;
    case "solution":
      return q.solution ?? null;
    case "statement":
      return q.statement;
    case "options":
      return q.options.map((o) => `(${o.key}) ${o.text}`).join("\n");
    case "topic":
      return q.topic ?? null;
    case "subTopic":
      return q.subTopic ?? null;
    case "microConcept":
      return q.microConcept ?? null;
    case "difficulty":
      return q.difficulty ?? null;
    default:
      return null;
  }
}

export async function reviewQuestion(q: QcQuestionInput, passagesText: string, call: ModelCaller): Promise<QuestionReview> {
  const structural = structuralFindings(q);

  let expert: ExpertRun;
  try {
    expert = await runExpert(q, passagesText, call);
  } catch (err) {
    throw new QcReviewError(err instanceof Error ? err.message : String(err), "EXPERT", err instanceof QcModelError ? err.usage : [], { structural });
  }
  const eStatus = expertStatus(q, expert.output, expert.calc, structural);

  let director: DirectorRun;
  try {
    director = await runDirector(q, { output: expert.output, model: expert.model }, call);
  } catch (err) {
    throw new QcReviewError(err instanceof Error ? err.message : String(err), "DIRECTOR", [...expert.usage, ...(err instanceof QcModelError ? err.usage : [])], { structural, expert, expertStatus: eStatus });
  }

  const directorFindings = [...director.solve.findings, ...director.audit.additionalFindings];
  const decision = finalDecision({
    q,
    expert: expert.output,
    expertCalc: expert.calc,
    structural,
    directorSolve: { ...director.solve, findings: directorFindings },
    directorCalc: director.solveCalc,
    directorAudit: director.audit,
  });

  const corrections: ProposedCorrection[] = [];
  expert.output.findings.forEach((f, i) => {
    if (!f.correction) return;
    const verdict = director.audit.verdicts.find((v) => v.finding === i + 1)?.decision;
    if (verdict !== "CONFIRMED" && verdict !== "PARTIALLY_CONFIRMED") return;
    corrections.push({
      from: `EXPERT:${i + 1}`,
      field: f.correction.field,
      language: f.correction.language,
      originalValue: originalOf(q, f.correction.field),
      proposedValue: f.correction.proposedValue,
      reason: f.correction.reason,
      evidence: f.evidence,
      partial: verdict === "PARTIALLY_CONFIRMED",
    });
  });
  directorFindings.forEach((f, i) => {
    if (!f.correction) return;
    corrections.push({
      from: `DIRECTOR:${i + 1}`,
      field: f.correction.field,
      language: f.correction.language,
      originalValue: originalOf(q, f.correction.field),
      proposedValue: f.correction.proposedValue,
      reason: f.correction.reason,
      evidence: f.evidence,
      partial: false,
    });
  });

  return { structural, expert, expertStatus: eStatus, director: { ...director, solve: { ...director.solve, findings: director.solve.findings } }, decision, corrections, usage: [...expert.usage, ...director.usage] };
}
