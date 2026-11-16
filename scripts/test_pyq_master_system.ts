import { prisma } from "../src/lib/db";
import { ensureStandardExams } from "../src/lib/pyq/exams-service";
import { buildQuestionSlug, buildChapterSlug, buildExamSlug } from "../src/lib/pyq/slug-generator";
import { questionFingerprint } from "../src/lib/pyq/fingerprint";
import { backfillQuestionSlugs } from "../src/lib/pyq/backfill-slugs";

async function runTests() {
  console.log("================================================================================");
  console.log("ATOMIC PATHSHALA — MASTER PYQ SYSTEM INTEGRATION & VERIFICATION SUITE");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(name: string, condition: boolean, detail = "") {
    if (condition) {
      console.log(`✓ PASS: ${name} ${detail ? "(" + detail + ")" : ""}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${name} ${detail ? "(" + detail + ")" : ""}`);
      failed++;
    }
  }

  // TEST 1: Standard Exams Initialization
  try {
    const exams = await ensureStandardExams();
    const slugs = exams.map((e) => e.slug);
    assert(
      "Standard Exams Initialization",
      slugs.includes("neet-ug") && slugs.includes("jee-main") && slugs.includes("jee-advanced"),
      `Found slugs: ${slugs.join(", ")}`
    );
  } catch (err: any) {
    assert("Standard Exams Initialization", false, err.message);
  }

  // TEST 2: Slug Generator Determinism & Format
  try {
    const slug = buildQuestionSlug({
      id: "cm123456789",
      questionCode: "QPHY-2024-001",
      examName: "NEET UG",
      examCanonicalType: "NEET_UG",
      year: 2024,
      subject: "Physics",
      chapter: "[Class 11] Ch 2: Kinematics",
      originalNumber: 15,
    });
    assert(
      "Slug Generator SEO Formatting",
      slug === "neet-2024-physics-kinematics-q15-qphy-2024-001",
      `Generated: ${slug}`
    );

    const chSlug = buildChapterSlug("[Class 11] Ch 2: Units and Measurements");
    assert("Chapter Slug Sanitization", chSlug === "units-and-measurements", `Generated: ${chSlug}`);

    const exSlug = buildExamSlug("NEET_UG");
    assert("Exam Slug Normalization", exSlug === "neet", `Generated: ${exSlug}`);
  } catch (err: any) {
    assert("Slug Generator", false, err.message);
  }

  // TEST 3: Duplicate Fingerprinting Accuracy
  try {
    const fp1 = questionFingerprint("A particle moves in a circle of radius R with constant speed v.", {
      A: "v^2/R",
      B: "v/R",
      C: "v*R",
      D: "Zero",
    });
    const fp2 = questionFingerprint(" a  particle  moves  in a circle of radius R with constant speed v. ", {
      A: "v^2/R ",
      B: " v/R",
      C: "v*R",
      D: "Zero",
    });
    assert(
      "Normalized Content Fingerprint Matching",
      fp1 === fp2,
      `Hashes match identically: ${fp1.slice(0, 12)}...`
    );
  } catch (err: any) {
    assert("Duplicate Fingerprinting", false, err.message);
  }

  // TEST 4: Slug Backfill for Existing Questions
  try {
    const updated = await backfillQuestionSlugs(20);
    assert(
      "Slug Backfilling for Existing Questions",
      typeof updated === "number",
      `Backfilled ${updated} question(s)`
    );
  } catch (err: any) {
    assert("Slug Backfilling", false, err.message);
  }

  // TEST 5: Canonical Question Database Preservation
  try {
    const totalQuestions = await prisma.question.count();
    const totalOccurrences = await prisma.pyqOccurrence.count();
    assert(
      "Canonical Question Database Preserved",
      totalQuestions > 0,
      `Total questions in system: ${totalQuestions}, Verified PYQ occurrences: ${totalOccurrences}`
    );
  } catch (err: any) {
    assert("Database Integrity Check", false, err.message);
  }

  console.log("\n================================================================================");
  console.log(`TEST RUN COMPLETED: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================================");

  if (failed > 0) process.exit(1);
}

runTests().catch(console.error);
