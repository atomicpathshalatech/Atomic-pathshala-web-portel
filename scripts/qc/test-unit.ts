// Unit tests of the QC pipeline's deterministic parts (no model, no database).
//   npx tsx scripts/qc/test-unit.ts
import "./_stub";
import { evaluateExpression, runCalcChecks, valuesAgree } from "../../src/lib/qc/calc";
import { agentsAgree, compareWithStored, expertStatus, finalDecision, structuralFindings } from "../../src/lib/qc/decide";
import { normalizeAnswerKeys, normalizeOptions, qcContentHash, toQcQuestion, type QcQuestionInput } from "../../src/lib/qc/question";
import { directorAuditSchema, expertOutputSchema } from "../../src/lib/qc/schema";

let pass = 0;
let fail = 0;
const check = (ok: boolean, name: string, detail?: unknown) => {
  if (ok) pass++;
  else {
    fail++;
    console.log("FAIL", name, detail === undefined ? "" : JSON.stringify(detail));
  }
};
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(b));

// ── calculator ──
check(near(evaluateExpression("0.5*2*5^2"), 25), "KE expression");
check(near(evaluateExpression("(1/2)(2)(5)^2"), 25), "implicit multiplication");
check(near(evaluateExpression("6.022×10^23 × 2"), 1.2044e24), "scientific notation with ×");
check(near(evaluateExpression("6.02e23/2"), 3.01e23), "e-notation");
check(near(evaluateExpression("-log(10^-3)"), 3), "pH = -log");
check(near(evaluateExpression("sqrt(2*9.8*20)"), Math.sqrt(392)), "sqrt");
check(near(evaluateExpression("sind(30)"), 0.5), "sine in degrees");
check(near(evaluateExpression("2^3^2"), 512), "power is right-associative");
check(near(evaluateExpression("-2^2"), -4), "unary minus binds looser than power");
check(near(evaluateExpression("1,000 + 1"), 1001), "thousands separator");
check(near(evaluateExpression("3²+4²"), 25), "superscripts");
for (const bad of ["", "2+", "alert(1)", "process.exit()", "2 + x", "1/0", "a=5"]) {
  let threw = false;
  try {
    evaluateExpression(bad);
  } catch {
    threw = true;
  }
  check(threw, `rejects "${bad}"`);
}
check(valuesAgree(25, 25.1) && !valuesAgree(25, 26) && valuesAgree(0, 0.004), "rounding tolerance");
const cc = runCalcChecks([
  { expression: "20/40", claimedValue: 2 },
  { expression: "20/40", claimedValue: 0.5 },
  { expression: "foo(2)", claimedValue: 1 },
]);
check(cc[0]!.agrees === false && cc[1]!.agrees === true && cc[2]!.evaluated === false && cc[2]!.agrees === null, "calc checks: wrong / right / not evaluable", cc);

// ── question normalisation ──
check(JSON.stringify(normalizeOptions({ a: "x", b: "y" })) === JSON.stringify([{ key: "A", text: "x" }, { key: "B", text: "y" }]), "options object");
check(normalizeOptions(["p", "q"])[1]!.key === "B", "options array of strings");
check(normalizeOptions([{ id: "c", text: "z" }])[0]!.key === "C", "options array of objects");
check(JSON.stringify(normalizeAnswerKeys(["b"])) === JSON.stringify(["B"]) && JSON.stringify(normalizeAnswerKeys("0.5")) === JSON.stringify(["0.5"]), "answer keys");
const row = {
  id: "q1",
  questionCode: "C-1",
  subject: "Chemistry",
  chapter: "c",
  topic: "t",
  subTopic: null,
  microConcept: null,
  type: "SINGLE_CORRECT",
  difficulty: "EASY",
  examLevel: "NEET",
  imageUrl: null,
  solution: "top",
  translations: [
    { language: "HINDI", statement: "हिन्दी", options: { A: "1", B: "2" }, correctOptionIds: ["B"], solution: null },
    { language: "english", statement: "English ![fig](http://x/y.png)", options: { A: "1", B: "2" }, correctOptionIds: ["A"], solution: "sol" },
  ],
};
const built = toQcQuestion(row)!;
check(
  built.language === "ENGLISH" && built.storedAnswer[0] === "A" && built.otherLanguageAnswer![0] === "B" && built.hasImage && built.solution === "sol",
  "row → QC question (English preferred, lower-case language, image detected)",
  built
);
check(toQcQuestion({ ...row, translations: [] }) === null, "no translation → null");
check(
  qcContentHash(built) === qcContentHash({ ...built, statement: built.statement + "   " }) && qcContentHash(built) !== qcContentHash({ ...built, storedAnswer: ["B"] }),
  "content hash ignores whitespace, changes with the key"
);

// ── answer comparison ──
const q = (over: Partial<QcQuestionInput> = {}): QcQuestionInput => ({
  id: "x",
  subject: "Physics",
  type: "SINGLE_CORRECT",
  language: "ENGLISH",
  statement: "s",
  hasImage: false,
  solution: "a full solution",
  options: [
    { key: "A", text: "10" },
    { key: "B", text: "15" },
    { key: "C", text: "25" },
    { key: "D", text: "30" },
  ],
  storedAnswer: ["B"],
  ...over,
});
const d = (keys: string[], value?: string, outcome: "SOLVED" | "CANNOT_SOLVE" = "SOLVED") => ({ optionKeys: keys, value, outcome, reasoning: "r" });
check(compareWithStored(q(), d(["C"])) === "MISMATCH", "derived C vs stored B → mismatch");
check(compareWithStored(q(), d(["B"])) === "MATCH", "derived B vs stored B → match");
check(compareWithStored(q(), d([], "27")) === "MISMATCH", "solved, no option right → mismatch");
check(compareWithStored(q(), d([], undefined, "CANNOT_SOLVE")) === "UNDETERMINED", "cannot solve → undetermined");
check(compareWithStored(q({ storedAnswer: [] }), d(["B"])) === "UNDETERMINED", "no stored key → undetermined");
check(compareWithStored(q({ type: "MULTIPLE_CORRECT", storedAnswer: ["A", "C"] }), d(["C", "A"])) === "MATCH", "multiple correct, order ignored");
check(compareWithStored(q({ type: "NUMERICAL", options: [], storedAnswer: ["0.5"] }), d([], "0.2 mol/L")) === "MISMATCH", "numerical 0.2 vs stored 0.5");
check(compareWithStored(q({ type: "NUMERICAL", options: [], storedAnswer: ["0.2"] }), d([], "0.2 mol/L")) === "MATCH", "numerical value with unit");
check(
  agentsAgree(q(), d(["C"]), d(["C"])) === true && agentsAgree(q(), d(["C"]), d(["B"])) === false && agentsAgree(q(), d(["C"]), d([], undefined, "CANNOT_SOLVE")) === null,
  "agents agree / disagree / unknown"
);

// ── structural findings ──
const cats = (qq: QcQuestionInput) => structuralFindings(qq).map((f) => f.category);
check(cats(q()).length === 0, "clean record → no structural findings", cats(q()));
check(cats(q({ storedAnswer: [] })).includes("ANSWER_KEY_MISMATCH"), "no key stored");
check(cats(q({ storedAnswer: ["E"] })).includes("ANSWER_KEY_MISMATCH"), "key not among options");
check(cats(q({ storedAnswer: ["A", "B"] })).includes("MULTIPLE_CORRECT_OPTIONS"), "two keys on single-correct");
check(
  cats(
    q({
      options: [
        { key: "A", text: "Same" },
        { key: "B", text: " same " },
      ],
    })
  ).includes("DUPLICATE_OR_EQUIVALENT_OPTIONS"),
  "duplicate options"
);
check(cats(q({ otherLanguageAnswer: ["C"] })).includes("LANGUAGE_MISMATCH"), "bilingual key mismatch");
check(cats(q({ solution: " " })).includes("SOLUTION_INCOMPLETE"), "missing solution");

// ── schema validation ──
const goodExpert = {
  derivedAnswer: { optionKeys: ["c"], value: 25, outcome: "solved", reasoning: "KE" },
  calculations: [{ expression: "0.5*2*25", claimedValue: "25" }],
  solutionCheck: { status: "pass" },
  formulaCheck: { status: "not applicable" },
  unitsCheck: { status: "PASS", notes: null },
  classification: { microConcepts: ["Kinetic energy"], difficulty: "easy" },
  ncert: { status: "NCERT_APPLICATION", supportingPassage: null },
  findings: [{ category: "answer key mismatch", severity: "critical", description: "key says B", correction: { field: "correctAnswer", proposedValue: "C", reason: "25 J" } }],
  confidence: "0.9",
};
const pe = expertOutputSchema.safeParse(goodExpert);
check(
  pe.success &&
    pe.data.derivedAnswer.optionKeys[0] === "C" &&
    pe.data.derivedAnswer.outcome === "SOLVED" &&
    pe.data.findings[0]!.category === "ANSWER_KEY_MISMATCH" &&
    pe.data.formulaCheck.status === "NOT_APPLICABLE" &&
    pe.data.calculations[0]!.claimedValue === 25,
  "expert output: tolerant of case / strings, normalised",
  pe.success ? undefined : pe.error.issues
);
check(!expertOutputSchema.safeParse({ ...goodExpert, derivedAnswer: { optionKeys: ["C"] } }).success, "expert output without outcome / reasoning is rejected");
check(!expertOutputSchema.safeParse({ ...goodExpert, findings: [{ category: "MADE_UP", severity: "HIGH", description: "x" }] }).success, "unknown finding category is rejected");
check(!expertOutputSchema.safeParse({ ...goodExpert, ncert: { status: "PAGE_42" } }).success, "invalid NCERT status is rejected");
const madeUpPage = expertOutputSchema.safeParse({ ...goodExpert, ncert: { status: "NCERT_DIRECT", supportingPassage: "page 57" } });
check(madeUpPage.success && madeUpPage.data.ncert.supportingPassage === undefined, "a made-up page reference is dropped, not stored");
check(directorAuditSchema.safeParse({ verdicts: [{ finding: "1", decision: "false positive", reason: "ok" }] }).success, "director audit: tolerant parse");
check(!directorAuditSchema.safeParse({ verdicts: [{ finding: 1, decision: "MAYBE", reason: "x" }] }).success, "director audit: invalid decision rejected");

// ── decision rules ──
const expert = (over: Record<string, unknown> = {}) =>
  expertOutputSchema.parse({ ...goodExpert, findings: [], derivedAnswer: { optionKeys: ["B"], outcome: "SOLVED", reasoning: "r" }, ...over });
const dsolve = (keys: string[], findings: unknown[] = []) => ({ derivedAnswer: d(keys), calculations: [], findings: findings as never, confidence: 0.9 });
const audit = (verdicts: unknown[] = []) => directorAuditSchema.parse({ verdicts, additionalFindings: [] });
type Calc = Parameters<typeof finalDecision>[0]["expertCalc"];
const decide = (args: { q?: QcQuestionInput; e?: ReturnType<typeof expert>; ds?: ReturnType<typeof dsolve>; a?: ReturnType<typeof audit>; eCalc?: Calc } = {}) => {
  const qq = args.q ?? q();
  return finalDecision({
    q: qq,
    expert: args.e ?? expert(),
    expertCalc: args.eCalc ?? [],
    structural: structuralFindings(qq),
    directorSolve: args.ds ?? dsolve(["B"]),
    directorCalc: [],
    directorAudit: args.a ?? audit(),
  });
};
const derivedC = { optionKeys: ["C"], outcome: "SOLVED", reasoning: "r" };
const keyFinding = { category: "ANSWER_KEY_MISMATCH", severity: "CRITICAL", description: "key wrong" };
const highFinding = { category: "SOLUTION_ERROR", severity: "HIGH", description: "wrong formula" };
const confirm1 = [{ finding: 1, decision: "CONFIRMED", reason: "yes" }];

check(decide().status === "VERIFIED", "both reach the stored key, nothing found → VERIFIED", decide());
check(decide({ e: expert({ derivedAnswer: derivedC, findings: [keyFinding] }), ds: dsolve(["C"]), a: audit(confirm1) }).status === "FAILED", "both reach C against stored B → FAILED");
check(
  decide({ e: expert({ derivedAnswer: derivedC, findings: [keyFinding] }), ds: dsolve(["B"]), a: audit([{ finding: 1, decision: "FALSE_POSITIVE", reason: "expert slipped" }]) }).status === "NEEDS_HUMAN_REVIEW",
  "reviewers disagree → a person decides (never auto-fail, never auto-verify)"
);
check(
  decide({ ds: dsolve(["B"], [{ category: "QUESTION_AMBIGUOUS", severity: "HIGH", description: "missing condition" }]) }).status === "NEEDS_HUMAN_REVIEW",
  "a high finding only the Director saw → a person decides"
);
check(decide({ e: expert({ findings: [highFinding] }), a: audit(confirm1) }).status === "FAILED", "answer right but a confirmed high solution error → FAILED");
check(decide({ e: expert({ findings: [highFinding] }), a: audit([{ finding: 1, decision: "FALSE_POSITIVE", reason: "it is fine" }]) }).status === "VERIFIED", "a high finding the Director rejects does not block");
check(decide({ e: expert({ findings: [highFinding] }) }).status === "NEEDS_HUMAN_REVIEW", "a high finding with no verdict is not silently dropped");
check(
  decide({ e: expert({ findings: [{ category: "TYPO_OR_FORMATTING", severity: "LOW", description: "typo" }] }), a: audit(confirm1) }).status === "VERIFIED",
  "a confirmed LOW finding does not block"
);
check(
  decide({ e: expert({ findings: [{ category: "CLASSIFICATION_ERROR", severity: "MEDIUM", description: "topic" }] }), a: audit(confirm1) }).status === "NEEDS_HUMAN_REVIEW",
  "a confirmed MEDIUM finding → its correction waits for a person"
);
check(decide({ q: q({ hasImage: true }) }).status === "NEEDS_HUMAN_REVIEW", "a picture the reviewers cannot see → a person");
check(decide({ ds: { ...dsolve([]), derivedAnswer: d([], undefined, "CANNOT_SOLVE") } }).status === "NEEDS_HUMAN_REVIEW", "Director could not solve → a person");
check(
  decide({ eCalc: [{ expression: "1+1", claimedValue: 3, evaluated: true, computedValue: 2, agrees: false }] }).status === "NEEDS_HUMAN_REVIEW",
  "a calculation that does not reproduce → a person"
);
check(decide({ q: q({ otherLanguageAnswer: ["C"] }) }).status === "FAILED", "bilingual key mismatch → FAILED without any model opinion");
const es = expertStatus(q(), expert({ derivedAnswer: derivedC }), [], []);
check(es.status === "FAIL" && es.comparison === "MISMATCH", "expert status: mismatch → FAIL");
check(
  expertStatus(q(), expert({ confidence: 0.01 }), [], []).status === "PASS" && decide({ e: expert({ confidence: 0.01 }) }).status === "VERIFIED",
  "model confidence is not an input to any status"
);

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
