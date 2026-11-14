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
import * as fs from "fs";
import * as path from "path";

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

export async function loadBrandSignature(pdfDoc: PDFDocument): Promise<PDFImage | null> {
  try {
    const candidates = [
      path.join(process.cwd(), "public", "brand", "signature.png"),
      path.join(process.cwd(), "public", "signature.png"),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        const buffer = fs.readFileSync(p);
        return await pdfDoc.embedPng(buffer);
      }
    }
  } catch (err) {
    console.warn("[universal-design-system] Could not embed signature image:", err);
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
 * Format any date input into official institutional UK/Indian format: "19 September 2026"
 */
export function formatOfficialDate(dateInput: string | Date | undefined | null): string {
  if (!dateInput) return "";
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return "";
    return dateInput.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  }
  const str = String(dateInput).trim();
  if (!str || str.toLowerCase() === "present") return "Present";
  if (/^\d{1,2}\s+[A-Za-z]+\s+\d{4}$/.test(str)) {
    return str;
  }
  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  }
  return str;
}

/**
 * Draw a rich paragraph with inline markdown bold (**bold**) support using Times New Roman fonts
 * Word-level typography engine: never introduces spaces before punctuation like commas, periods, or brackets.
 */
export function drawRichParagraph(
  page: PDFPage,
  fonts: UniversalFonts,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  fontSize: number = 10,
  lineHeight: number = 16
): number {
  const clean = cleanWinAnsi(text);

  interface StyledPart {
    text: string;
    isBold: boolean;
    width: number;
  }

  interface RichWord {
    parts: StyledPart[];
    totalWidth: number;
  }

  const words: RichWord[] = [];
  let currentWordParts: StyledPart[] = [];
  let currentWordWidth = 0;
  let currentBuffer = "";
  let isBold = false;

  const flushBufferToPart = () => {
    if (currentBuffer.length > 0) {
      const font = isBold ? fonts.timesBold : fonts.timesRoman;
      const width = font.widthOfTextAtSize(currentBuffer, fontSize);
      currentWordParts.push({ text: currentBuffer, isBold, width });
      currentWordWidth += width;
      currentBuffer = "";
    }
  };

  const flushWord = () => {
    flushBufferToPart();
    if (currentWordParts.length > 0) {
      words.push({ parts: currentWordParts, totalWidth: currentWordWidth });
      currentWordParts = [];
      currentWordWidth = 0;
    }
  };

  let i = 0;
  while (i < clean.length) {
    if (clean[i] === "*" && clean[i + 1] === "*") {
      flushBufferToPart();
      isBold = !isBold;
      i += 2;
    } else if (/\s/.test(clean[i])) {
      flushWord();
      while (i < clean.length && /\s/.test(clean[i])) {
        i++;
      }
    } else {
      currentBuffer += clean[i];
      i++;
    }
  }
  flushWord();

  const spaceWidth = fonts.timesBold.widthOfTextAtSize(" ", fontSize) * 1.35;
  let currentLine: RichWord[] = [];
  let currentLineWidth = 0;
  let currentY = y;

  const flushLine = (lineWords: RichWord[]) => {
    let curX = x;
    for (let wIdx = 0; wIdx < lineWords.length; wIdx++) {
      const word = lineWords[wIdx];
      for (const part of word.parts) {
        const font = part.isBold ? fonts.timesBold : fonts.timesRoman;
        page.drawText(part.text, {
          x: curX,
          y: currentY,
          size: fontSize,
          font,
          color: BRAND_COLORS.bodyText,
        });
        curX += part.width;
      }
      if (wIdx < lineWords.length - 1) {
        curX += spaceWidth;
      }
    }
    currentY -= lineHeight;
  };

  for (const word of words) {
    const testWidth = currentLineWidth === 0 ? word.totalWidth : currentLineWidth + spaceWidth + word.totalWidth;
    if (testWidth > maxWidth && currentLine.length > 0) {
      flushLine(currentLine);
      currentLine = [word];
      currentLineWidth = word.totalWidth;
    } else {
      currentLine.push(word);
      currentLineWidth = testWidth;
    }
  }

  if (currentLine.length > 0) {
    flushLine(currentLine);
  }

  return currentY;
}

/**
 * 1. Draw Thin Professional Royal Blue Page Border with Corner Geometric Accents
 */
export function drawDocumentBorder(page: PDFPage) {
  const { width, height } = page.getSize();

  // Top-left geometric corner accents
  page.drawSvgPath(`M 0 ${height} L 56 ${height} L 0 ${height - 56} Z`, {
    color: BRAND_COLORS.royalBlue,
  });
  page.drawSvgPath(`M 0 ${height - 24} L 32 ${height} L 46 ${height} L 0 ${height - 46} Z`, {
    color: BRAND_COLORS.navyBlue,
  });

  // Bottom-right geometric corner accents
  page.drawSvgPath(`M ${width} 0 L ${width - 56} 0 L ${width} 56 Z`, {
    color: BRAND_COLORS.royalBlue,
  });
  page.drawSvgPath(`M ${width} 24 L ${width - 32} 0 L ${width - 46} 0 L ${width} 46 Z`, {
    color: BRAND_COLORS.navyBlue,
  });

  // Top-right subtle accent
  page.drawSvgPath(`M ${width} ${height} L ${width - 35} ${height} L ${width} ${height - 35} Z`, {
    color: BRAND_COLORS.accentBlue,
  });

  // Bottom-left subtle accent
  page.drawSvgPath(`M 0 0 L 35 0 L 0 35 Z`, {
    color: BRAND_COLORS.accentBlue,
  });

  // Outer thin border
  const inset1 = 16;
  page.drawRectangle({
    x: inset1,
    y: inset1,
    width: width - inset1 * 2,
    height: height - inset1 * 2,
    borderWidth: 0.9,
    borderColor: BRAND_COLORS.royalBlue,
  });

  // Inner thin border
  const inset2 = 20;
  page.drawRectangle({
    x: inset2,
    y: inset2,
    width: width - inset2 * 2,
    height: height - inset2 * 2,
    borderWidth: 0.5,
    borderColor: BRAND_COLORS.navyBlue,
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
    employeeId?: string;
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
 * 4. Draw Document Title (Clean Navy Bold Text with Clean Underline Accent, NO solid background)
 */
export function drawDocumentTitle(
  page: PDFPage,
  fonts: UniversalFonts,
  title: string,
  startY: number
): number {
  const { width } = page.getSize();
  const cleanTitleStr = cleanWinAnsi(title);
  const titleSize = 14;
  const titleWidth = fonts.timesBold.widthOfTextAtSize(cleanTitleStr, titleSize);

  page.drawText(cleanTitleStr, {
    x: (width - titleWidth) / 2,
    y: startY,
    size: titleSize,
    font: fonts.timesBold,
    color: BRAND_COLORS.navyBlue,
  });

  // Clean horizontal line drawn beneath it
  const lineY = startY - 7;
  const lineExtend = 36;
  page.drawLine({
    start: { x: (width - titleWidth) / 2 - lineExtend, y: lineY },
    end: { x: (width + titleWidth) / 2 + lineExtend, y: lineY },
    thickness: 1.2,
    color: BRAND_COLORS.royalBlue,
  });

  return startY - 26;
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
  // Single-page certificates already have the complete institutional footer
  if (totalPages <= 1) {
    return;
  }

  const { width } = page.getSize();
  const marginX = 44;
  const footerY = 28;

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
    employeeId?: string;
    documentId?: string;
    issueDateStr: string;
    signatureImg?: PDFImage | null;
  }
): Promise<number> {
  const { width } = page.getSize();
  const marginX = 44;
  const usableWidth = width - marginX * 2;
  const boxHeight = 100;
  const boxY = options.y - boxHeight;

  // 1. Enclosing verification card with thin border
  page.drawRectangle({
    x: marginX,
    y: boxY,
    width: usableWidth,
    height: boxHeight,
    color: rgb(1, 1, 1),
    borderColor: BRAND_COLORS.borderLight,
    borderWidth: 0.8,
  });

  // 2. Embed QR Code on the left
  const qrX = marginX + 14;
  const qrY = boxY + 22;
  const qrSize = 60;
  let qrDrawn = false;

  if (options.qrCodeDataUrl) {
    try {
      const qrBase64 = options.qrCodeDataUrl.replace(/^data:image\/\w+;base64,/, "");
      const qrBuffer = Buffer.from(qrBase64, "base64");
      const qrImg = await pdfDoc.embedPng(qrBuffer);
      page.drawImage(qrImg, {
        x: qrX,
        y: qrY,
        width: qrSize,
        height: qrSize,
      });
      qrDrawn = true;
    } catch (e) {
      console.warn("[universal-design-system] QR embed notice:", e);
    }
  }

  // "SCAN TO VERIFY" badge beneath QR Code
  const badgeWidth = qrSize + 8;
  const badgeHeight = 13;
  const badgeX = qrX - 4;
  const badgeY = boxY + 6;
  page.drawRectangle({
    x: badgeX,
    y: badgeY,
    width: badgeWidth,
    height: badgeHeight,
    color: BRAND_COLORS.royalBlue,
  });

  const badgeText = "SCAN TO VERIFY";
  const badgeTextW = fonts.timesBold.widthOfTextAtSize(badgeText, 6);
  page.drawText(badgeText, {
    x: badgeX + (badgeWidth - badgeTextW) / 2,
    y: badgeY + 3.5,
    size: 6,
    font: fonts.timesBold,
    color: rgb(1, 1, 1),
  });

  // Text next to QR Code
  const textLeft = qrDrawn ? marginX + 90 : marginX + 16;

  page.drawText("Verify this document at", {
    x: textLeft,
    y: boxY + boxHeight - 25,
    size: 9.5,
    font: fonts.timesBold,
    color: BRAND_COLORS.navyBlue,
  });

  // Light blue pill badge for URL
  const pillY = boxY + boxHeight - 48;
  const pillW = 155;
  const pillH = 18;
  page.drawRectangle({
    x: textLeft,
    y: pillY,
    width: pillW,
    height: pillH,
    color: rgb(0.92, 0.96, 1),
    borderColor: rgb(0.72, 0.84, 0.98),
    borderWidth: 0.6,
  });

  const verifyDomain = "ap.atomicpathshala.in/verify";
  const domainW = fonts.timesBold.widthOfTextAtSize(verifyDomain, 8.5);
  page.drawText(verifyDomain, {
    x: textLeft + (pillW - domainW) / 2,
    y: pillY + 5,
    size: 8.5,
    font: fonts.timesBold,
    color: BRAND_COLORS.royalBlue,
  });

  // Universal Single ID Requirement: Always display Employee ID (e.g. AP10001)
  const displayId = options.employeeId || options.documentId || "";
  page.drawText(cleanWinAnsi(`Employee ID: ${displayId}`), {
    x: textLeft,
    y: boxY + 18,
    size: 8.5,
    font: fonts.timesBold,
    color: BRAND_COLORS.navyBlue,
  });

  // 3. Vertical Dividing Line
  const midX = marginX + usableWidth * 0.58;
  page.drawLine({
    start: { x: midX, y: boxY + 10 },
    end: { x: midX, y: boxY + boxHeight - 10 },
    thickness: 0.8,
    color: BRAND_COLORS.borderLight,
  });

  // 4. Right Signatory Block (Universal Official Handwritten Signature)
  const sigBlockX = midX + 28;
  const sigImg = options.signatureImg !== undefined ? options.signatureImg : await loadBrandSignature(pdfDoc);

  if (sigImg) {
    const sigAspect = sigImg.width / sigImg.height;
    const sigHeight = 36;
    const sigWidth = Math.min(sigHeight * sigAspect, 105);
    page.drawImage(sigImg, {
      x: sigBlockX + (105 - sigWidth) / 2,
      y: boxY + boxHeight - 48,
      width: sigWidth,
      height: sigHeight,
    });
  } else {
    page.drawText("Firoz Ali", {
      x: sigBlockX + 16,
      y: boxY + boxHeight - 44,
      size: 18,
      font: fonts.timesItalic,
      color: BRAND_COLORS.navyBlue,
    });
  }

  page.drawText("Firoz Ali", {
    x: sigBlockX + 24,
    y: boxY + boxHeight - 64,
    size: 11,
    font: fonts.timesBold,
    color: BRAND_COLORS.navyBlue,
  });

  page.drawText("Founder & Director", {
    x: sigBlockX + 12,
    y: boxY + boxHeight - 77,
    size: 9,
    font: fonts.timesRoman,
    color: BRAND_COLORS.bodyText,
  });

  // 5. Bottom Institutional Footer (Underneath the box)
  const lineY = boxY - 14;
  page.drawLine({
    start: { x: marginX + 24, y: lineY },
    end: { x: width - marginX - 24, y: lineY },
    thickness: 0.8,
    color: BRAND_COLORS.borderLight,
  });

  const instName = "ATOMIC PATHSHALA EDUCATION";
  const instNameW = fonts.timesBold.widthOfTextAtSize(instName, 11);
  page.drawText(instName, {
    x: (width - instNameW) / 2,
    y: boxY - 29,
    size: 11,
    font: fonts.timesBold,
    color: BRAND_COLORS.navyBlue,
  });

  const webUrl = "ap.atomicpathshala.in";
  const webUrlW = fonts.timesRoman.widthOfTextAtSize(webUrl, 8.5);
  const decoLineW = 42;
  const textY = boxY - 42;
  const decoLineY = boxY - 39;

  page.drawLine({
    start: { x: (width - webUrlW) / 2 - decoLineW - 8, y: decoLineY },
    end: { x: (width - webUrlW) / 2 - 8, y: decoLineY },
    thickness: 0.6,
    color: BRAND_COLORS.accentBlue,
  });

  page.drawText(webUrl, {
    x: (width - webUrlW) / 2,
    y: textY,
    size: 8.5,
    font: fonts.timesRoman,
    color: BRAND_COLORS.navyBlue,
  });

  page.drawLine({
    start: { x: (width + webUrlW) / 2 + 8, y: decoLineY },
    end: { x: (width + webUrlW) / 2 + decoLineW + 8, y: decoLineY },
    thickness: 0.6,
    color: BRAND_COLORS.accentBlue,
  });

  return boxY - 50;

  return boxY;
}
