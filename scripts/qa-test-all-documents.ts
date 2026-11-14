import fs from "fs";
import path from "path";
import QRCode from "qrcode";
import { buildJoiningConfirmationPdf } from "../src/lib/documents/joining-confirmation-template";
import { buildExperienceCertificatePdf } from "../src/lib/documents/experience-certificate-template";
import { buildRelievingLetterPdf } from "../src/lib/documents/relieving-letter-template";
import { buildContractLetterPdf } from "../src/lib/documents/contract-letter-template";

async function runQaTest() {
  console.log("=== STARTING QA AUDIT FOR ALL 4 DOCUMENT CATEGORIES ===");

  const outputDir = path.join(process.cwd(), "qa-test-documents");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const dummyQr = await QRCode.toDataURL("https://atomicpathshala.in/verify/cert/AP-TEST-2026-0001");

  // 1. Category 1: Official Joining Confirmation
  console.log("\n[TEST 1] Testing Category 1: Official Joining Confirmation...");
  const joiningPdf = await buildJoiningConfirmationPdf({
    documentRef: "AP-JLC-2026-0001",
    issueDateStr: "14 November 2026",
    employeeName: "Abhishek Saxena",
    employeeId: "AP-EMP-2026-0001",
    designation: "Senior Physics Faculty",
    department: "Physics",
    employmentType: "FULL_TIME",
    joiningDateStr: "01 July 2024",
    reportingAuthority: "Founder & Director",
    assignedSubject: "Physics (Class 11 & 12 Competitive)",
    assignedBatch: "Rankers NEET & JEE Advanced 2026",
    workLocation: "Rampur, Uttar Pradesh, India / Digital Streaming Studio",
    reportingInstructions: "Please report to the Academic Directorate for timetable synchronization and live studio briefing.",
    workingSchedule: "Monday to Saturday, Scheduled Live Streaming Sessions",
    compensationReference: "As per executed Service Agreement / Official Offer Terms",
    qrCodeDataUrl: dummyQr,
    verificationUrl: "https://atomicpathshala.in/verify/cert/AP-JLC-2026-0001",
  });
  const joiningPath = path.join(outputDir, "01_Joining_Confirmation.pdf");
  fs.writeFileSync(joiningPath, joiningPdf);
  console.log(`✓ Joining Confirmation generated: ${joiningPath} (${joiningPdf.length} bytes)`);

  // 2. Category 2: Experience Certificate
  console.log("\n[TEST 2] Testing Category 2: Experience Certificate...");
  const expPdf = await buildExperienceCertificatePdf({
    certificateNumber: "AP-EXP-2026-0001",
    issueDateStr: "14 November 2026",
    employeeName: "Abhishek Saxena",
    employeeId: "AP-EMP-2026-0001",
    designation: "Senior Physics Faculty",
    department: "Physics",
    startDateStr: "01 July 2024",
    endDateStr: "14 November 2026",
    conductRemarks: "Exemplary conduct, pedagogical leadership, and dedication to NEET/JEE academic benchmarks.",
    qrCodeDataUrl: dummyQr,
    verificationUrl: "https://atomicpathshala.in/verify/cert/AP-EXP-2026-0001",
  });
  const expPath = path.join(outputDir, "02_Experience_Certificate.pdf");
  fs.writeFileSync(expPath, expPdf);
  console.log(`✓ Experience Certificate generated: ${expPath} (${expPdf.length} bytes)`);

  // 3. Category 3: Relieving Letter
  console.log("\n[TEST 3] Testing Category 3: Relieving Letter...");
  const relPdf = await buildRelievingLetterPdf({
    documentRef: "AP-REL-2026-0001",
    issueDateStr: "14 November 2026",
    employeeName: "Abhishek Saxena",
    employeeId: "AP-EMP-2026-0001",
    designation: "Senior Physics Faculty",
    department: "Physics",
    joiningDateStr: "01 July 2024",
    lastWorkingDateStr: "14 November 2026",
    relievingEffectiveDateStr: "14 November 2026",
    resignationReference: "Resignation communication dated 10 October 2026",
    handoverClearanceStatus: "Completed & Verified",
    assetsReturnStatus: "Returned & Deactivated",
    finalSettlementStatus: "Settled & Disbursed",
    conductRemarks: "Professional conduct and academic delivery were exemplary throughout service.",
    qrCodeDataUrl: dummyQr,
    verificationUrl: "https://atomicpathshala.in/verify/cert/AP-REL-2026-0001",
  });
  const relPath = path.join(outputDir, "03_Relieving_Letter.pdf");
  fs.writeFileSync(relPath, relPdf);
  console.log(`✓ Relieving Letter generated: ${relPath} (${relPdf.length} bytes)`);

  // 4. Category 4: Contract Letter (Complete Multi-Page Service Agreement)
  console.log("\n[TEST 4] Testing Category 4: Contract Letter (Complete Multi-Page Service Agreement)...");
  const contractPdf = await buildContractLetterPdf({
    agreementReference: "AP-CON-2026-0001",
    executionDateStr: "14 November 2026",
    effectiveDateStr: "14 November 2026",
    contractEndDateStr: "13 November 2027",
    employeeName: "Abhishek Saxena",
    employeeId: "AP-EMP-2026-0001",
    address: "Rampur, Uttar Pradesh, India",
    designation: "Senior Physics Faculty",
    department: "Physics",
    subject: "Physics",
    engagementType: "FULL_TIME",
    assignedBatch: "Comprehensive NEET / JEE Academic Batches",
    workLocation: "Rampur, Uttar Pradesh, India / Digital Streaming Studio",
    reportingAuthority: "Founder & Director",
    workingSchedule: "Monday to Saturday, Scheduled Live Streaming Sessions",
    academicSession: "2025-2026 Academic Session",
    monthlySalary: "45,000",
    annualSalary: "5,40,000",
    teachingHoursMonthly: "70 to 80 Hours",
    paymentCycleDay: "7th of each month",
    noticePeriodDays: "60 Days",
    specialConditions: "Standard institutional academic benchmarks apply. No special waivers granted.",
    qrCodeDataUrl: dummyQr,
    verificationUrl: "https://atomicpathshala.in/verify/cert/AP-CON-2026-0001",
  });
  const contractPath = path.join(outputDir, "04_Contract_Letter.pdf");
  fs.writeFileSync(contractPath, contractPdf);
  console.log(`✓ Contract Letter generated: ${contractPath} (${contractPdf.length} bytes)`);

  console.log("\n=== QA AUDIT COMPLETED SUCCESSFULLY: ALL 4 CATEGORIES GENERATED CLEANLY ===");

  // Verify page counts
  const { PDFDocument } = await import("pdf-lib");
  for (const name of ["01_Joining_Confirmation.pdf", "02_Experience_Certificate.pdf", "03_Relieving_Letter.pdf", "04_Contract_Letter.pdf"]) {
    const bytes = fs.readFileSync(path.join(outputDir, name));
    const doc = await PDFDocument.load(bytes);
    console.log(`[VERIFIED] ${name} -> ${doc.getPageCount()} Page(s)`);
  }
}

runQaTest().catch((e) => {
  console.error("QA Test Error:", e);
  process.exit(1);
});
