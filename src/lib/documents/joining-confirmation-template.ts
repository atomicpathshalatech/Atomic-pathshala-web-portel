/**
 * ATOMIC PATHSHALA — OFFICIAL JOINING CONFIRMATION
 * Category 1: Comprehensive Institutional Joining Confirmation Letter
 */

import { PDFDocument } from "pdf-lib";
import {
  UniversalFonts,
  embedUniversalFonts,
  loadBrandLogo,
  drawDocumentBorder,
  drawBrandWatermark,
  drawDocumentHeader,
  drawDocumentTitle,
  drawDocumentFooter,
  drawUnifiedVerificationAndSignatory,
  cleanWinAnsi,
  BRAND_COLORS,
} from "./universal-design-system";

export interface JoiningConfirmationVariables {
  documentRef: string; // AP-JLC-YYYY-XXXX
  issueDateStr: string;
  employeeName: string;
  employeeId: string;
  designation: string;
  department: string;
  employmentType: string;
  joiningDateStr: string;
  reportingAuthority?: string;
  assignedSubject?: string;
  assignedBatch?: string;
  workLocation?: string;
  reportingInstructions?: string;
  workingSchedule?: string;
  compensationReference?: string;
  requiredDocuments?: string[];
  qrCodeDataUrl?: string;
  verificationUrl?: string;
}

export async function buildJoiningConfirmationPdf(
  vars: JoiningConfirmationVariables
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const fonts = await embedUniversalFonts(pdfDoc);
  const logoImg = await loadBrandLogo(pdfDoc);

  // 1. Thin Blue Border
  drawDocumentBorder(page);

  // 2. Transparent Central Watermark
  drawBrandWatermark(page, logoImg);

  // 3. Document Header (NO Rampur, Uttar Pradesh in header)
  drawDocumentHeader(page, fonts, logoImg, {
    documentRef: vars.documentRef,
    dateStr: vars.issueDateStr,
  });

  const marginX = 44;
  const usableWidth = page.getSize().width - marginX * 2;
  let currentY = page.getSize().height - 105;

  // 4. Document Title
  currentY = drawDocumentTitle(page, fonts, "OFFICIAL JOINING CONFIRMATION", currentY);

  // 5. Salutation & Opening Paragraph
  currentY -= 6;
  page.drawText(cleanWinAnsi(`To: ${vars.employeeName} (Employee ID: ${vars.employeeId})`), {
    x: marginX,
    y: currentY,
    size: 9.5,
    font: fonts.timesBold,
    color: BRAND_COLORS.navyBlue,
  });
  currentY -= 13;
  page.drawText(cleanWinAnsi(`Department of ${vars.department}`), {
    x: marginX,
    y: currentY,
    size: 9,
    font: fonts.timesItalic,
    color: BRAND_COLORS.mutedText,
  });

  currentY -= 16;
  const openingText = `We are pleased to formally confirm your appointment and induction into ATOMIC PATHSHALA EDUCATION operating under the brand name Atomic Pathshala. This Joining Confirmation officially validates your onboarding records and engagement parameters as maintained within the institutional faculty and employee repository.`;
  
  // Wrap opening paragraph
  currentY = drawWrappedText(page, fonts.timesRoman, openingText, marginX, currentY, usableWidth, 9.5, 13.5, BRAND_COLORS.bodyText);

  // 6. Structured Appointment Details Table
  currentY -= 12;
  page.drawText("1. OFFICIAL APPOINTMENT SUMMARY", {
    x: marginX,
    y: currentY,
    size: 9,
    font: fonts.timesBold,
    color: BRAND_COLORS.navyBlue,
  });

  currentY -= 6;
  const summaryItems: { label: string; value: string }[] = [
    { label: "Employee Full Name", value: vars.employeeName },
    { label: "Employee ID", value: vars.employeeId },
    { label: "Designation", value: vars.designation },
    { label: "Department", value: vars.department },
    { label: "Employment Type", value: vars.employmentType.replace(/_/g, " ") },
    { label: "Date of Joining", value: vars.joiningDateStr },
    { label: "Reporting Authority", value: vars.reportingAuthority || "Founder & Director" },
    { label: "Work Location", value: vars.workLocation || "Rampur, Uttar Pradesh, India / Digital Streaming Studio" },
  ];

  if (vars.assignedSubject) {
    summaryItems.push({ label: "Assigned Subject", value: vars.assignedSubject });
  }
  if (vars.assignedBatch) {
    summaryItems.push({ label: "Assigned Batch(es)", value: vars.assignedBatch });
  }
  if (vars.workingSchedule) {
    summaryItems.push({ label: "Working Schedule", value: vars.workingSchedule });
  }
  if (vars.compensationReference) {
    summaryItems.push({ label: "Remuneration Terms", value: vars.compensationReference });
  }

  // Draw 2-column key-value grid
  const rowHeight = 16;
  const tableHeight = Math.ceil(summaryItems.length / 2) * rowHeight + 10;
  
  page.drawRectangle({
    x: marginX,
    y: currentY - tableHeight,
    width: usableWidth,
    height: tableHeight,
    color: BRAND_COLORS.cardBg,
    borderColor: BRAND_COLORS.borderLight,
    borderWidth: 0.6,
  });

  const col1X = marginX + 10;
  const col2X = marginX + usableWidth / 2 + 10;
  const maxValWidth = usableWidth / 2 - 118;
  let rowY = currentY - 14;

  function fitText(text: string, font: PDFFont, size: number, maxW: number): string {
    const clean = cleanWinAnsi(text);
    if (font.widthOfTextAtSize(clean, size) <= maxW) return clean;
    let s = clean;
    while (s.length > 3 && font.widthOfTextAtSize(s + "...", size) > maxW) {
      s = s.slice(0, -1);
    }
    return s + "...";
  }

  for (let i = 0; i < summaryItems.length; i += 2) {
    const item1 = summaryItems[i];
    const item2 = summaryItems[i + 1];

    if (item1) {
      page.drawText(cleanWinAnsi(`${item1.label}:`), {
        x: col1X,
        y: rowY,
        size: 7.5,
        font: fonts.timesBold,
        color: BRAND_COLORS.mutedText,
      });
      page.drawText(fitText(item1.value, fonts.timesRoman, 7.5, maxValWidth), {
        x: col1X + 105,
        y: rowY,
        size: 7.5,
        font: fonts.timesRoman,
        color: BRAND_COLORS.bodyText,
      });
    }

    if (item2) {
      page.drawText(cleanWinAnsi(`${item2.label}:`), {
        x: col2X,
        y: rowY,
        size: 7.5,
        font: fonts.timesBold,
        color: BRAND_COLORS.mutedText,
      });
      page.drawText(fitText(item2.value, fonts.timesRoman, 7.5, maxValWidth), {
        x: col2X + 105,
        y: rowY,
        size: 7.5,
        font: fonts.timesRoman,
        color: BRAND_COLORS.bodyText,
      });
    }

    rowY -= rowHeight;
  }

  currentY -= tableHeight + 14;

  // 7. Reporting Instructions & Onboarding Requirements
  page.drawText("2. REPORTING INSTRUCTIONS & ONBOARDING FORMALITIES", {
    x: marginX,
    y: currentY,
    size: 9,
    font: fonts.timesBold,
    color: BRAND_COLORS.navyBlue,
  });

  currentY -= 14;
  const reportingText = vars.reportingInstructions ||
    "You are requested to report to the Academic Directorate for orientation, timetable briefing, and institutional portal credential activation. Your service is governed by the formal terms in your Service Agreement and institutional policies.";

  currentY = drawWrappedText(page, fonts.timesRoman, reportingText, marginX, currentY, usableWidth, 8.5, 12.5, BRAND_COLORS.bodyText);

  currentY -= 8;
  const onboardingDocs = vars.requiredDocuments && vars.requiredDocuments.length > 0
    ? vars.requiredDocuments
    : [
        "Self-attested educational and professional qualification degree certificates.",
        "Government issued photo identity verification (Aadhaar / Voter ID / Passport).",
        "Permanent Account Number (PAN) card for official statutory records.",
        "Formal signed acknowledgement of the institutional code of conduct and policies.",
      ];

  for (const doc of onboardingDocs) {
    page.drawText(cleanWinAnsi(`*  ${doc}`), {
      x: marginX + 8,
      y: currentY,
      size: 8,
      font: fonts.timesRoman,
      color: BRAND_COLORS.bodyText,
    });
    currentY -= 12;
  }

  // 8. Acceptance Statement
  currentY -= 6;
  page.drawText("3. INSTITUTIONAL ACKNOWLEDGEMENT", {
    x: marginX,
    y: currentY,
    size: 9,
    font: fonts.timesBold,
    color: BRAND_COLORS.navyBlue,
  });

  currentY -= 14;
  const ackText = `By receiving this Joining Confirmation, the employee acknowledges and agrees to uphold the highest benchmarks of academic rigor, student empathy, confidentiality, and institutional integrity at Atomic Pathshala.`;
  currentY = drawWrappedText(page, fonts.timesRoman, ackText, marginX, currentY, usableWidth, 8.5, 12, BRAND_COLORS.mutedText);

  // 9. Dual Verification Block & Signatory
  const footerBoxY = 145;
  await drawUnifiedVerificationAndSignatory(pdfDoc, page, fonts, {
    y: footerBoxY,
    qrCodeDataUrl: vars.qrCodeDataUrl,
    verificationUrl: vars.verificationUrl,
    documentId: vars.documentRef,
    issueDateStr: vars.issueDateStr,
  });

  // 10. Footer with Page Number
  drawDocumentFooter(page, fonts, 1, 1, "Official Joining Confirmation");

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

function drawWrappedText(
  page: any,
  font: any,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number,
  lineHeight: number,
  color: any
): number {
  const words = cleanWinAnsi(text).split(" ");
  let line = "";
  let currentY = y;

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);
    if (testWidth > maxWidth) {
      page.drawText(line, { x, y: currentY, size: fontSize, font, color });
      line = word;
      currentY -= lineHeight;
    } else {
      line = testLine;
    }
  }

  if (line) {
    page.drawText(line, { x, y: currentY, size: fontSize, font, color });
    currentY -= lineHeight;
  }

  return currentY;
}
