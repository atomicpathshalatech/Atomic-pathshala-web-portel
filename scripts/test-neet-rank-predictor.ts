import { predictNEETRank } from "../src/lib/predictor/neet-rank-service";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function runTests() {
  console.log("=== Running NEET 2026 Rank Prediction & Mapping Unit Tests ===\n");

  // Test 1: Exact Marks Lookup (535 marks -> Rank 50,000 from Page 14)
  console.log("Test 1: Exact Reference Mark (535 Marks)");
  const res1 = await predictNEETRank({ marks: 535, maxMarks: 720 });
  console.log(`  - Estimated AIR: ${res1.estimatedAIR} (Expected: 50,000)`);
  console.log(`  - Confidence: ${res1.confidence}`);
  console.log(`  - Exact Reference: ${res1.isExactReference}`);
  console.log(`  - Source Page: ${res1.sourcePage}`);
  console.assert(res1.estimatedAIR === 50000, "Test 1 Failed: AIR should be 50,000");
  console.assert(res1.isExactReference === true, "Test 1 Failed: Should be exact reference");
  console.log("  ✓ Test 1 Passed!\n");

  // Test 2: Interpolated Marks (500 Marks, between 493 and 535)
  console.log("Test 2: Interpolated Marks (500 Marks, between 493 & 535)");
  const res2 = await predictNEETRank({ marks: 500, maxMarks: 720 });
  console.log(`  - Estimated AIR: ${res2.estimatedAIR}`);
  console.log(`  - Estimated Range: ${res2.minAIR} - ${res2.maxAIR}`);
  console.log(`  - Confidence: ${res2.confidence}`);
  console.assert(res2.estimatedAIR > 50000 && res2.estimatedAIR < 100000, "Test 2 Failed: AIR should be between 50,000 and 100,000");
  console.log("  ✓ Test 2 Passed!\n");

  // Test 3: Score Normalization (40 Marks Test with 40/40)
  console.log("Test 3: Score Normalization (Atomic Demo Test 40/40 Marks)");
  const res3 = await predictNEETRank({ marks: 40, maxMarks: 40 });
  console.log(`  - NEET Equivalent: ${res3.neetEquivalentScore} / 720`);
  console.log(`  - Estimated AIR: ${res3.estimatedAIR} (Expected: 1)`);
  console.log(`  - Confidence: ${res3.confidence}`);
  console.assert(res3.neetEquivalentScore === 720, "Test 3 Failed: Should scale to 720");
  console.assert(res3.estimatedAIR === 1, "Test 3 Failed: 720 marks should map to Rank 1");
  console.log("  ✓ Test 3 Passed!\n");

  // Test 4: Category Rank Handling (OBC-NCL with 715 marks -> Category Rank #1 on Page 9)
  console.log("Test 4: Category Topper Reference (OBC-NCL with 715 Marks)");
  const res4 = await predictNEETRank({ marks: 715, maxMarks: 720, category: "OBC-NCL" });
  console.log(`  - Estimated AIR: ${res4.estimatedAIR}`);
  console.log(`  - Category Status: ${res4.categoryPrediction?.statusText}`);
  console.log(`  - Category Rank: ${res4.categoryPrediction?.estimatedCategoryRank}`);
  console.assert(res4.categoryPrediction?.estimatedCategoryRank === 1, "Test 4 Failed: Category rank should be 1");
  console.log("  ✓ Test 4 Passed!\n");

  // Test 5: Category with Limited Distribution (OBC-NCL with 500 marks)
  console.log("Test 5: Category with Honest Limited Data Notice (OBC-NCL with 500 Marks)");
  const res5 = await predictNEETRank({ marks: 500, maxMarks: 720, category: "OBC-NCL" });
  console.log(`  - Status Text: ${res5.categoryPrediction?.statusText}`);
  console.assert(res5.categoryPrediction?.statusText.includes("cannot be determined exactly"), "Test 5 Failed: Should give honest disclaimer");
  console.log("  ✓ Test 5 Passed!\n");

  console.log("=== All 5 NEET Rank Prediction Unit Tests Passed Successfully! ===");
}

runTests()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
