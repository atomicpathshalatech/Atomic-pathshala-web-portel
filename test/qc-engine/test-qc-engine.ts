/**
 * ATOMIC PATHSHALA — MULTI-AI QC ENGINE ACCEPTANCE TEST SUITE
 * Validates deterministic rules, chemical charge checks, mathematical checks,
 * disagreement detection, and consensus status mappings.
 */

import { validateChemistry } from "../../src/lib/question-qc/chemical-validator";
import { validateMathematics } from "../../src/lib/question-qc/math-validator";
import { evaluateFinalQualityDecision } from "../../src/lib/question-qc/decision-engine";
import { QuestionSnapshot, SingleModelReview } from "../../src/lib/ai-provider/types";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${testName} ${detail ? `(${detail})` : ""}`);
    failedCount++;
  }
}

console.log("=== RUNNING ATOMIC PATHSHALA QC ENGINE TEST SUITE ===");

// --------------------------------------------------------------------------
// TEST 1: Chemical charge imbalance and bracket validation
// --------------------------------------------------------------------------
console.log("\n[1] Testing Chemical Validation & Charge Checks...");
{
  // A: Reaction charge conservation failure
  const badRedox = "Consider the half reaction: $Fe^{2+} \\rightarrow Fe^{3+} + 2e^{-}$. What is the standard potential?";
  const chemResult1 = validateChemistry(badRedox);
  assert(
    !chemResult1.valid && chemResult1.ionDiscrepancies.length > 0,
    "Detects reaction charge imbalance (Fe2+ -> Fe3+ + 2e-)",
    JSON.stringify(chemResult1.ionDiscrepancies)
  );

  // B: Balanced redox reaction
  const goodRedox = "For the reaction $Fe^{2+} \\rightarrow Fe^{3+} + e^{-}$, the electron count is:";
  const chemResult2 = validateChemistry(goodRedox);
  assert(chemResult2.chargeBalanced, "Validates balanced redox reaction (Fe2+ -> Fe3+ + e-)");

  // C: Binary ionic stoichiometry imbalance (AlCl2 is invalid)
  const badFormula = "The compound AlCl2 decomposes rapidly upon heating.";
  const chemResult3 = validateChemistry(badFormula);
  assert(
    !chemResult3.valid && chemResult3.ionDiscrepancies.length > 0,
    "Detects invalid ionic stoichiometry (AlCl2)",
    JSON.stringify(chemResult3.ionDiscrepancies)
  );

  // D: Valid complex brackets
  const goodComplex = "The coordination entity $[Co(NH3)6]^{3+}$ has an octahedral geometry.";
  const chemResult4 = validateChemistry(goodComplex);
  assert(chemResult4.bracketBalanced, "Validates balanced complex brackets [Co(NH3)6]3+");

  // E: Unclosed complex brackets
  const badComplex = "The coordination entity $[Co(NH3)6^{3+}$ has unclosed brackets.";
  const chemResult5 = validateChemistry(badComplex);
  assert(!chemResult5.bracketBalanced, "Detects unclosed chemical brackets");
}

// --------------------------------------------------------------------------
// TEST 2: Mathematical / KaTeX syntax and arithmetic checks
// --------------------------------------------------------------------------
console.log("\n[2] Testing Mathematical & KaTeX Validator...");
{
  // A: Arithmetic discrepancy in solution
  const badArithSol = "Using $v = u + at$, we have $10 * 2 = 25$ meters per second.";
  const mathResult1 = validateMathematics("Find velocity", badArithSol);
  assert(
    !mathResult1.valid && mathResult1.arithmeticErrors.length > 0,
    "Detects arithmetic error in solution (10 * 2 = 25)",
    JSON.stringify(mathResult1.arithmeticErrors)
  );

  // B: Correct arithmetic in solution
  const goodArithSol = "Using $v = u + at$, we get $10 * 2 = 20$ m/s.";
  const mathResult2 = validateMathematics("Find velocity", goodArithSol);
  assert(mathResult2.arithmeticErrors.length === 0, "Accepts correct arithmetic (10 * 2 = 20)");

  // C: Unbalanced dollar delimiter
  const badLatex = "Find the electric field $E = \\frac{kq}{r^2 when distance doubles.";
  const mathResult3 = validateMathematics(badLatex);
  assert(!mathResult3.valid && mathResult3.syntaxErrors.length > 0, "Detects unbalanced '$' math delimiter");

  // D: Malformed frac command
  const badFrac = "The formula is $\\frac{1}$.";
  const mathResult4 = validateMathematics(badFrac);
  assert(!mathResult4.valid, "Detects malformed LaTeX \\frac command");
}

// --------------------------------------------------------------------------
// TEST 3: Answer Key Mismatch Detection
// --------------------------------------------------------------------------
console.log("\n[3] Testing Answer Key Mismatch Detection...");
{
  const snapshot: QuestionSnapshot = {
    statement: "What is the unit of electric capacitance?",
    options: { A: "Henry", B: "Farad", C: "Tesla", D: "Weber" },
    storedAnswer: ["A"], // WRONG: Stored key says Option A (Henry)
    solution: "The SI unit of capacitance is Farad.",
    subject: "PHYSICS",
  };

  const geminiReview: SingleModelReview = {
    provider: "gemini",
    model: "gemini-1.5-flash",
    solvedAnswer: "B", // Correctly derived Farad
    answerMatches: false,
    isScientificallyCorrect: true,
    isMathematicallyCorrect: true,
    scientificErrors: [],
    mathematicalErrors: [],
    solutionCorrections: null,
    suggestedQuestion: null,
    suggestedOptions: null,
    suggestedAnswer: ["B"],
    topicCorrections: null,
    ncertAlignment: { supported: true, status: "DIRECT" },
    ambiguityDetected: false,
    multipleCorrectOptionsDetected: false,
    decision: "REJECT",
    rejectionReasons: ["Answer key mismatch: Stored is A, but Farad is B"],
    confidenceScore: 0.98,
    tokenUsage: { inputTokens: 100, outputTokens: 50, durationMs: 100, estimatedCostUsd: 0 },
  };

  const openaiReview: SingleModelReview = {
    ...geminiReview,
    provider: "openai",
    model: "gpt-4o",
    solvedAnswer: "B",
  };

  const claudeReview: SingleModelReview = {
    ...geminiReview,
    provider: "claude",
    model: "claude-3-5-sonnet",
    solvedAnswer: "B",
  };

  const mathVal = validateMathematics(snapshot.statement, snapshot.solution);
  const chemVal = validateChemistry(snapshot.statement, snapshot.solution);

  const decision = evaluateFinalQualityDecision(snapshot, geminiReview, openaiReview, claudeReview, mathVal, chemVal);

  assert(
    decision.finalStatus === "ANSWER_KEY_MISMATCH",
    `Classifies wrong stored answer as ANSWER_KEY_MISMATCH (got: ${decision.finalStatus})`
  );
  assert(!decision.eligibleForApproval, "Question with answer key mismatch is not eligible for auto-approval");
}

// --------------------------------------------------------------------------
// TEST 4: Model Disagreement Handling (Never Hidden, No Plain Majority Vote)
// --------------------------------------------------------------------------
console.log("\n[4] Testing Disagreement Detection Between Models...");
{
  const snapshot: QuestionSnapshot = {
    statement: "Which statement is ambiguous?",
    options: { A: "1", B: "2", C: "3", D: "4" },
    storedAnswer: ["B"],
    solution: "Explanation",
    subject: "BOTANY",
  };

  const geminiReview: SingleModelReview = {
    provider: "gemini",
    model: "gemini-1.5-flash",
    solvedAnswer: "B",
    answerMatches: true,
    isScientificallyCorrect: true,
    isMathematicallyCorrect: true,
    scientificErrors: [],
    mathematicalErrors: [],
    solutionCorrections: null,
    suggestedQuestion: null,
    suggestedOptions: null,
    suggestedAnswer: null,
    topicCorrections: null,
    ncertAlignment: { supported: true, status: "DIRECT" },
    ambiguityDetected: false,
    multipleCorrectOptionsDetected: false,
    decision: "APPROVE",
    rejectionReasons: [],
    confidenceScore: 0.9,
    tokenUsage: { inputTokens: 100, outputTokens: 50, durationMs: 100, estimatedCostUsd: 0 },
  };

  const openaiReview: SingleModelReview = {
    ...geminiReview,
    provider: "openai",
    model: "gpt-4o",
    solvedAnswer: "C", // OpenAI solved C
    answerMatches: false,
    decision: "REJECT",
  };

  const claudeReview: SingleModelReview = {
    ...geminiReview,
    provider: "claude",
    model: "claude-3-5-sonnet",
    solvedAnswer: "B", // Claude solved B
    ambiguityDetected: true, // Claude detected ambiguity
    decision: "NEEDS_REVISION",
  };

  const mathVal = validateMathematics(snapshot.statement, snapshot.solution);
  const chemVal = validateChemistry(snapshot.statement, snapshot.solution);

  const decision = evaluateFinalQualityDecision(snapshot, geminiReview, openaiReview, claudeReview, mathVal, chemVal);

  assert(
    decision.disagreements.length > 0,
    `Disagreements detected and recorded (count: ${decision.disagreements.length})`
  );
  assert(
    decision.finalStatus === "ANSWER_KEY_MISMATCH" || decision.finalStatus === "MANUAL_REVIEW_REQUIRED",
    `Flags disagreement as requiring manual review or mismatch (got: ${decision.finalStatus})`
  );
  assert(!decision.eligibleForApproval, "Disagreement prevents silent majority approval");
}

// --------------------------------------------------------------------------
// TEST 5: Unanimous Approval Flow
// --------------------------------------------------------------------------
console.log("\n[5] Testing Unanimous Approval Flow...");
{
  const snapshot: QuestionSnapshot = {
    statement: "What is the charge on an electron?",
    options: {
      A: "$-1.6 \\times 10^{-19}\\text{ C}$",
      B: "$+1.6 \\times 10^{-19}\\text{ C}$",
      C: "$-1.6 \\times 10^{-18}\\text{ C}$",
      D: "$0\\text{ C}$",
    },
    storedAnswer: ["A"],
    solution: "The elementary charge of an electron is $-1.6 \\times 10^{-19}\\text{ C}$.",
    subject: "PHYSICS",
  };

  const mockApprove = (provider: any, model: string): SingleModelReview => ({
    provider,
    model,
    solvedAnswer: "A",
    answerMatches: true,
    isScientificallyCorrect: true,
    isMathematicallyCorrect: true,
    scientificErrors: [],
    mathematicalErrors: [],
    solutionCorrections: null,
    suggestedQuestion: null,
    suggestedOptions: null,
    suggestedAnswer: null,
    topicCorrections: null,
    ncertAlignment: { supported: true, status: "DIRECT", book: "NCERT Class 12", pageNumber: 3 },
    ambiguityDetected: false,
    multipleCorrectOptionsDetected: false,
    decision: "APPROVE",
    rejectionReasons: [],
    confidenceScore: 0.99,
    tokenUsage: { inputTokens: 100, outputTokens: 50, durationMs: 100, estimatedCostUsd: 0 },
  });

  const mathVal = validateMathematics(snapshot.statement, snapshot.solution);
  const chemVal = validateChemistry(snapshot.statement, snapshot.solution);

  const decision = evaluateFinalQualityDecision(
    snapshot,
    mockApprove("gemini", "gemini-1.5-flash"),
    mockApprove("openai", "gpt-4o"),
    mockApprove("claude", "claude-3-5-sonnet"),
    mathVal,
    chemVal
  );

  assert(decision.finalStatus === "APPROVED_BY_ALL", `Unanimous review yields APPROVED_BY_ALL (got: ${decision.finalStatus})`);
  assert(decision.eligibleForApproval === true, "Unanimous review question is eligible for final approval");
}

console.log(`\n=== TEST SUITE COMPLETE: ${passedCount} PASSED, ${failedCount} FAILED ===\n`);
if (failedCount > 0) {
  process.exit(1);
}
