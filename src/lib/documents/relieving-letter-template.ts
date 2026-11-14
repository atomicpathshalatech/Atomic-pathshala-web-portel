/**
 * ATOMIC PATHSHALA — RELIEVING LETTER & SERVICE RECORD
 * Category 3: Formal Institutional Relieving & Clearance Letter
 */

import { PDFDocument } from "pdf-lib";
import {
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

export interface RelievingLetterVariables {
  documentRef: string; // AP-REL-YYYY-XXXX
  issueDateStr: string;
  employeeName: string;
  employeeId: string;
  designation: string;
  department: string;
  joiningDateStr: string;
  lastWorkingDateStr: string;
  relievingEffectiveDateStr?: string;
  resignationReference?: string;
  handoverClearanceStatus: string; // e.g. "Completed & Verified", "Pending Handover"
  assetsReturnStatus: string;       // e.g. "Returned & Deactivated", "Pending"
  finalSettlementStatus: string;   // e.g. "Settled & Disbursed", "In Process per Billing Cycle"
  conductRemarks?: string;
  qrCodeDataUrl?: string;
  verificationUrl?: string;
}

export async function buildRelievingLetterPdf(
  vars: RelievingLetterVariables
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const fonts = await embedUniversalFonts(pdfDoc);
  const logoImg = await loadBrandLogo(pdfDoc);

  // 1. Thin Royal Blue Border
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
  currentY = drawDocumentTitle(page, fonts, "OFFICIAL RELIEVING LETTER", currentY);

  // 5. Recipient Details & Subject
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
  const subjectText = `Subject: Formal Relieving Letter, Service Record & Institutional Clearance`;
  page.drawText(cleanWinAnsi(subjectText), {
    x: marginX,
    y: currentY,
    size: 9.5,
    font: fonts.timesBold,
    color: BRAND_COLORS.navyBlue,
  });

  currentY -= 16;
  const separationRefText = vars.resignationReference
    ? `With reference to your formal resignation letter/communication (${vars.resignationReference}), `
    : `With reference to your formal request for separation of service, `;

  const relievingDate = vars.relievingEffectiveDateStr || vars.lastWorkingDateStr;
  const p1 = `${separationRefText}this is to officially confirm that you have been relieved of all academic duties, responsibilities, and administrative assignments as ${vars.designation} in the Department of ${vars.department} at ATOMIC PATHSHALA EDUCATION (operating under the brand name Atomic Pathshala), effective from the close of operational hours on ${relievingDate}.`;
  currentY = drawParagraph(page, fonts.timesRoman, p1, marginX, currentY, usableWidth, 9.5, 14);

  // 6. Structured Service & Administrative Clearance Record
  currentY -= 12;
  page.drawText("1. SERVICE DURATION & ADMINISTRATIVE CLEARANCE STATUS", {
    x: marginX,
    y: currentY,
    size: 9,
    font: fonts.timesBold,
    color: BRAND_COLORS.navyBlue,
  });

  currentY -= 6;
  const clearanceItems: { label: string; value: string }[] = [
    { label: "Original Date of Joining", value: vars.joiningDateStr },
    { label: "Last Working Date", value: vars.lastWorkingDateStr },
    { label: "Relieving Effective Date", value: relievingDate },
    { label: "Academic Handover Status", value: vars.handoverClearanceStatus },
    { label: "Institutional Assets Return", value: vars.assetsReturnStatus },
    { label: "Financial Settlement Status", value: vars.finalSettlementStatus },
  ];

  const rowHeight = 16;
  const tableHeight = Math.ceil(clearanceItems.length / 2) * rowHeight + 10;

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
  let rowY = currentY - 14;

  for (let i = 0; i < clearanceItems.length; i += 2) {
    const item1 = clearanceItems[i];
    const item2 = clearanceItems[i + 1];

    if (item1) {
      page.drawText(cleanWinAnsi(`${item1.label}:`), {
        x: col1X,
        y: rowY,
        size: 7.5,
        font: fonts.timesBold,
        color: BRAND_COLORS.mutedText,
      });
      page.drawText(cleanWinAnsi(item1.value), {
        x: col1X + 115,
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
      page.drawText(cleanWinAnsi(item2.value), {
        x: col2X + 115,
        y: rowY,
        size: 7.5,
        font: fonts.timesRoman,
        color: BRAND_COLORS.bodyText,
      });
    }

    rowY -= rowHeight;
  }

  currentY -= tableHeight + 14;

  // 7. Confidentiality & Continuing Obligations
  page.drawText("2. CONTINUING OBLIGATIONS & CONFIDENTIALITY", {
    x: marginX,
    y: currentY,
    size: 9,
    font: fonts.timesBold,
    color: BRAND_COLORS.navyBlue,
  });

  currentY -= 14;
  const ndaText = `Please be advised that in accordance with the terms of your engagement and applicable statutory laws, all non-disclosure obligations, intellectual property assignments, trade secret protections, and student data privacy commitments survive the termination of your service indefinitely. You are legally bound not to disclose, duplicate, or misappropriate any proprietary test repositories, student records, or internal pedagogical systems.`;
  currentY = drawParagraph(page, fonts.timesRoman, ndaText, marginX, currentY, usableWidth, 8.5, 12.5);

  currentY -= 10;
  const closingText = `We appreciate your academic dedication and contributions during your tenure with Atomic Pathshala. We wish you continued success, accomplishment, and professional distinction in all your future endeavors.`;
  currentY = drawParagraph(page, fonts.timesRoman, closingText, marginX, currentY, usableWidth, 9, 13);

  // 8. Dual Verification Block & Signatory
  const footerBoxY = 145;
  await drawUnifiedVerificationAndSignatory(pdfDoc, page, fonts, {
    y: footerBoxY,
    qrCodeDataUrl: vars.qrCodeDataUrl,
    verificationUrl: vars.verificationUrl,
    documentId: vars.documentRef,
    issueDateStr: vars.issueDateStr,
  });

  // 9. Footer with Page Number
  drawDocumentFooter(page, fonts, 1, 1, "Official Relieving Letter");

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

function drawParagraph(
  page: any,
  font: any,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number,
  lineHeight: number
): number {
  const words = cleanWinAnsi(text).split(" ");
  let line = "";
  let currentY = y;

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    const testWidth = font.widthOfTextAtSize(testLine, fontSize);
    if (testWidth > maxWidth) {
      page.drawText(line, {
        x,
        y: currentY,
        size: fontSize,
        font,
        color: BRAND_COLORS.bodyText,
      });
      line = word;
      currentY -= lineHeight;
    } else {
      line = testLine;
    }
  }

  if (line) {
    page.drawText(line, {
      x,
      y: currentY,
      size: fontSize,
      font,
      color: BRAND_COLORS.bodyText,
    });
    currentY -= lineHeight;
  }

  return currentY;
}
