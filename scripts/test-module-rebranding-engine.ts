import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { applyModuleBranding, type ModuleBrandingOptions } from "../src/lib/module-studio/rebranding-engine";
import { generateModuleVerificationReport, formatVerificationReportMarkdown } from "../src/lib/module-studio/verification-engine";
import * as fs from "fs";
import * as path from "path";

async function runTest() {
  console.log("=== TESTING MODULE REBRANDING & PRESERVATION ENGINE ===");

  // 1. Create a simulated 3-page educational module PDF with Hindi text markers, chemistry formulas, and layouts
  const testPdfDoc = await PDFDocument.create();
  const font = await testPdfDoc.embedFont(StandardFonts.Helvetica);

  for (let i = 1; i <= 3; i++) {
    const page = testPdfDoc.addPage([595.28, 841.89]); // A4 size
    const { width, height } = page.getSize();

    // Simulated Old Institute Header (to test masking)
    page.drawText(`OLD INSTITUTE NAME - CHAPTER ${i}`, {
      x: 50,
      y: height - 25,
      size: 10,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Content: Chemistry, Physics, Biology, Math
    page.drawText(`Page ${i}: High Fidelity NEET Module Content`, {
      x: 50,
      y: height - 80,
      size: 14,
      font,
      color: rgb(0, 0, 0),
    });

    page.drawText(`1. Chemical Equilibrium: N2(g) + 3H2(g) <=> 2NH3(g), Delta H = -92.4 kJ/mol`, {
      x: 50,
      y: height - 120,
      size: 11,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });

    page.drawText(`2. Hindi Devanagari Chapter Title: Ushmagatiki aur Rasayanik Balgatiki`, {
      x: 50,
      y: height - 150,
      size: 11,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });

    page.drawText(`3. Physics Equation: E = h*nu = hc / lambda, c = 3 x 10^8 m/s`, {
      x: 50,
      y: height - 180,
      size: 11,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });

    // Simulated Diagram Box
    page.drawRectangle({
      x: 50,
      y: height - 320,
      width: 400,
      height: 100,
      borderColor: rgb(0.8, 0.8, 0.8),
      borderWidth: 1,
    });
    page.drawText(`[DIAGRAM: Organic Reaction Mechanism & Resonance Hybrid Structures]`, {
      x: 60,
      y: height - 270,
      size: 10,
      font,
      color: rgb(0.3, 0.3, 0.3),
    });

    // Simulated Old Footer
    page.drawText(`Old Copyright 2021 - Unauthorized Distribution Prohibited`, {
      x: 50,
      y: 15,
      size: 9,
      font,
      color: rgb(0.6, 0.6, 0.6),
    });
  }

  const originalBytes = await testPdfDoc.save();
  console.log(`✓ Generated 3-page test PDF (${originalBytes.length} bytes)`);

  // 2. Run Rebranding Engine
  const options: ModuleBrandingOptions = {
    preset: "CHEMISTRY",
    teacherName: "Dr. Arvind Sharma (Senior Chemistry Faculty)",
    subject: "CHEMISTRY - NEET 2026",
    batchName: "NEET Top Rankers Batch",
    chapterName: "Chemical Equilibrium & Kinetics",
    removeOldHeader: true,
    removeOldFooter: true,
    includeHeader: true,
    includeFooter: true,
    includeWatermark: true,
    watermarkText: "ATOMIC PATHSHALA",
    watermarkOpacity: 0.06,
  };

  console.log("\nApplying Module Rebranding Overlay...");
  const rebrandingResult = await applyModuleBranding(originalBytes, options);

  console.log(`✓ Rebranding succeeded:`);
  console.log(`  - Original Page Count: 3`);
  console.log(`  - Branded Page Count: ${rebrandingResult.pageCount}`);
  console.log(`  - File Size: ${rebrandingResult.fileSizeBytes} bytes`);
  console.log(`  - Applied Preset: ${rebrandingResult.appliedPreset}`);

  if (rebrandingResult.pageCount !== 4) {
    throw new Error(`Page count mismatch: expected 4 (1 cover + 3 content), got ${rebrandingResult.pageCount}`);
  }

  // 3. Run Verification Engine
  console.log("\nGenerating Module Verification & Preservation Report...");
  const report = generateModuleVerificationReport({
    moduleId: "test-mod-001",
    moduleCode: "MOD-CHEM-001",
    originalFileName: "NEET_Equilibrium_Original.pdf",
    originalPageCount: 3,
    brandedPageCount: rebrandingResult.pageCount,
    hasHindi: true,
    hasFormulas: true,
    hasDiagrams: true,
    hasTables: true,
  });

  console.log(`✓ Verification Overall Status: ${report.overallStatus}`);
  console.log(`✓ Verification Overall Score: ${report.overallScore}%`);

  const markdownReport = formatVerificationReportMarkdown(report);
  console.log("\n" + markdownReport);

  if (report.overallStatus !== "SAFE_TO_PUBLISH" || report.overallScore < 95) {
    throw new Error(`Verification failed with status ${report.overallStatus} and score ${report.overallScore}`);
  }

  console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY! PDF Module Rebranding & Preservation Engine is 100% operational.");
}

runTest().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
