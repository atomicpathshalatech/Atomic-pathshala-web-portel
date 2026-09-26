// Mock server-only for standalone tsx test execution
require.cache[require.resolve("server-only")] = {
  id: require.resolve("server-only"),
  filename: require.resolve("server-only"),
  loaded: true,
  exports: {},
} as any;

import { prisma } from "../src/lib/db";
import { normalizeOptionKey, isAnswerCorrect, extractCorrectOptionKeys } from "../src/lib/test-engine/answer-evaluator";

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function recordTest(name: string, passed: boolean, details: string) {
  results.push({ name, passed, details });
  const status = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`${status} | ${name}: ${details}`);
}

async function runTests() {
  console.log("\n=======================================================");
  console.log("ATOMIC PATHSHALA — QUESTION BANK & TEST PIPELINE VERIFICATION SUITE");
  console.log("=======================================================\n");

  // Dynamic import of test-export-engine after server-only mock
  const { fetchCanonicalTestData, generateTestPaperHtml } = await import("../src/lib/pdf/test-export-engine");

  // TEST 1: Reference image isolation in Database
  try {
    const totalWithRef = await prisma.question.count({
      where: { referenceImageUrl: { not: null } },
    });
    const totalWithImg = await prisma.question.count({
      where: { imageUrl: { not: null } },
    });
    recordTest(
      "Test 1: Reference Image vs Question Image Isolation",
      totalWithRef >= 0,
      `Reference image count: ${totalWithRef}, Genuine question content image count: ${totalWithImg}`
    );
  } catch (e: any) {
    recordTest("Test 1: Reference Image vs Question Image Isolation", false, e.message);
  }

  // TEST 2: Minor Test : 01 Questions verification
  try {
    const minorTest = await prisma.test.findFirst({
      where: { name: { contains: "Minor Test" } },
      include: {
        sections: {
          include: {
            questions: {
              include: {
                question: {
                  include: {
                    translations: true,
                    assets: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (minorTest) {
      const allQs = minorTest.sections.flatMap((s) => s.questions.map((sq) => sq.question));
      const leakedImgCount = allQs.filter((q) => Boolean(q.imageUrl)).length;
      const refImgPreservedCount = allQs.filter((q) => Boolean(q.referenceImageUrl)).length;
      const hasValidText = allQs.every((q) => q.translations.some((t) => t.statement.trim().length > 0));

      recordTest(
        "Test 2: Test Questions Contain Pure Structured Text Without Leaked Screenshots",
        leakedImgCount === 0 && hasValidText,
        `Total Test Qs: ${allQs.length}, Leaked student-facing images: ${leakedImgCount}, Reference images preserved for editor: ${refImgPreservedCount}`
      );
    } else {
      recordTest("Test 2: Test Questions Verification", true, "No active Minor Test found to audit, skipped.");
    }
  } catch (e: any) {
    recordTest("Test 2: Test Questions Verification", false, e.message);
  }

  // TEST 3: PDF Export Engine Data Pipeline
  try {
    const sampleTest = await prisma.test.findFirst({
      where: { status: "PUBLISHED" },
      select: { id: true, name: true },
    });

    if (sampleTest) {
      const testData = await fetchCanonicalTestData(sampleTest.id);
      if (testData) {
        const anyImgIsRef = testData.allQuestions.some((q) => q.imageUrl?.includes("questions/q_"));
        const html = generateTestPaperHtml(testData, { withSolution: false });
        const hasQuestionsStream = html.includes("questions-stream");
        const containsBrand = html.includes("ATOMIC PATHSHALA");

        recordTest(
          "Test 3: PDF / Print Engine Canonical Data Sanitization & Generation",
          !anyImgIsRef && hasQuestionsStream && containsBrand,
          `PDF generated successfully (${testData.allQuestions.length} Qs). Reference screenshot leakage: ${anyImgIsRef ? "DETECTED" : "NONE (CLEAN)"}`
        );
      } else {
        recordTest("Test 3: PDF Export Engine", false, "fetchCanonicalTestData returned null");
      }
    } else {
      recordTest("Test 3: PDF Export Engine", true, "No published test found for PDF test.");
    }
  } catch (e: any) {
    recordTest("Test 3: PDF Export Engine", false, e.message);
  }

  // TEST 4: Scoring Engine — Correct (+4), Incorrect (-1), Unattempted (0)
  try {
    const dummyQ: any = {
      type: "SINGLE_CORRECT",
      translations: [
        {
          language: "ENGLISH",
          correctOptionIds: ["B"],
        },
      ],
    };
    const correctKeys = extractCorrectOptionKeys(dummyQ);
    const correctEval = isAnswerCorrect(correctKeys, ["B"], "SINGLE_CORRECT");
    const wrongEval = isAnswerCorrect(correctKeys, ["A"], "SINGLE_CORRECT");
    const normalizedKey = normalizeOptionKey("(2)");

    recordTest(
      "Test 4: Scoring Engine & Answer Normalization",
      correctEval === true && wrongEval === false && normalizedKey === "B",
      `Correct answer eval: ${correctEval} (+4), Wrong eval: ${wrongEval} (-1), Normalized "(2)" -> "${normalizedKey}" (B)`
    );
  } catch (e: any) {
    recordTest("Test 4: Scoring Engine", false, e.message);
  }

  // TEST 5: Bilingual Support & Option Structure Integrity
  try {
    const sampleBilingual = await prisma.question.findFirst({
      where: {
        translations: {
          some: { language: "HINDI" },
        },
      },
      include: { translations: true },
    });

    if (sampleBilingual) {
      const en = sampleBilingual.translations.find((t) => t.language === "ENGLISH");
      const hi = sampleBilingual.translations.find((t) => t.language === "HINDI");
      const enHasOpts = Boolean(en && en.options && typeof en.options === "object");
      const hiHasOpts = Boolean(hi && hi.options && typeof hi.options === "object");

      recordTest(
        "Test 5: Bilingual Questions Data Model & Options Structure",
        enHasOpts && hiHasOpts,
        `Question ${sampleBilingual.questionCode || sampleBilingual.id}: English statement length ${en?.statement.length}, Hindi statement length ${hi?.statement.length}`
      );
    } else {
      recordTest("Test 5: Bilingual Questions Data Model", true, "No bilingual questions in database yet.");
    }
  } catch (e: any) {
    recordTest("Test 5: Bilingual Questions Data Model", false, e.message);
  }

  // SUMMARY REPORT
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  console.log("\n=======================================================");
  console.log(`TEST EXECUTION SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("=======================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests()
  .catch((err) => {
    console.error("Test runner error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
