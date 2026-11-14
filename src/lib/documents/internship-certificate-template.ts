/**
 * ATOMIC PATHSHALA — INTERNSHIP CERTIFICATE
 * Category 5: Official Institutional Internship Certificate
 * 
 * Design Standards:
 * - Royal Blue + Navy Blue + White universal branding
 * - Times New Roman font suite with genuine bold variant for inline emphasis
 * - Balanced institutional structure eliminating awkward page blank space
 * - Universal single Employee/Intern ID (e.g. AP10001) as sole visible identifier
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

export interface InternshipCertificateVariables {
  certificateNumber: string; // Internal reference
  issueDateStr: string;
  employeeName: string;
  employeeId: string; // Permanent unified ID: AP10001+
  designation: string; // e.g. "Academic Teaching Intern"
  department: string;
  startDateStr: string;
  endDateStr: string;
  conductRemarks?: string;
  qrCodeDataUrl?: string;
  verificationUrl?: string;
}

export async function buildInternshipCertificatePdf(
  vars: InternshipCertificateVariables
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
  currentY = drawDocumentTitle(page, fonts, "INTERNSHIP CERTIFICATE", currentY);

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

  // Paragraph 1: Certification of Successful Completion
  const p1 = `This is to officially certify that **${vars.employeeName}** (Employee ID: **${vars.employeeId}**) has successfully undertaken and completed an institutional internship program with **ATOMIC PATHSHALA EDUCATION**, operating under the registered brand **Atomic Pathshala**, as **${vars.designation}** in the Department of **${vars.department}**.`;
  currentY = drawRichParagraph(page, fonts, p1, marginX, currentY, usableWidth, 10.5, 17);

  currentY -= 12;

  // Paragraph 2: Internship Duration
  const p2 = `The internship tenure commenced on **${formattedStart}** and concluded on **${formattedEnd}**, during which the candidate actively engaged in academic operations, pedagogical research, instructional content development, and educational technology workflows under faculty mentorship.`;
  currentY = drawRichParagraph(page, fonts, p2, marginX, currentY, usableWidth, 10.5, 17);

  currentY -= 12;

  // Paragraph 3: Project Scope & Core Deliverables
  const p3 = `During this tenure, **${vars.employeeName}** demonstrated diligence, strong analytical acumen, and an earnest commitment to academic excellence. Key responsibilities included assisting in test assessment design, preparing high-quality instructional question banks, evaluating competitive learning materials, and supporting live educational session operations.`;
  currentY = drawRichParagraph(page, fonts, p3, marginX, currentY, usableWidth, 10.5, 17);

  currentY -= 12;

  // Paragraph 4: Performance, Conduct & Discipline
  const remarksText = vars.conductRemarks
    ? ` ${vars.conductRemarks}`
    : " They exhibited commendable punctuality, intellectual curiosity, moral integrity, and collaborative teamwork throughout the engagement.";
  const p4 = `Throughout the internship, their performance and character were found to be satisfactory and aligned with institutional benchmarks.${remarksText}`;
  currentY = drawRichParagraph(page, fonts, p4, marginX, currentY, usableWidth, 10.5, 17);

  currentY -= 12;

  // Paragraph 5: Institutional Appreciation & Future Wishes
  const p5 = `We appreciate the valuable contribution made by **${vars.employeeName}** during their internship association with **ATOMIC PATHSHALA EDUCATION** and wish them the very best in their higher academic pursuits and future professional career.`;
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
  drawDocumentFooter(page, fonts, 1, 1, "Internship Certificate");

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
