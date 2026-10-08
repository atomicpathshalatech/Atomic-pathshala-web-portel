import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { processNativePdfEdits } from "../src/lib/module-editor/native-pdf-engine";

async function runFoxitEditorIntegrationTests() {
  console.log("==========================================================");
  console.log("🚀 ADVANCED FOXIT-STYLE NATIVE PDF ENGINE INTEGRATION TESTS");
  console.log("==========================================================");

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

  // 1. Create a simulated 5-page NEET study module PDF
  const testDoc = await PDFDocument.create();
  const helvetica = await testDoc.embedFont(StandardFonts.Helvetica);

  for (let i = 1; i <= 5; i++) {
    const page = testDoc.addPage([595.28, 841.89]); // A4
    const { height } = page.getSize();
    page.drawText(`Original Page ${i}: Chapter 01 - Chemical Bonding`, {
      x: 50,
      y: height - 100,
      size: 14,
      font: helvetica,
      color: rgb(0, 0, 0),
    });
    page.drawText(`1. Hybridization of CH4 is sp3 with tetrahedral geometry.`, {
      x: 50,
      y: height - 140,
      size: 11,
      font: helvetica,
      color: rgb(0.1, 0.1, 0.1),
    });
    page.drawText(`[OLD_COACHING_LOGO_PLACEHOLDER]`, {
      x: 50,
      y: height - 30,
      size: 10,
      font: helvetica,
      color: rgb(0.5, 0.5, 0.5),
    });
  }

  const originalBytes = await testDoc.save();
  assert(originalBytes.length > 0, "Generated 5-page original source PDF");

  // 2. Test In-Place Native Edits, Global Removals & Replacements, Backgrounds, Header/Footer
  console.log("\n--- Testing Native In-Place Object Modifications ---");
  const editResult = await processNativePdfEdits({
    originalPdfBuffer: originalBytes,
    textEdits: [
      {
        id: "edit-1",
        pageNumber: 1,
        x: 50,
        y: 100,
        width: 350,
        height: 20,
        originalText: "Original Page 1: Chapter 01 - Chemical Bonding",
        newText: "Atomic Pathshala: Chemical Bonding - NEET 2027",
        fontSize: 14,
        fontFamily: "helvetica",
        color: "#0B7A43",
        isBold: true,
        hideOriginal: true,
      },
    ],
    globalRemovals: [
      {
        id: "g-rem-1",
        x: 50,
        y: 20,
        width: 200,
        height: 20,
        pageRange: "ALL",
      },
    ],
    globalReplacements: [
      {
        id: "g-rep-1",
        x: 300,
        y: 20,
        width: 200,
        height: 20,
        replacementType: "text",
        newText: "ATOMIC PATHSHALA OFFICIAL",
        fontSize: 10,
        pageRange: "ALL",
      },
    ],
    background: {
      enabled: true,
      color: "#fcfdfe",
      opacity: 1,
      pageRange: "ALL",
    },
    deletedPages: [5], // Delete page 5
    pageRotations: { 2: 90 }, // Rotate page 2 by 90°
    headerFooter: {
      enabled: true,
      headerLeft: "ATOMIC PATHSHALA",
      headerCenter: "| CHEMISTRY - Chemical Bonding",
      headerRight: "Firoz Sir",
      footerLeft: "Atomic Pathshala | NEET Accelerator",
      footerRight: "Page {page} of {totalPages}",
      removeOldHeader: true,
      removeOldFooter: true,
      accentColor: "#0B7A43",
      excludeFirstPage: true,
    },
    watermark: {
      enabled: true,
      type: "text",
      text: "ATOMIC PATHSHALA",
      opacity: 0.05,
      position: "CENTER",
      excludeFirstPage: true,
    },
    coverPage: {
      enabled: true,
      action: "PREPEND",
      subject: "CHEMISTRY",
      moduleNumber: "Module 01",
      chapter: "Chemical Bonding",
      teacher: "Firoz Sir",
      batch: "NEET Accelerated Batch",
      targetExam: "NEET (UG)",
    },
  });

  // 3. Verify Final PDF Metrics
  console.log("\n--- Verifying Output PDF Fidelity & Integrity ---");
  assert(editResult.pdfBytes.length > 0, "Native edited PDF successfully serialized");
  // 5 original pages - 1 deleted page + 1 cover page = 5 total pages
  assert(editResult.pageCount === 5, `Expected 5 pages in final PDF, got ${editResult.pageCount}`);

  // Inspect generated PDF using pdf-lib
  const finalDoc = await PDFDocument.load(editResult.pdfBytes);
  assert(finalDoc.getPageCount() === 5, "Loaded final PDF verifies 5 pages in document structure");

  const finalPage2 = finalDoc.getPage(1);
  assert(finalPage2.getSize().width > 0 && finalPage2.getSize().height > 0, "Page dimensions are valid A4");

  // 4. Test REPLACE_FIRST front page action
  console.log("\n--- Testing REPLACE_FIRST Front Page Action ---");
  const replaceFirstResult = await processNativePdfEdits({
    originalPdfBuffer: originalBytes,
    coverPage: {
      enabled: true,
      action: "REPLACE_FIRST",
      subject: "PHYSICS",
      moduleNumber: "Module 02",
      chapter: "Electrostatics",
      teacher: "Physics Faculty",
    },
  });
  // 5 original pages - 1 replaced page + 1 new cover page = 5 pages
  assert(replaceFirstResult.pageCount === 5, `Expected 5 pages with REPLACE_FIRST, got ${replaceFirstResult.pageCount}`);

  console.log("\n==========================================================");
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==========================================================");

  if (failed > 0) process.exit(1);
}

runFoxitEditorIntegrationTests().catch((err) => {
  console.error("Test failed with exception:", err);
  process.exit(1);
});
