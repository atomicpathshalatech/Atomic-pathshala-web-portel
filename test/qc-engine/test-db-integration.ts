/**
 * ATOMIC PATHSHALA — DATABASE & SOURCE LIBRARY INTEGRATION TEST
 * Verifies persistent PostgreSQL storage for SourceMaterial, Chunks, and QuestionReviewAudit.
 */

import { prisma } from "../../src/lib/prisma";
import {
  createSourceMaterial,
  addChunksToSourceMaterial,
  querySourceMaterials,
  retrieveSourceContext,
} from "../../src/lib/source-library/service";
import { runMultiModelAudit } from "../../src/lib/ai-provider/multi-model-hub";
import { QuestionSnapshot } from "../../src/lib/ai-provider/types";

async function runDatabaseIntegrationTests() {
  console.log("=== RUNNING DATABASE & SOURCE LIBRARY INTEGRATION TESTS ===");
  const testId = `test_${Date.now()}`;

  try {
    // 1. Create a persistent source material
    console.log("[1] Creating test Source Material in PostgreSQL...");
    const material = await createSourceMaterial({
      title: `NCERT Chemistry Test Chapter (${testId})`,
      category: "NCERT_TEXTBOOK",
      subject: "CHEMISTRY",
      classLevel: "CLASS_12",
      bookName: "NCERT Chemistry Part 1",
      chapterNumber: 3,
      chapterName: "Electrochemistry",
      topicName: "Nernst Equation",
      fileUrl: "https://pub-r2.atomicpathshala.com/test-ch3.pdf",
      fileType: "PDF",
      pageCount: 30,
      extractedText: "The Nernst equation relates the reduction potential of an electrochemical reaction to the standard electrode potential.",
    });

    console.log(`  ✓ SourceMaterial created with ID: ${material.id}`);

    // 2. Add chunks with page number and bounding box coordinates
    console.log("[2] Ingesting source chunks...");
    const chunks = await addChunksToSourceMaterial([
      {
        sourceMaterialId: material.id,
        pageNumber: 68,
        chunkIndex: 0,
        topic: "Nernst Equation",
        content: "Nernst showed that for the electrode reaction $M^{n+}(aq) + ne^- \\rightarrow M(s)$, the electrode potential at any concentration measured with respect to standard hydrogen electrode can be represented by $E = E^\\circ - \\frac{RT}{nF} \\ln \\frac{1}{[M^{n+}]}$.",
        bbox: { x1: 50, y1: 120, x2: 550, y2: 300 },
      },
    ]);
    console.log(`  ✓ Added ${chunks.count} chunks to SourceMaterial`);

    // 3. Query source materials library
    console.log("[3] Querying Source Material Library...");
    const queryRes = await querySourceMaterials({
      subject: "CHEMISTRY",
      chapterName: "Electrochemistry",
    });
    const found = queryRes.items.some((i) => i.id === material.id);
    if (!found) throw new Error("Created source material not found in query results");
    console.log(`  ✓ Found source material in library query (total count: ${queryRes.total})`);

    // 4. Retrieve Grounding Evidence
    console.log("[4] Retrieving grounded source context...");
    const context = await retrieveSourceContext({
      subject: "CHEMISTRY",
      chapter: "Electrochemistry",
      topic: "Nernst Equation",
      sourceMaterialId: material.id,
    });
    if (!context.includes("Nernst showed that")) {
      throw new Error(`Retrieved context missing expected text: ${context}`);
    }
    console.log("  ✓ Retrieved source context successfully");

    // 5. Test Question Review Audit Persistence
    console.log("[5] Running multi-model audit and persisting to database...");
    process.env.SIMULATE_MISSING_AI_PROVIDERS = "true";

    const snapshot: QuestionSnapshot = {
      statement: "In the Nernst equation for $M^{n+} + ne^- \\rightarrow M$, what happens to cell potential $E$ when $[M^{n+}]$ increases?",
      options: {
        A: "$E$ increases",
        B: "$E$ decreases",
        C: "$E$ remains unchanged",
        D: "$E$ becomes zero",
      },
      storedAnswer: ["A"],
      solution: "According to the Nernst equation, as $[M^{n+}]$ increases, the ratio decreases so $E$ increases.",
      subject: "CHEMISTRY",
      chapter: "Electrochemistry",
      topic: "Nernst Equation",
    };

    const auditResult = await runMultiModelAudit(snapshot, context, {
      persist: true,
      sourceMaterialId: material.id,
    });

    if (!auditResult.auditId) {
      throw new Error("Audit ID was not returned; persistence failed");
    }

    const fetchedAudit = await prisma.questionReviewAudit.findUnique({
      where: { id: auditResult.auditId },
    });

    if (!fetchedAudit) {
      throw new Error("Persisted QuestionReviewAudit record not found in database");
    }

    console.log(`  ✓ QuestionReviewAudit persisted successfully (ID: ${fetchedAudit.id}, Status: ${fetchedAudit.finalStatus})`);

    // Clean up test data
    console.log("[6] Cleaning up test records...");
    await prisma.questionReviewAudit.delete({ where: { id: auditResult.auditId } });
    await prisma.sourceMaterialChunk.deleteMany({ where: { sourceMaterialId: material.id } });
    await prisma.sourceMaterial.delete({ where: { id: material.id } });
    console.log("  ✓ Cleaned up test records");

    console.log("\n=== DATABASE INTEGRATION TESTS PASSED 100% ===\n");
  } catch (err: any) {
    console.error("Integration Test Failure:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runDatabaseIntegrationTests();
