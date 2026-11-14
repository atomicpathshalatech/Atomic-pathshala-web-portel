/**
 * ATOMIC PATHSHALA — UNIVERSAL DESIGN SYSTEM FOR OFFICIAL DOCUMENTS
 * 
 * Strict Universal Branding Guidelines:
 * - Royal Blue: #1456C0 (rgb: 0.078, 0.337, 0.753)
 * - Navy Blue: #102A56 (rgb: 0.063, 0.165, 0.337)
 * - Accent Blue: #2878E5 (rgb: 0.157, 0.471, 0.898)
 * - White: #FFFFFF (rgb: 1, 1, 1)
 * - Body Text: #171717 (rgb: 0.09, 0.09, 0.09)
 * - Muted Text: #475569 (rgb: 0.28, 0.33, 0.41)
 * - Background/Card: #F8FAFC (rgb: 0.97, 0.98, 1.0)
 * 
 * Typography: Times New Roman throughout (StandardFonts.TimesRoman suite)
 * Layout:
 * - A4 Portrait (595.28 x 841.89 pt)
 * - Simple thin royal blue border around page margin (0.75 pt)
 * - Transparent central logo watermark (opacity 0.045)
 * - Consistent Header: Logo + ATOMIC PATHSHALA wordmark + LEARN • EXPLORE • EXCEL
 * - NO Rampur, Uttar Pradesh in header!
 * - ATOMIC PATHSHALA EDUCATION displayed only once where required (signatory block).
 * - Running footer with page numbering: "Page X of Y"
 */

import { PDFDocument, PDFPage, PDFFont, PDFImage, rgb, StandardFonts } from "pdf-lib";
import fs from "fs";
import path from "path";

export const BRAND_COLORS = {
  royalBlue: rgb(0.078, 0.337, 0.753),  // #1456C0
  navyBlue: rgb(0.063, 0.165, 0.337),   // #102A56
  accentBlue: rgb(0.157, 0.471, 0.898), // #2878E5
  white: rgb(1, 1, 1),                  // #FFFFFF
  bodyText: rgb(0.09, 0.09, 0.09),      // #171717
  mutedText: rgb(0.28, 0.33, 0.41),     // #475569
  borderLight: rgb(0.85, 0.88, 0.94),
  cardBg: rgb(0.97, 0.985, 1.0),
  successGreen: rgb(0.08, 0.55, 0.25),
};

export interface UniversalFonts {
  timesRoman: PDFFont;
  timesBold: PDFFont;
  timesItalic: PDFFont;
  timesBoldItalic: PDFFont;
}

export async function embedUniversalFonts(pdfDoc: PDFDocument): Promise<UniversalFonts> {
  const timesRoman = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const timesItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const timesBoldItalic = await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic);
  return { timesRoman, timesBold, timesItalic, timesBoldItalic };
}

export async function loadBrandLogo(pdfDoc: PDFDocument): Promise<PDFImage | null> {
  try {
    const logoPath = path.join(process.cwd(), "public", "logo.png");
    if (fs.existsSync(logoPath)) {
      const buffer = fs.readFileSync(logoPath);
      return await pdfDoc.embedPng(buffer);
    }
  } catch (err) {
    console.warn("[universal-design-system] Could not embed logo image:", err);
  }
  return null;
}

export function cleanWinAnsi(text: string): string {
  if (!text) return "";
  return text
    .replace(/[—–]/g, "-")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/•/g, "*")
    .replace(/✔/g, "[X]")
    .replace(/[^\x00-\xFF]/g, "");
}

/**
 * 1. Draw Thin Professional Royal Blue Page Border
 */
export function drawDocumentBorder(page: PDFPage) {
  const { width, height } = page.getSize();
  const inset = 24; // 24 pt from page edges
  page.drawRectangle({
    x: inset,
    y: inset,
    width: width - inset * 2,
    height: height - inset * 2,
    borderWidth: 0.75,
    borderColor: BRAND_COLORS.royalBlue,
    color: undefined, // transparent fill
  });
}

/**
 * 2. Draw Subtle Central Brand Watermark
 */
export function drawBrandWatermark(page: PDFPage, logoImg: PDFImage | null) {
  if (!logoImg) return;
  const { width, height } = page.getSize();
  const watermarkSize = 250;
  page.drawImage(logoImg, {
    x: (width - watermarkSize) / 2,
    y: (height - watermarkSize) / 2,
    width: watermarkSize,
    height: watermarkSize,
    opacity: 0.045, // very subtle, highly professional
  });
}

/**
 * 3. Draw Document Header
 * First page gets full letterhead; subsequent pages get sleek running header.
 * CRITICAL: NO Rampur, Uttar Pradesh in header!
 */
export function drawDocumentHeader(
  page: PDFPage,
  fonts: UniversalFonts,
  logoImg: PDFImage | null,
  options: {
    documentRef: string;
    dateStr: string;
    isSubsequentPage?: boolean;
    subsequentTitle?: string;
  }
) {
  const { width, height } = page.getSize();
  const marginX = 44;

  if (options.isSubsequentPage) {
    // Sleek Running Header for Multi-page contracts
    const topY = height - 42;
    page.drawText(cleanWinAnsi(options.subsequentTitle || "ATOMIC PATHSHALA - OFFICIAL DOCUMENT"), {
      x: marginX,
      y: topY,
      size: 8,
      font: fonts.timesBold,
      color: BRAND_COLORS.navyBlue,
    });

    const refText = `Ref: ${cleanWinAnsi(options.documentRef)}`;
    page.drawText(refText, {
      x: width - marginX - fonts.timesRoman.widthOfTextAtSize(refText, 8),
      y: topY,
      size: 8,
      font: fonts.timesRoman,
      color: BRAND_COLORS.mutedText,
    });

    // Thin accent dividing line
    page.drawLine({
      start: { x: marginX, y: topY - 6 },
      end: { x: width - marginX, y: topY - 6 },
      thickness: 0.5,
      color: BRAND_COLORS.accentBlue,
    });
    return;
  }

  // Primary First-Page Official Header
  const headerTopY = height - 42;
  const logoHeight = 44;
  const logoWidth = logoImg ? (logoImg.width / logoImg.height) * logoHeight : 44;

  if (logoImg) {
    page.drawImage(logoImg, {
      x: marginX,
      y: headerTopY - logoHeight + 4,
      width: logoWidth,
      height: logoHeight,
    });
  }

  const brandTextX = logoImg ? marginX + logoWidth + 12 : marginX;

  // Primary Brand Wordmark
  page.drawText("ATOMIC PATHSHALA", {
    x: brandTextX,
    y: headerTopY - 14,
    size: 16,
    font: fonts.timesBold,
    color: BRAND_COLORS.navyBlue,
  });

  // Official Tagline
  page.drawText("LEARN * EXPLORE * EXCEL", {
    x: brandTextX,
    y: headerTopY - 28,
    size: 8,
    font: fonts.timesBold,
    color: BRAND_COLORS.accentBlue,
  });

  // Top-Right Document Reference Block
  const refText = `Ref: ${cleanWinAnsi(options.documentRef)}`;
  const dateText = `Date: ${cleanWinAnsi(options.dateStr)}`;

  const refWidth = fonts.timesBold.widthOfTextAtSize(refText, 8.5);
  const dateWidth = fonts.timesRoman.widthOfTextAtSize(dateText, 8);

  page.drawText(refText, {
    x: width - marginX - refWidth,
    y: headerTopY - 14,
    size: 8.5,
    font: fonts.timesBold,
    color: BRAND_COLORS.navyBlue,
  });

  page.drawText(dateText, {
    x: width - marginX - dateWidth,
    y: headerTopY - 26,
    size: 8,
    font: fonts.timesRoman,
    color: BRAND_COLORS.mutedText,
  });

  // Dual Header Rule (Royal Blue + Accent Blue)
  const ruleY = headerTopY - logoHeight - 6;
  page.drawLine({
    start: { x: marginX, y: ruleY },
    end: { x: width - marginX, y: ruleY },
    thickness: 1.25,
    color: BRAND_COLORS.royalBlue,
  });

  page.drawLine({
    start: { x: marginX, y: ruleY - 2.5 },
    end: { x: width - marginX, y: ruleY - 2.5 },
    thickness: 0.6,
    color: BRAND_COLORS.accentBlue,
  });
}

/**
 * 4. Draw Document Title
 */
export function drawDocumentTitle(
  page: PDFPage,
  fonts: UniversalFonts,
  title: string,
  startY: number
): number {
  const { width } = page.getSize();
  const cleanTitleStr = cleanWinAnsi(title);
  const titleSize = 13.5;
  const titleWidth = fonts.timesBold.widthOfTextAtSize(cleanTitleStr, titleSize);

  page.drawText(cleanTitleStr, {
    x: (width - titleWidth) / 2,
    y: startY,
    size: titleSize,
    font: fonts.timesBold,
    color: BRAND_COLORS.navyBlue,
  });

  // Underline accent
  page.drawLine({
    start: { x: (width - titleWidth) / 2 - 12, y: startY - 5 },
    end: { x: (width + titleWidth) / 2 + 12, y: startY - 5 },
    thickness: 1,
    color: BRAND_COLORS.accentBlue,
  });

  return startY - 24;
}

/**
 * 5. Draw Running Page Footer
 */
export function drawDocumentFooter(
  page: PDFPage,
  fonts: UniversalFonts,
  pageNumber: number,
  totalPages: number,
  docTypeTag: string
) {
  const { width } = page.getSize();
  const marginX = 44;
  const footerY = 36;

  page.drawLine({
    start: { x: marginX, y: footerY + 12 },
    end: { x: width - marginX, y: footerY + 12 },
    thickness: 0.5,
    color: BRAND_COLORS.borderLight,
  });

  // Left Tagline & Document Category
  const footerLeft = cleanWinAnsi(`Atomic Pathshala - ${docTypeTag}`);
  page.drawText(footerLeft, {
    x: marginX,
    y: footerY,
    size: 7.5,
    font: fonts.timesRoman,
    color: BRAND_COLORS.mutedText,
  });

  // Right Page Counter
  const pageStr = `Page ${pageNumber} of ${totalPages}`;
  const pageWidthVal = fonts.timesBold.widthOfTextAtSize(pageStr, 7.5);
  page.drawText(pageStr, {
    x: width - marginX - pageWidthVal,
    y: footerY,
    size: 7.5,
    font: fonts.timesBold,
    color: BRAND_COLORS.navyBlue,
  });
}

/**
 * 6. Draw Unified Dual Verification & Signatory Block
 */
export async function drawUnifiedVerificationAndSignatory(
  pdfDoc: PDFDocument,
  page: PDFPage,
  fonts: UniversalFonts,
  options: {
    y: number;
    qrCodeDataUrl?: string;
    verificationUrl?: string;
    documentId: string;
    issueDateStr: string;
  }
): Promise<number> {
  const { width } = page.getSize();
  const marginX = 44;
  const usableWidth = width - marginX * 2;
  const boxHeight = 100;
  const boxY = options.y - boxHeight;

  // Background Box
  page.drawRectangle({
    x: marginX,
    y: boxY,
    width: usableWidth,
    height: boxHeight,
    color: BRAND_COLORS.cardBg,
    borderColor: BRAND_COLORS.borderLight,
    borderWidth: 0.8,
  });

  // Embed QR Code on the left
  let qrDrawn = false;
  if (options.qrCodeDataUrl) {
    try {
      const qrBase64 = options.qrCodeDataUrl.replace(/^data:image\/\w+;base64,/, "");
      const qrBuffer = Buffer.from(qrBase64, "base64");
      const qrImg = await pdfDoc.embedPng(qrBuffer);
      page.drawImage(qrImg, {
        x: marginX + 10,
        y: boxY + 10,
        width: 80,
        height: 80,
      });
      qrDrawn = true;
    } catch (e) {
      console.warn("[universal-design-system] QR embed notice:", e);
    }
  }

  const textLeft = qrDrawn ? marginX + 100 : marginX + 16;

  // Left Verification Text
  page.drawText("OFFICIAL VERIFICATION QR", {
    x: textLeft,
    y: boxY + boxHeight - 20,
    size: 8,
    font: fonts.timesBold,
    color: BRAND_COLORS.navyBlue,
  });

  page.drawText("Scan with any camera or smartphone to verify the authenticity", {
    x: textLeft,
    y: boxY + boxHeight - 33,
    size: 7.5,
    font: fonts.timesRoman,
    color: BRAND_COLORS.mutedText,
  });

  page.drawText("of this credential directly on the official institutional portal:", {
    x: textLeft,
    y: boxY + boxHeight - 44,
    size: 7.5,
    font: fonts.timesRoman,
    color: BRAND_COLORS.mutedText,
  });

  const verifyUrl = cleanWinAnsi(options.verificationUrl || `https://atomicpathshala.in/verify/${options.documentId}`);
  page.drawText(verifyUrl, {
    x: textLeft,
    y: boxY + boxHeight - 56,
    size: 7.5,
    font: fonts.timesBold,
    color: BRAND_COLORS.royalBlue,
  });

  page.drawText(cleanWinAnsi(`Doc ID: ${options.documentId} * Issued: ${options.issueDateStr}`), {
    x: textLeft,
    y: boxY + boxHeight - 70,
    size: 7,
    font: fonts.timesItalic,
    color: BRAND_COLORS.mutedText,
  });

  page.drawText("[VERIFIED INSTITUTIONAL RECORD]", {
    x: textLeft,
    y: boxY + boxHeight - 84,
    size: 7,
    font: fonts.timesBold,
    color: BRAND_COLORS.successGreen,
  });

  // Right Signatory Block
  const sigX = width - marginX - 165;

  page.drawText("AUTHORIZED SIGNATORY", {
    x: sigX,
    y: boxY + boxHeight - 20,
    size: 7.5,
    font: fonts.timesBold,
    color: BRAND_COLORS.navyBlue,
  });

  // Calligraphic script
  page.drawText("Firoz Ali", {
    x: sigX,
    y: boxY + boxHeight - 44,
    size: 18,
    font: fonts.timesItalic,
    color: BRAND_COLORS.navyBlue,
  });

  page.drawText("FIROZ ALI", {
    x: sigX,
    y: boxY + boxHeight - 56,
    size: 9,
    font: fonts.timesBold,
    color: BRAND_COLORS.navyBlue,
  });

  page.drawText("Founder & Director", {
    x: sigX,
    y: boxY + boxHeight - 67,
    size: 8,
    font: fonts.timesRoman,
    color: BRAND_COLORS.bodyText,
  });

  page.drawText("ATOMIC PATHSHALA EDUCATION", {
    x: sigX,
    y: boxY + boxHeight - 78,
    size: 7.5,
    font: fonts.timesBold,
    color: BRAND_COLORS.mutedText,
  });

  page.drawText("Rampur, Uttar Pradesh, India", {
    x: sigX,
    y: boxY + boxHeight - 88,
    size: 7,
    font: fonts.timesRoman,
    color: BRAND_COLORS.mutedText,
  });

  return boxY;
}
