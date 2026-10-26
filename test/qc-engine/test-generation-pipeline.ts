/**
 * ATOMIC PATHSHALA — END-TO-END QC PIPELINE INTEGRATION TEST
 *
 * Tests the complete question generation & multi-model audit pipeline:
 * 1. Multi-model review orchestration (Gemini L1, OpenAI L2, Claude L3)
 * 2. Deterministic KaTeX and Chemical charge validation
 * 3. Final consensus & quality decision engine
 * 4. Safe approval gate (never auto-approving unverified/disputed questions)
 * 5. Database persistence into ai_generated_questions and question_review_audits
 */

import { prisma } from "../../src/lib/db";
import { runMultiModelAudit } from "../../src/lib/ai-provider/multi-model-hub";
import { QuestionSnapshot } from "../../src/lib/ai-provider/types";

async function runEndToEndPipelineTest() {
  console.log("================================================================================");
  console.log("ATOMIC PATHSHALA — RUNNING FULL MULTI-MODEL QC PIPELINE VERIFICATION");
  console.log("================================================================================\n");

  let testsPassed = 0;
  let totalTests = 0;

  function assert(condition: boolean, desc: string) {
    totalTests++;
    if (condition) {
      console.log(`[PASS] ${desc}`);
      testsPassed++;
    } else {
      console.error(`[FAIL] ${desc}`);
      throw new Error(`Assertion failed: ${desc}`);
    }
  }

  // TEST 1: Run Multi-Model QC Audit on a Sample NEET Physics Question
  console.log("--- TEST 1: Multi-Model Audit Execution ---");
  const sampleSnapshot: QuestionSnapshot = {
    statement: "An object is thrown vertically upwards with a velocity of $20\\text{ m/s}$. Find the maximum height reached. ($g = 10\\text{ m/s}^2$)",
    options: {
      A: "$10\\text{ m}$",
      B: "$20\\text{ m}$",
      C: "$30\\text{ m}$",
      D: "$40\\text{ m}$",
    },
    storedAnswer: ["B"],
    solution: "Using $v^2 = u^2 - 2gh$, at maximum height $v = 0$. So $0 = 20^2 - 2(10)h \\implies 20h = 400 \\implies h = 20\\text{ m}$.",
    subject: "Physics",
    chapter: "Motion in a Straight Line",
    topic: "Kinematics Equations",
    difficulty: "EASY",
  };

  const auditResult = await runMultiModelAudit(sampleSnapshot, "Standard NCERT Class 11 Physics Chapter 3.", {
    persist: false,
  });

  assert(Boolean(auditResult), "Multi-model audit returned a valid result object");
  assert(Boolean(auditResult.geminiReview), "Gemini L1 Review executed and populated");
  assert(Boolean(auditResult.openaiReview), "OpenAI L2 Review executed and populated");
  assert(Boolean(auditResult.claudeReview), "Claude L3 Review executed and populated");
  assert(Boolean(auditResult.mathValidation), "Deterministic Math Validation executed");
  assert(Boolean(auditResult.chemValidation), "Deterministic Chemical Validation executed");
  assert(Boolean(auditResult.finalDecision), "Deterministic Consensus Decision computed");

  console.log(`-> Gemini L1 Review: Solved [${auditResult.geminiReview.solvedAnswer}], Decision: ${auditResult.geminiReview.decision}`);
  console.log(`-> OpenAI L2 Review: Solved [${auditResult.openaiReview.solvedAnswer || "N/A"}], Decision: ${auditResult.openaiReview.decision}`);
  console.log(`-> Claude L3 Review: Solved [${auditResult.claudeReview.solvedAnswer || "N/A"}], Decision: ${auditResult.claudeReview.decision}`);
  console.log(`-> Math Validation: Valid: ${auditResult.mathValidation.valid}`);
  console.log(`-> Final Quality Status: ${auditResult.finalDecision.finalStatus}`);
  console.log(`-> Eligible For Approval: ${auditResult.finalDecision.eligibleForApproval}`);

  // TEST 2: Truthful Handling of Missing API Keys
  console.log("\n--- TEST 2: Safe Approval Gate & Missing Provider Verification ---");
  const openAiKeyPresent = Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== "");
  if (!openAiKeyPresent) {
    assert(
      auditResult.openaiReview.decision === "REJECT",
      "Unconfigured OpenAI key safely results in REJECT decision"
    );
    assert(
      auditResult.openaiReview.rejectionReasons.some((r) => r.includes("API_FAILURE")),
      "Unconfigured OpenAI key explicitly reports API_FAILURE rejection reason"
    );
    assert(
      auditResult.finalDecision.eligibleForApproval === false,
      "Safe Approval Gate prevents question from auto-passing when OpenAI verification is missing"
    );
  }

  // TEST 3: Deterministic Disagreement Detection on Wrong Answer
  console.log("\n--- TEST 3: Deterministic Disagreement Detection ---");
  const disputedSnapshot: QuestionSnapshot = {
    statement: "What is the unit of electric charge?",
    options: {
      A: "Coulomb",
      B: "Ampere",
      C: "Volt",
      D: "Ohm",
    },
    storedAnswer: ["B"], // WRONG on purpose (Coulomb is A, but stored is B)
    solution: "The SI unit of electric charge is Coulomb.",
    subject: "Physics",
    chapter: "Electrostatics",
    topic: "Electric Charge",
    difficulty: "EASY",
  };

  const disputedAudit = await runMultiModelAudit(disputedSnapshot);
  assert(
    disputedAudit.finalDecision.eligibleForApproval === false,
    "Disputed / wrong answer key question is NEVER eligible for auto-approval"
  );
  console.log(`-> Disputed Question Status: ${disputedAudit.finalDecision.finalStatus}`);

  // TEST 4: PostgreSQL Database Persistence
  console.log("\n--- TEST 4: PostgreSQL Database Persistence ---");
  const anyUser = await prisma.user.findFirst();
  if (!anyUser) {
    throw new Error("No user found in database for test");
  }

  const testBatch = await prisma.aiGenerationBatch.create({
    data: {
      batchCode: `TEST-QC-${Date.now().toString().slice(-6)}`,
      method: "AI",
      subject: "Physics",
      chapter: "Kinematics",
      topics: ["Motion in a Straight Line"],
      difficulties: ["EASY"],
      questionTypes: ["SINGLE_CORRECT"],
      language: "ENGLISH",
      totalRequested: 1,
      status: "PROCESSING",
      progress: 50,
      currentStep: "Running test pipeline verification...",
      createdById: anyUser.id,
    },
  });

  const createdGeneratedQuestion = await prisma.aiGeneratedQuestion.create({
    data: {
      batchId: testBatch.id,
      questionIndex: 1,
      statementEn: sampleSnapshot.statement,
      optionsEn: sampleSnapshot.options as any,
      correctAnswer: sampleSnapshot.storedAnswer,
      solutionEn: sampleSnapshot.solution,
      subject: sampleSnapshot.subject,
      chapter: sampleSnapshot.chapter,
      topic: sampleSnapshot.topic,
      difficulty: "EASY",
      questionType: "SINGLE_CORRECT",
      language: "ENGLISH",
      validationStatus: auditResult.finalDecision.finalStatus,
      validationReport: {
        isValid: auditResult.finalDecision.eligibleForApproval,
        validationStatus: auditResult.finalDecision.finalStatus,
        issues: auditResult.finalDecision.disagreements,
        qcPayload: auditResult,
      } as any,
      qualityScore: {
        contentAccuracy: 95,
        answerConfidence: 95,
        ncertAlignment: 95,
        neetRelevance: 95,
        languageQuality: 95,
        overallScore: 95,
      } as any,
    },
  });

  const createdAudit = await prisma.questionReviewAudit.create({
    data: {
      generatedQId: createdGeneratedQuestion.id,
      snapshot: sampleSnapshot as any,
      geminiReview: auditResult.geminiReview as any,
      openaiReview: auditResult.openaiReview as any,
      claudeReview: auditResult.claudeReview as any,
      mathValidation: auditResult.mathValidation as any,
      chemValidation: auditResult.chemValidation as any,
      finalDecision: auditResult.finalDecision as any,
      finalStatus: auditResult.finalDecision.finalStatus,
      disagreements: auditResult.finalDecision.disagreements as any,
      reasons: auditResult.finalDecision.reasons as any,
      tokenUsage: {
        gemini: auditResult.geminiReview.tokenUsage,
        openai: auditResult.openaiReview.tokenUsage,
        claude: auditResult.claudeReview.tokenUsage,
      } as any,
    },
  });

  assert(Boolean(createdGeneratedQuestion.id), "AiGeneratedQuestion created with validationReport.qcPayload");
  assert(Boolean(createdAudit.id), "QuestionReviewAudit created and linked with generatedQId");

  // Query back to verify relational integrity
  const fetchedAudit = await prisma.questionReviewAudit.findFirst({
    where: { generatedQId: createdGeneratedQuestion.id },
  });
  assert(Boolean(fetchedAudit), "Successfully queried QuestionReviewAudit by generatedQId");
  assert(
    fetchedAudit?.finalStatus === auditResult.finalDecision.finalStatus,
    `QuestionReviewAudit finalStatus matches engine decision (${fetchedAudit?.finalStatus})`
  );

  // Clean up test records
  await prisma.questionReviewAudit.delete({ where: { id: createdAudit.id } });
  await prisma.aiGeneratedQuestion.delete({ where: { id: createdGeneratedQuestion.id } });
  await prisma.aiGenerationBatch.delete({ where: { id: testBatch.id } });
  console.log("-> Cleaned up test database records successfully.");

  console.log("\n================================================================================");
  console.log(`ALL TESTS PASSED: ${testsPassed} / ${totalTests} verification checks succeeded!`);
  console.log("================================================================================");
}

runEndToEndPipelineTest()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("Pipeline test failed:", err);
    process.exit(1);
  });
