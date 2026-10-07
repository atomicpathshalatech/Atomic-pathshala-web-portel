import { buildChunkPlan } from "../src/lib/extraction/chunk-pipeline";
import { cleanDocumentArtifacts } from "../src/lib/extraction/pdf-extractor";
import { validateAndClassifyQuestions } from "../src/lib/extraction/validator";

function runExtractionEngineTests() {
  console.log("=================================================");
  console.log("🧪 ATOMIC PATHSHALA — PDF EXTRACTION ENGINE TESTS");
  console.log("=================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, name: string) {
    if (condition) {
      console.log(`✅ PASS: ${name}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${name}`);
      failed++;
    }
  }

  // --- Test 1: Chunk Planning on 200-Page Document ---
  console.log("\n--- 1. Large Document Chunk Planner (200 Pages) ---");
  const mockPages = Array.from({ length: 200 }, (_, i) => ({
    pageNumber: i + 1,
    text: `Page ${i + 1} Question ${i * 5 + 1} Which of the following is correct? (1) Option A (2) Option B (3) Option C (4) Option D`,
  }));

  const chunkPlan = buildChunkPlan(mockPages);
  assert(chunkPlan.totalPages === 200, "Calculates exact 200 total pages");
  assert(chunkPlan.totalChunks >= 20, "Divides 200 pages into controlled manageable chunks");
  assert(chunkPlan.chunks[0].firstPage === 1, "First chunk starts at page 1");
  assert(
    chunkPlan.chunks[chunkPlan.chunks.length - 1].lastPage === 200,
    "Final chunk ends exactly at page 200 with zero skipped pages"
  );

  // --- Test 2: Document Artifact Cleaning & Scientific Notation ---
  console.log("\n--- 2. Document Artifact Cleaning & Scientific Preservation ---");
  const dirtyText = `
  ALLEN CAREER INSTITUTE
  NEET (UG) - 2024
  Question 42: The standard enthalpy change \\Delta H^\\circ for H_2O \\rightarrow H^+ + OH^- is 10^{-3} J/mol.
  (A) 1.5 \\times 10^5 (B) 2.5 \\times 10^{-3} (C) 3.5 \\times 10^2 (D) 4.5
  Page 12 of 48
  Rough Work
  `;
  const cleaned = cleanDocumentArtifacts(dirtyText);
  assert(!cleaned.includes("ALLEN CAREER INSTITUTE"), "Strips recurring exam headers");
  assert(!cleaned.includes("Page 12 of 48"), "Strips page number artifacts");
  assert(!cleaned.includes("Rough Work"), "Strips rough work sections");
  assert(cleaned.includes("\\Delta H^\\circ"), "Preserves LaTeX scientific equations");
  assert(cleaned.includes("10^{-3}"), "Preserves scientific superscripts and subscripts");

  // --- Test 3: Zero Silent Loss & Count Reconciliation ---
  console.log("\n--- 3. Validation & Zero-Silent-Loss Reconciliation ---");
  const mockRawBlocks = [
    {
      originalNumber: 1,
      sourcePage: 1,
      statement: "What is the unit of magnetic flux density?",
      options: { A: "Tesla", B: "Weber", C: "Henry", D: "Farad" },
      correctAnswer: "A" as const,
      hasImage: false,
      hasTable: false,
      hasEquation: false,
    },
    {
      originalNumber: 2,
      sourcePage: 1,
      statement: "An unformatted question with missing options",
      options: { A: "Only option", B: "", C: "", D: "" },
      correctAnswer: "A" as const,
      hasImage: false,
      hasTable: false,
      hasEquation: false,
    },
    // Question 3 is intentionally missing to test missing question detection
    {
      originalNumber: 4,
      sourcePage: 2,
      statement: "Assertion: Mitochondria is powerhouse. Reason: Generates ATP.",
      options: { A: "Both true & correct explanation", B: "Both true not explanation", C: "A true R false", D: "Both false" },
      correctAnswer: "A" as const,
      hasImage: false,
      hasTable: false,
      hasEquation: false,
    },
  ];

  const validationResult = validateAndClassifyQuestions(
    mockRawBlocks as any,
    new Map(),
    new Map(),
    {
      sourceName: "NEET",
      fileName: "NEET_2024.pdf",
      fileUrl: "https://r2.dev/neet.pdf",
      startNumber: 1,
      endNumber: 4,
    }
  );

  assert(validationResult.report.expectedCount === 4, "Expected count is 4");
  assert(validationResult.report.extractedCount === 3, "Extracted count is 3");
  assert(validationResult.report.missingCount === 1, "Accurately detects missing Q3");
  assert(validationResult.report.status === "REVIEW_REQUIRED", "Status is flagged as REVIEW_REQUIRED (Never false success)");
  assert(validationResult.validatedQuestions[0].status === "VERIFIED", "Q1 passes validation as VERIFIED");
  assert(validationResult.validatedQuestions[1].status === "REVIEW_REQUIRED", "Q2 with incomplete options flagged for review");

  console.log("\n=================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("=================================================");

  if (failed > 0) process.exit(1);
}

runExtractionEngineTests();
