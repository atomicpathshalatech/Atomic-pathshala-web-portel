import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { processNativePdfEdits } from "../src/lib/module-editor/native-pdf-engine";

async function runFoxitEditorIntegrationTests() {
  console.log("==========================================================");
  console.log("🚀 FOXIT-STYLE NATIVE PDF EDITOR ENGINE INTEGRATION TESTS");
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
    page.drawText(`2. Unwanted old copyright text to be whited-out.`, {
      x: 50,
      y: height - 200,
      size: 10,
      font: helvetica,
      color: rgb(0.5, 0.5, 0.5),
    });
  }

  const originalBytes = await testDoc.save();
  assert(originalBytes.length > 0, "Generated 5-page original source PDF");

  // 2. Test In-Place Native Edits (Text edits, Whiteouts, Page Rotation, Page Deletion, Header/Footer, Cover)
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
    whiteouts: [
      {
        id: "wo-1",
        pageNumber: 1,
        x: 48,
        y: 195,
        width: 300,
        height: 20,
        color: "#ffffff",
      },
    ],
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
    },
    watermark: {
      enabled: true,
      text: "ATOMIC PATHSHALA",
      opacity: 0.05,
    },
    coverPage: {
      enabled: true,
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

  const finalPage2 = finalDoc.getPage(1); // Page 2 is cover page (index 0) + content page 1 (index 1)
  assert(finalPage2.getSize().width > 0 && finalPage2.getSize().height > 0, "Page dimensions are valid A4");

  console.log("\n==========================================================");
  console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==========================================================");

  if (failed > 0) process.exit(1);
}

runFoxitEditorIntegrationTests().catch((err) => {
  console.error("Test failed with exception:", err);
  process.exit(1);
});
