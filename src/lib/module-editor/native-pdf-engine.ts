import { PDFDocument, rgb, degrees, StandardFonts, PDFPage, PDFFont, Color } from "pdf-lib";

export interface TextEditItem {
  id: string;
  pageNumber: number; // 1-indexed
  x: number; // PDF points from bottom-left (or top-left normalized)
  y: number;
  width: number;
  height: number;
  originalText?: string;
  newText: string;
  fontSize: number;
  fontFamily?: "helvetica" | "times" | "courier";
  color?: string; // hex #000000
  isBold?: boolean;
  isItalic?: boolean;
  align?: "left" | "center" | "right";
  lineHeight?: number;
  hideOriginal?: boolean; // Draws whiteout under original text
  backgroundColor?: string;
}

export interface WhiteoutItem {
  id: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string; // default #ffffff
}

export interface ImageEditItem {
  id: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  imageUrl?: string;
  base64Data?: string; // data:image/png;base64,...
  opacity?: number;
  rotation?: number;
}

export interface ShapeEditItem {
  id: string;
  pageNumber: number;
  type: "rect" | "circle" | "line" | "highlight";
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
  opacity?: number;
}

export interface HeaderFooterConfig {
  enabled?: boolean;
  headerLeft?: string;
  headerCenter?: string;
  headerRight?: string;
  footerLeft?: string;
  footerCenter?: string;
  footerRight?: string;
  removeOldHeader?: boolean;
  removeOldFooter?: boolean;
  oldHeaderHeightPt?: number;
  oldFooterHeightPt?: number;
  fontSize?: number;
  accentColor?: string;
  showOnCover?: boolean;
}

export interface WatermarkConfig {
  enabled?: boolean;
  text?: string;
  opacity?: number;
  rotation?: number;
  fontSize?: number;
  color?: string;
}

export interface CoverPageConfig {
  enabled: boolean;
  subject: string;
  moduleNumber: string;
  chapter: string;
  teacher?: string;
  batch?: string;
  targetExam?: string;
  academicYear?: string;
}

export interface NativePdfEditPayload {
  originalPdfBuffer: Buffer | Uint8Array;
  textEdits?: TextEditItem[];
  whiteouts?: WhiteoutItem[];
  images?: ImageEditItem[];
  shapes?: ShapeEditItem[];
  pageRotations?: Record<number, number>; // pageNumber -> degrees (0, 90, 180, 270)
  deletedPages?: number[]; // list of 1-indexed page numbers to delete
  pageOrder?: number[]; // new 1-indexed page order [1, 3, 2, 4]
  headerFooter?: HeaderFooterConfig;
  watermark?: WatermarkConfig;
  coverPage?: CoverPageConfig;
}

export interface NativePdfEditResult {
  pdfBytes: Uint8Array;
  pageCount: number;
  fileSizeBytes: number;
  processedAt: string;
}

function hexToRgb(hex?: string): Color {
  if (!hex || typeof hex !== "string") return rgb(0, 0, 0);
  const clean = hex.replace("#", "");
  if (clean.length === 3) {
    const r = parseInt(clean.charAt(0) + clean.charAt(0), 16) / 255;
    const g = parseInt(clean.charAt(1) + clean.charAt(1), 16) / 255;
    const b = parseInt(clean.charAt(2) + clean.charAt(2), 16) / 255;
    return rgb(r, g, b);
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16) / 255;
    const g = parseInt(clean.slice(2, 4), 16) / 255;
    const b = parseInt(clean.slice(4, 6), 16) / 255;
    return rgb(r, g, b);
  }
  return rgb(0, 0, 0);
}

function replaceVariables(
  template: string,
  vars: {
    page: number;
    totalPages: number;
    subject: string;
    chapter: string;
    teacher: string;
    date: string;
    moduleNumber: string;
  }
): string {
  let res = template;
  res = res.replace(/\{page\}/gi, String(vars.page));
  res = res.replace(/\{totalPages\}/gi, String(vars.totalPages));
  res = res.replace(/\{subject\}/gi, vars.subject);
  res = res.replace(/\{chapter\}/gi, vars.chapter);
  res = res.replace(/\{teacher\}/gi, vars.teacher);
  res = res.replace(/\{date\}/gi, vars.date);
  res = res.replace(/\{moduleNumber\}/gi, vars.moduleNumber);
  // Clean non-WinAnsi characters to prevent PDF font crashes
  return res.replace(/[^\x20-\x7E]/g, " ");
}

/**
 * High-Performance Native PDF Editing Engine for Atomic Pathshala.
 * Modifies existing PDF objects directly without destructively flattening to images.
 */
export async function processNativePdfEdits(
  payload: NativePdfEditPayload
): Promise<NativePdfEditResult> {
  const {
    originalPdfBuffer,
    textEdits = [],
    whiteouts = [],
    images = [],
    shapes = [],
    pageRotations = {},
    deletedPages = [],
    pageOrder,
    headerFooter,
    watermark,
    coverPage,
  } = payload;

  const pdfDoc = await PDFDocument.load(originalPdfBuffer);

  // Embed standard typography fonts
  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helveticaItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const helveticaBoldItalic = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);
  const timesFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const courierFont = await pdfDoc.embedFont(StandardFonts.Courier);

  const getFont = (family?: string, isBold?: boolean, isItalic?: boolean): PDFFont => {
    if (family === "times") {
      return isBold ? timesBold : timesFont;
    }
    if (family === "courier") {
      return courierFont;
    }
    if (isBold && isItalic) return helveticaBoldItalic;
    if (isBold) return helveticaBold;
    if (isItalic) return helveticaItalic;
    return helveticaFont;
  };

  // 1. Handle Page Reordering / Deletions
  const originalPageCount = pdfDoc.getPageCount();
  const deletedSet = new Set(deletedPages);

  // If custom page order is specified, reconstruct pages in order
  if (pageOrder && pageOrder.length > 0) {
    const finalDoc = await PDFDocument.create();
    for (const pNum of pageOrder) {
      if (pNum >= 1 && pNum <= originalPageCount && !deletedSet.has(pNum)) {
        const [copiedPage] = await finalDoc.copyPages(pdfDoc, [pNum - 1]);
        finalDoc.addPage(copiedPage);
      }
    }
    // Continue operations on finalDoc
    return continueProcessing(finalDoc);
  } else if (deletedPages.length > 0) {
    // Delete in descending order so indices remain stable
    const sortedDeletes = [...deletedPages].sort((a, b) => b - a);
    for (const pNum of sortedDeletes) {
      if (pNum >= 1 && pNum <= pdfDoc.getPageCount()) {
        pdfDoc.removePage(pNum - 1);
      }
    }
  }

  return continueProcessing(pdfDoc);

  async function continueProcessing(doc: PDFDocument): Promise<NativePdfEditResult> {
    const pages = doc.getPages();
    const currentTotalPages = pages.length;

    // Apply Page Rotations
    for (const [pNumStr, rotDeg] of Object.entries(pageRotations)) {
      const pNum = Number(pNumStr);
      if (pNum >= 1 && pNum <= pages.length) {
        const page = pages[pNum - 1]!;
        page.setRotation(degrees(rotDeg));
      }
    }

    // Process each page
    for (let pIdx = 0; pIdx < pages.length; pIdx++) {
      const pageNum = pIdx + 1;
      const page = pages[pIdx]!;
      const { width, height } = page.getSize();

      // A. Old Header / Footer Masking
      if (headerFooter?.removeOldHeader) {
        const hHeight = headerFooter.oldHeaderHeightPt || 42;
        page.drawRectangle({
          x: 0,
          y: height - hHeight,
          width,
          height: hHeight,
          color: rgb(1, 1, 1),
        });
      }

      if (headerFooter?.removeOldFooter) {
        const fHeight = headerFooter.oldFooterHeightPt || 32;
        page.drawRectangle({
          x: 0,
          y: 0,
          width,
          height: fHeight,
          color: rgb(1, 1, 1),
        });
      }

      // B. Apply Whiteouts / Redactions (Solid vector rectangles)
      const pageWhiteouts = whiteouts.filter((w) => w.pageNumber === pageNum);
      for (const w of pageWhiteouts) {
        const rectColor = w.color ? hexToRgb(w.color) : rgb(1, 1, 1);
        // Normalize coordinates: UI top-left to PDF bottom-left
        const pdfY = height - w.y - w.height;
        page.drawRectangle({
          x: w.x,
          y: Math.max(0, pdfY),
          width: w.width,
          height: w.height,
          color: rectColor,
        });
      }

      // C. Apply Text Edits (with whiteout mask underneath + new text draw)
      const pageTextEdits = textEdits.filter((t) => t.pageNumber === pageNum);
      for (const t of pageTextEdits) {
        const pdfY = height - t.y - t.height;

        // Mask original text area if requested
        if (t.hideOriginal !== false) {
          page.drawRectangle({
            x: t.x - 2,
            y: Math.max(0, pdfY - 2),
            width: t.width + 4,
            height: t.height + 4,
            color: t.backgroundColor ? hexToRgb(t.backgroundColor) : rgb(1, 1, 1),
          });
        }

        // Draw new text lines
        if (t.newText && t.newText.trim().length > 0) {
          const font = getFont(t.fontFamily, t.isBold, t.isItalic);
          const textColor = t.color ? hexToRgb(t.color) : rgb(0.1, 0.1, 0.1);
          const fontSize = Math.max(6, t.fontSize || 10);
          const cleanText = t.newText.replace(/[^\x20-\x7E\n]/g, " ");

          const lines = cleanText.split("\n");
          let lineY = pdfY + t.height - fontSize;

          for (const line of lines) {
            let lineX = t.x;
            if (t.align === "center") {
              const textWidth = font.widthOfTextAtSize(line, fontSize);
              lineX = t.x + Math.max(0, (t.width - textWidth) / 2);
            } else if (t.align === "right") {
              const textWidth = font.widthOfTextAtSize(line, fontSize);
              lineX = t.x + Math.max(0, t.width - textWidth);
            }

            page.drawText(line, {
              x: lineX,
              y: Math.max(4, lineY),
              size: fontSize,
              font,
              color: textColor,
            });

            lineY -= fontSize * (t.lineHeight || 1.25);
          }
        }
      }

      // D. Apply Inserted Images
      const pageImages = images.filter((img) => img.pageNumber === pageNum);
      for (const img of pageImages) {
        try {
          let embeddedImg: any = null;
          if (img.base64Data) {
            const base64Clean = img.base64Data.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
            const imgBuffer = Buffer.from(base64Clean, "base64");
            if (img.base64Data.includes("image/png") || img.base64Data.startsWith("data:image/png")) {
              embeddedImg = await doc.embedPng(imgBuffer);
            } else {
              embeddedImg = await doc.embedJpg(imgBuffer);
            }
          } else if (img.imageUrl) {
            const fetchRes = await fetch(img.imageUrl);
            if (fetchRes.ok) {
              const buf = Buffer.from(await fetchRes.arrayBuffer());
              embeddedImg = img.imageUrl.endsWith(".png")
                ? await doc.embedPng(buf)
                : await doc.embedJpg(buf);
            }
          }

          if (embeddedImg) {
            const pdfY = height - img.y - img.height;
            page.drawImage(embeddedImg, {
              x: img.x,
              y: Math.max(0, pdfY),
              width: img.width,
              height: img.height,
              opacity: img.opacity ?? 1,
              rotate: degrees(img.rotation ?? 0),
            });
          }
        } catch (imgErr) {
          console.warn("[processNativePdfEdits] Failed to embed image on page:", pageNum, imgErr);
        }
      }

      // E. Apply Shapes & Highlights
      const pageShapes = shapes.filter((s) => s.pageNumber === pageNum);
      for (const s of pageShapes) {
        const pdfY = height - s.y - s.height;
        const strokeColor = s.strokeColor ? hexToRgb(s.strokeColor) : undefined;
        const fillColor = s.fillColor ? hexToRgb(s.fillColor) : undefined;

        if (s.type === "highlight") {
          // Semi-transparent yellow or custom highlight
          page.drawRectangle({
            x: s.x,
            y: Math.max(0, pdfY),
            width: s.width,
            height: s.height,
            color: s.fillColor ? hexToRgb(s.fillColor) : rgb(1, 0.95, 0.2),
            opacity: s.opacity ?? 0.35,
          });
        } else if (s.type === "rect") {
          page.drawRectangle({
            x: s.x,
            y: Math.max(0, pdfY),
            width: s.width,
            height: s.height,
            borderColor: strokeColor,
            borderWidth: s.strokeWidth || 1.5,
            color: fillColor,
            opacity: s.opacity ?? 1,
          });
        } else if (s.type === "circle") {
          const radius = Math.min(s.width, s.height) / 2;
          page.drawCircle({
            x: s.x + radius,
            y: Math.max(0, pdfY + radius),
            size: radius,
            borderColor: strokeColor,
            borderWidth: s.strokeWidth || 1.5,
            color: fillColor,
            opacity: s.opacity ?? 1,
          });
        } else if (s.type === "line") {
          page.drawLine({
            start: { x: s.x, y: pdfY + s.height },
            end: { x: s.x + s.width, y: pdfY },
            thickness: s.strokeWidth || 1.5,
            color: strokeColor || rgb(0, 0, 0),
            opacity: s.opacity ?? 1,
          });
        }
      }

      // F. Running Header & Footer
      if (headerFooter?.enabled) {
        const hHeight = 28;
        const bannerY = height - hHeight;
        const accentCol = headerFooter.accentColor ? hexToRgb(headerFooter.accentColor) : rgb(0.917, 0.345, 0.047);
        const navyText = rgb(0.06, 0.09, 0.16);
        const slateText = rgb(0.4, 0.45, 0.52);

        // Draw header background banner
        page.drawRectangle({
          x: 0,
          y: bannerY,
          width,
          height: hHeight,
          color: rgb(0.98, 0.99, 1),
        });
        page.drawRectangle({
          x: 0,
          y: bannerY,
          width,
          height: 1.5,
          color: accentCol,
        });

        const vars = {
          page: pageNum,
          totalPages: currentTotalPages,
          subject: coverPage?.subject || "NEET PREPARATION",
          chapter: coverPage?.chapter || "Academic Chapter",
          teacher: coverPage?.teacher || "Atomic Pathshala Faculty",
          date: new Date().toLocaleDateString("en-IN"),
          moduleNumber: coverPage?.moduleNumber || "Module 01",
        };

        const leftH = replaceVariables(headerFooter.headerLeft || "ATOMIC PATHSHALA", vars);
        const centerH = replaceVariables(headerFooter.headerCenter || "| {subject} - {chapter}", vars);
        const rightH = replaceVariables(headerFooter.headerRight || "{teacher}", vars);

        page.drawText(leftH, { x: 24, y: bannerY + 9, size: 9, font: helveticaBold, color: accentCol });
        page.drawText(centerH, { x: 135, y: bannerY + 9, size: 8, font: helveticaFont, color: navyText });

        const rightW = helveticaFont.widthOfTextAtSize(rightH, 8);
        if (width - rightW - 24 > 280) {
          page.drawText(rightH, { x: width - rightW - 24, y: bannerY + 9, size: 8, font: helveticaFont, color: slateText });
        }

        // Running Footer
        const footerH = 22;
        page.drawRectangle({
          x: 20,
          y: footerH,
          width: width - 40,
          height: 0.5,
          color: rgb(0.88, 0.9, 0.94),
        });

        const leftF = replaceVariables(headerFooter.footerLeft || "Atomic Pathshala | India's Leading NEET Accelerator", vars);
        const rightF = replaceVariables(headerFooter.footerRight || "Page {page} of {totalPages}", vars);

        page.drawText(leftF, { x: 24, y: 7, size: 7.5, font: helveticaFont, color: slateText });
        const pgW = helveticaBold.widthOfTextAtSize(rightF, 8);
        page.drawText(rightF, { x: width - pgW - 24, y: 7, size: 8, font: helveticaBold, color: accentCol });
      }

      // G. Watermark Overlay
      if (watermark?.enabled && watermark.text) {
        const wmClean = watermark.text.replace(/[^\x20-\x7E]/g, " ");
        const wmSize = watermark.fontSize || Math.min(width, height) * 0.08;
        const textWidth = helveticaBold.widthOfTextAtSize(wmClean, wmSize);
        page.drawText(wmClean, {
          x: width / 2 - textWidth / 2,
          y: height / 2,
          size: wmSize,
          font: helveticaBold,
          color: watermark.color ? hexToRgb(watermark.color) : rgb(0.917, 0.345, 0.047),
          opacity: watermark.opacity ?? 0.05,
          rotate: degrees(watermark.rotation ?? 35),
        });
      }
    }

    // 2. Prepend Cover Page if enabled
    if (coverPage?.enabled) {
      const cover = doc.insertPage(0, [595.28, 841.89]);
      const { width, height } = cover.getSize();

      let subjectColor = rgb(0.043, 0.478, 0.263); // Default Chemistry Green
      const subjUpper = (coverPage.subject || "").toUpperCase();
      if (subjUpper.includes("PHYS")) {
        subjectColor = rgb(0.082, 0.396, 0.753); // Physics Blue
      } else if (subjUpper.includes("BIO")) {
        subjectColor = rgb(0.486, 0.227, 0.929); // Biology Purple
      }

      const orange = rgb(0.917, 0.345, 0.047);
      const darkNavy = rgb(0.06, 0.09, 0.16);
      const slate = rgb(0.38, 0.44, 0.52);
      const white = rgb(1, 1, 1);

      // Top Logo Bar
      cover.drawText("ATOMIC", { x: 48, y: height - 55, size: 18, font: helveticaBold, color: orange });
      cover.drawText("PATHSHALA", { x: 125, y: height - 55, size: 18, font: helveticaBold, color: darkNavy });
      cover.drawText("LEARN - EXPLORE - EXCEL", { x: 48, y: height - 68, size: 8, font: helveticaBold, color: slate });

      // NEET Mastery Stack
      cover.drawText("NEET", { x: width - 110, y: height - 48, size: 9, font: helveticaBold, color: darkNavy });
      cover.drawText("FOUNDATION", { x: width - 110, y: height - 58, size: 8, font: helveticaBold, color: darkNavy });
      cover.drawText("PRACTICE", { x: width - 110, y: height - 68, size: 8, font: helveticaBold, color: darkNavy });
      cover.drawText("MASTERY", { x: width - 110, y: height - 78, size: 8, font: helveticaBold, color: darkNavy });

      // Subject Title
      const cleanSubj = (coverPage.subject || "CHEMISTRY").replace(/[^\x20-\x7E]/g, " ");
      cover.drawText(cleanSubj.toUpperCase(), { x: 48, y: height - 260, size: 32, font: helveticaBold, color: subjectColor });

      // Module Pill
      cover.drawText("MODULE -", { x: 48, y: height - 300, size: 16, font: helveticaBold, color: darkNavy });
      cover.drawRectangle({ x: 135, y: height - 306, width: 42, height: 22, color: subjectColor });
      const modNum = (coverPage.moduleNumber || "01").replace(/[^0-9]/g, "").padStart(2, "0") || "01";
      cover.drawText(modNum, { x: 147, y: height - 300, size: 13, font: helveticaBold, color: white });

      // Chapter Title
      cover.drawText("- CHAPTER -", { x: 48, y: height - 335, size: 10, font: helveticaBold, color: slate });
      const cleanChapter = (coverPage.chapter || "Academic Chapter").replace(/[^\x20-\x7E]/g, " ").toUpperCase();
      cover.drawText(cleanChapter, { x: 48, y: height - 365, size: 20, font: helveticaBold, color: darkNavy });

      const cleanExam = (coverPage.targetExam || "NEET (UG)").replace(/[^\x20-\x7E]/g, " ");
      cover.drawText(cleanExam, { x: 48, y: height - 395, size: 12, font: helveticaBold, color: slate });

      // Features Checklist with clean vector checkmarks
      const features = [
        "Theory & Core Concepts",
        "Illustrations & Worked Examples",
        "Practice Questions & Problem Solving",
        "Levelwise Mastery Exercises",
        "PYQs with Step-by-Step Solutions",
      ];

      let featY = height - 440;
      features.forEach((feat) => {
        cover.drawRectangle({ x: 48, y: featY - 2, width: 14, height: 14, color: subjectColor });
        cover.drawLine({ start: { x: 51, y: featY + 4 }, end: { x: 54, y: featY + 1 }, thickness: 1.5, color: white });
        cover.drawLine({ start: { x: 54, y: featY + 1 }, end: { x: 59, y: featY + 8 }, thickness: 1.5, color: white });
        cover.drawText(feat, { x: 72, y: featY + 1, size: 11, font: helveticaBold, color: darkNavy });
        featY -= 26;
      });

      // Bottom Guidance & NCERT Bar
      cover.drawRectangle({ x: 48, y: 48, width: width - 96, height: 1, color: rgb(0.88, 0.9, 0.94) });
      const cleanTeacher = (coverPage.teacher || "Firoz Sir").replace(/[^\x20-\x7E]/g, " ");
      cover.drawText(`Academic Guidance: ${cleanTeacher}`, { x: 48, y: 32, size: 9.5, font: helveticaBold, color: darkNavy });
      const alignText = "100% NCERT ALIGNED - PRINT READY";
      const alignW = helveticaBold.widthOfTextAtSize(alignText, 9.5);
      cover.drawText(alignText, { x: width - 48 - alignW, y: 32, size: 9.5, font: helveticaBold, color: subjectColor });
    }

    const pdfBytes = await doc.save();
    return {
      pdfBytes,
      pageCount: doc.getPageCount(),
      fileSizeBytes: pdfBytes.length,
      processedAt: new Date().toISOString(),
    };
  }
}
