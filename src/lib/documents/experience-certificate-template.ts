/**
 * ATOMIC PATHSHALA — EXPERIENCE CERTIFICATE
 * Category 2: Official Pedagogical & Professional Experience Certificate
 * 
 * Design Standards:
 * - Royal Blue + Navy Blue + White universal branding
 * - Times New Roman font suite with genuine bold variant for inline emphasis
 * - Balanced 5-7 institutional paragraphs eliminating awkward page blank space
 * - Universal single Employee ID (e.g. AP10001) as the sole visible identifier
 * - Embedded authentic handwritten signature above executive signatory title
 * - Human-readable dates (e.g. "19 September 2026 to 14 November 2026")
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
  drawRichParagraph,
  formatOfficialDate,
  cleanWinAnsi,
  BRAND_COLORS,
} from "./universal-design-system";

export interface ExperienceCertificateVariables {
  certificateNumber: string; // Internal reference
  issueDateStr: string;
  employeeName: string;
  employeeId: string; // Permanent unified ID: AP10001+
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
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 Portrait
  const fonts = await embedUniversalFonts(pdfDoc);
  const logoImg = await loadBrandLogo(pdfDoc);

  // 1. Thin Royal Blue Border
  drawDocumentBorder(page);

  // 2. Transparent Central Logo Watermark
  drawBrandWatermark(page, logoImg);

  // 3. Document Header (Universal Single ID: displays Employee ID)
  drawDocumentHeader(page, fonts, logoImg, {
    documentRef: vars.employeeId,
    dateStr: formatOfficialDate(vars.issueDateStr),
    employeeId: vars.employeeId,
  });

  const marginX = 46;
  const usableWidth = page.getSize().width - marginX * 2;
  let currentY = page.getSize().height - 108;

  // 4. Document Title
  currentY = drawDocumentTitle(page, fonts, "EXPERIENCE CERTIFICATE", currentY);

  // 5. Salutation: TO WHOMSOEVER IT MAY CONCERN with elegant balanced side rules
  currentY -= 14;
  const whomText = "TO WHOMSOEVER IT MAY CONCERN";
  const whomWidth = fonts.timesBold.widthOfTextAtSize(whomText, 11);
  const ruleLen = 50;
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

  const formattedStart = formatOfficialDate(vars.startDateStr);
  const formattedEnd = formatOfficialDate(vars.endDateStr);
  const formattedIssue = formatOfficialDate(vars.issueDateStr);

  // Paragraph 1: Association & Designation
  const p1 = `This is to officially certify that **${vars.employeeName}** (Employee ID: **${vars.employeeId}**) was formally engaged with **ATOMIC PATHSHALA EDUCATION**, operating under the registered brand **Atomic Pathshala**, as **${vars.designation}** in the Department of **${vars.department}**.`;
  currentY = drawRichParagraph(page, fonts, p1, marginX, currentY, usableWidth, 10.5, 17);

  currentY -= 12;

  // Paragraph 2: Tenure & Dates
  const p2 = `The individual served as an integral member of our academic faculty from **${formattedStart}** to **${formattedEnd}**, fulfilling all instructional mandates, syllabus milestones, and institutional assignments with consistent pedagogical rigor and professionalism.`;
  currentY = drawRichParagraph(page, fonts, p2, marginX, currentY, usableWidth, 10.5, 17);

  currentY -= 12;

  // Paragraph 3: Nature of Responsibilities & Assigned Work
  const p3 = `In their capacity as **${vars.designation}**, their primary academic responsibilities included comprehensive classroom instruction, developing structured examination test series, conducting systematic doubt-resolution sessions, mentoring competitive entrance aspirants, and contributing to institutional curriculum curation in accordance with high academic standards.`;
  currentY = drawRichParagraph(page, fonts, p3, marginX, currentY, usableWidth, 10.5, 17);

  currentY -= 12;

  // Paragraph 4: Professional Conduct & Institutional Contribution
  const remarksText = vars.conductRemarks
    ? ` ${vars.conductRemarks}`
    : " They consistently maintained exemplary pedagogical standards, intellectual discipline, and collaborative collegiality.";
  const p4 = `Throughout their tenure with **Atomic Pathshala**, **${vars.employeeName}** maintained exemplary professional conduct, domain proficiency, sound moral integrity, and institutional commitment.${remarksText}`;
  currentY = drawRichParagraph(page, fonts, p4, marginX, currentY, usableWidth, 10.5, 17);

  currentY -= 12;

  // Paragraph 5: Appreciation & Closing Wishes
  const p5 = `We place on official institutional record our sincere appreciation for the valuable educational contributions rendered by **${vars.employeeName}** during their association with **ATOMIC PATHSHALA EDUCATION**. We extend our best wishes for their continued success and professional distinction in all future endeavors.`;
  currentY = drawRichParagraph(page, fonts, p5, marginX, currentY, usableWidth, 10.5, 17);

  currentY -= 16;

  // Official Issuance Note
  const issueLine = `Issued on **${formattedIssue}** under official seal and authorized executive signatory.`;
  currentY = drawRichParagraph(page, fonts, issueLine, marginX, currentY, usableWidth, 10, 16);

  // 6. Dual Verification Block & Signatory (Centered near bottom)
  const footerBoxY = 168;
  await drawUnifiedVerificationAndSignatory(pdfDoc, page, fonts, {
    y: footerBoxY,
    qrCodeDataUrl: vars.qrCodeDataUrl,
    verificationUrl: vars.verificationUrl,
    employeeId: vars.employeeId,
    documentId: vars.certificateNumber,
    issueDateStr: formattedIssue,
  });

  // 7. Footer with Page Number
  drawDocumentFooter(page, fonts, 1, 1, "Experience Certificate");

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
