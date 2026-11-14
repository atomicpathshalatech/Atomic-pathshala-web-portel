/**
 * ATOMIC PATHSHALA — EXPERIENCE CERTIFICATE
 * Category 2: Official Pedagogical & Professional Experience Certificate
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

export interface ExperienceCertificateVariables {
  certificateNumber: string; // AP-EXP-YYYY-XXXX
  issueDateStr: string;
  employeeName: string;
  employeeId: string;
  designation: string;
  department: string;
  startDateStr: string;
  endDateStr: string;
  conductRemarks?: string;
  qrCodeDataUrl?: string;
  verificationUrl?: string;
}

export async function buildExperienceCertificatePdf(
  vars: ExperienceCertificateVariables
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
    documentRef: vars.certificateNumber,
    dateStr: vars.issueDateStr,
  });

  const marginX = 44;
  const usableWidth = page.getSize().width - marginX * 2;
  let currentY = page.getSize().height - 110;

  // 4. Document Title
  currentY = drawDocumentTitle(page, fonts, "EXPERIENCE CERTIFICATE", currentY);

  // 5. Salutation: TO WHOMSOEVER IT MAY CONCERN with side rules
  currentY -= 14;
  const whomText = "TO WHOMSOEVER IT MAY CONCERN";
  const whomWidth = fonts.timesBold.widthOfTextAtSize(whomText, 11);
  const ruleLen = 45;
  page.drawLine({
    start: { x: (page.getSize().width - whomWidth) / 2 - ruleLen - 12, y: currentY + 3.5 },
    end: { x: (page.getSize().width - whomWidth) / 2 - 12, y: currentY + 3.5 },
    thickness: 0.8,
    color: BRAND_COLORS.navyBlue,
  });
  page.drawText(whomText, {
    x: (page.getSize().width - whomWidth) / 2,
    y: currentY,
    size: 11,
    font: fonts.timesBold,
    color: BRAND_COLORS.navyBlue,
  });
  page.drawLine({
    start: { x: (page.getSize().width + whomWidth) / 2 + 12, y: currentY + 3.5 },
    end: { x: (page.getSize().width + whomWidth) / 2 + ruleLen + 12, y: currentY + 3.5 },
    thickness: 0.8,
    color: BRAND_COLORS.navyBlue,
  });

  currentY -= 26;

  // 6. Professional Certification Body Paragraphs (Clean NCERT / Universal pattern)
  const p1 = `This is to certify that ${vars.employeeName} (Employee ID: ${vars.employeeId}) was associated with Atomic Pathshala as a ${vars.designation} in the Department of ${vars.department}.`;
  currentY = drawParagraph(page, fonts.timesRoman, p1, marginX, currentY, usableWidth, 10, 16);

  currentY -= 12;
  const p2 = `The individual worked with our organization from ${vars.startDateStr} to ${vars.endDateStr}.`;
  currentY = drawParagraph(page, fonts.timesRoman, p2, marginX, currentY, usableWidth, 10, 16);

  currentY -= 12;
  const remarks = vars.conductRemarks || "During this period, they demonstrated strong subject expertise, effective teaching practices, academic leadership and a high level of professional commitment.";
  currentY = drawParagraph(page, fonts.timesRoman, remarks, marginX, currentY, usableWidth, 10, 16);

  currentY -= 12;
  const p4 = `We appreciate their valuable contribution to Atomic Pathshala and wish them success in their future endeavors.`;
  currentY = drawParagraph(page, fonts.timesRoman, p4, marginX, currentY, usableWidth, 10, 16);

  currentY -= 16;
  const issueLine = `Issued on ${vars.issueDateStr}.`;
  page.drawText(cleanWinAnsi(issueLine), {
    x: marginX,
    y: currentY,
    size: 9.5,
    font: fonts.timesBold,
    color: BRAND_COLORS.navyBlue,
  });

  // 7. Dual Verification Block & Signatory (Matching approved pattern)
  const footerBoxY = 168;
  await drawUnifiedVerificationAndSignatory(pdfDoc, page, fonts, {
    y: footerBoxY,
    qrCodeDataUrl: vars.qrCodeDataUrl,
    verificationUrl: vars.verificationUrl,
    documentId: vars.certificateNumber,
    issueDateStr: vars.issueDateStr,
  });

  // 8. Footer with Page Number
  drawDocumentFooter(page, fonts, 1, 1, "Experience Certificate");

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
