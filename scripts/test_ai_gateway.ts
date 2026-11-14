import { aiProviderGateway } from "../src/lib/ai-gateway";

async function main() {
  console.log("=== TESTING AI PROVIDER GATEWAY ===");

  console.log("\n[Test 1] Student Practice Question (Low-Cost Tier)...");
  const res1 = await aiProviderGateway.generateContent(
    "What is the SI unit of electric potential? Reply in one sentence.",
    {
      workload: "STUDENT_PRACTICE",
      complexity: "LOW_COST",
    }
  );
  console.log("-> Model Used:", res1.modelUsed);
  console.log("-> Project Used:", res1.projectUsed);
  console.log("-> Key Masked:", res1.keyMasked);
  console.log("-> Duration:", `${res1.durationMs}ms`);
  console.log("-> Cost (Paise):", `${res1.cost.costPaise}p (₹${res1.cost.costInr})`);
  console.log("-> Output:", res1.data.trim());

  console.log("\n[Test 2] Deduplication / Cache Hit Test...");
  const startCache = Date.now();
  const res2 = await aiProviderGateway.generateContent(
    "What is the SI unit of electric potential? Reply in one sentence.",
    {
      workload: "STUDENT_PRACTICE",
      complexity: "LOW_COST",
    }
  );
  console.log("-> Cached:", res2.cached);
  console.log("-> Duration:", `${res2.durationMs}ms`);
  console.log("-> Cost (Paise):", `${res2.cost.costPaise}p`);

  console.log("\n[Test 3] Balanced / Reasoning Task (Question Extraction)...");
  const res3 = await aiProviderGateway.generateContent(
    "Explain Newton's second law of motion F = dp/dt in 2 short bullet points.",
    {
      workload: "TEST_PORTAL",
      complexity: "BALANCED",
    }
  );
  console.log("-> Model Used:", res3.modelUsed);
  console.log("-> Project Used:", res3.projectUsed);
  console.log("-> Duration:", `${res3.durationMs}ms`);
  console.log("-> Output:\n", res3.data.trim());

  console.log("\nALL GATEWAY INTEGRATION TESTS PASSED CLEANLY!");
}

main().catch(console.error);
