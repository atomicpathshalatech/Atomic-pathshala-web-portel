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

  // 5. Salutation: TO WHOMSOEVER IT MAY CONCERN
  currentY -= 14;
  const whomText = "TO WHOMSOEVER IT MAY CONCERN";
  const whomWidth = fonts.timesBold.widthOfTextAtSize(whomText, 11);
  page.drawText(whomText, {
    x: (page.getSize().width - whomWidth) / 2,
    y: currentY,
    size: 11,
    font: fonts.timesBold,
    color: BRAND_COLORS.navyBlue,
  });

  currentY -= 24;

  // 6. Professional Certification Body Paragraphs
  const p1 = `This is to officially certify that ${vars.employeeName} (Employee Reference ID: ${vars.employeeId}) was engaged with ATOMIC PATHSHALA EDUCATION, operating under the brand name Atomic Pathshala, having its academic and administrative headquarters at Rampur, Uttar Pradesh, India.`;
  currentY = drawParagraph(page, fonts.timesRoman, p1, marginX, currentY, usableWidth, 10, 15);

  currentY -= 12;
  const p2 = `During their tenure spanning from ${vars.startDateStr} to ${vars.endDateStr}, ${vars.employeeName} served with commendable pedagogical excellence, dedication, and professionalism as ${vars.designation} in the Department of ${vars.department}.`;
  currentY = drawParagraph(page, fonts.timesRoman, p2, marginX, currentY, usableWidth, 10, 15);

  currentY -= 12;
  const remarks = vars.conductRemarks || "Their professional conduct, character, and pedagogical integrity were found to be exemplary throughout their engagement.";
  const p3 = `Throughout their service, they exhibited high academic rigor, structured classroom delivery aligned with national competitive benchmarks (NEET / JEE), and active mentorship towards student conceptual growth. ${remarks}`;
  currentY = drawParagraph(page, fonts.timesRoman, p3, marginX, currentY, usableWidth, 10, 15);

  currentY -= 12;
  const p4 = `We extend our sincere appreciation to ${vars.employeeName} for their valuable academic contributions to the institution and wish them the very best in all their future academic and professional endeavors.`;
  currentY = drawParagraph(page, fonts.timesRoman, p4, marginX, currentY, usableWidth, 10, 15);

  currentY -= 14;
  const issueLine = `Issued on this ${vars.issueDateStr} at Rampur, Uttar Pradesh, India under official institutional authority.`;
  page.drawText(cleanWinAnsi(issueLine), {
    x: marginX,
    y: currentY,
    size: 8.5,
    font: fonts.timesItalic,
    color: BRAND_COLORS.mutedText,
  });

  // 7. Dual Verification Block & Signatory
  const footerBoxY = 145;
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
