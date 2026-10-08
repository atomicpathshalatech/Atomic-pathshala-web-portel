import { PDFDocument, rgb, degrees, StandardFonts, PDFPage, PDFFont, Color } from "pdf-lib";

export interface TextEditItem {
  id: string;
  pageNumber: number; // 1-indexed
  x: number; // Points from top-left (UI coords)
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

export interface BackgroundConfig {
  enabled?: boolean;
  color?: string;
  imageUrl?: string;
  base64Data?: string;
  opacity?: number;
  pageRange?: "ALL" | "ODD" | "EVEN" | "CUSTOM";
  customPages?: number[];
}

export interface HeaderFooterConfig {
  enabled?: boolean;
  headerLeft?: string;
  headerCenter?: string;
  headerRight?: string;
  footerLeft?: string;
  footerCenter?: string;
  footerRight?: string;
  headerImageUrl?: string;
  headerImageBase64?: string;
  headerImageHeight?: number;
  headerImagePosition?: "left" | "center" | "right";
  headerTopOffsetPt?: number;
  footerImageUrl?: string;
  footerImageBase64?: string;
  footerImageHeight?: number;
  footerImagePosition?: "left" | "center" | "right";
  footerBottomOffsetPt?: number;
  removeOldHeader?: boolean;
  removeOldFooter?: boolean;
  oldHeaderHeightPt?: number;
  oldFooterHeightPt?: number;
  fontSize?: number;
  accentColor?: string;
  excludeFirstPage?: boolean;
  pageRange?: "ALL" | "ODD" | "EVEN" | "CUSTOM";
  customPages?: number[];
}

export interface WatermarkConfig {
  enabled?: boolean;
  type?: "text" | "image";
  text?: string;
  imageUrl?: string;
  base64Data?: string;
  imageWidth?: number;
  imageHeight?: number;
  position?: "CENTER" | "TOP" | "BOTTOM" | "CUSTOM";
  opacity?: number;
  rotation?: number;
  fontSize?: number;
  color?: string;
  excludeFirstPage?: boolean;
  pageRange?: "ALL" | "ODD" | "EVEN" | "CUSTOM";
  customPages?: number[];
}

export interface CoverPageConfig {
  enabled: boolean;
  action?: "PREPEND" | "REPLACE_FIRST" | "DELETE_FIRST" | "NONE";
  subject: string;
  moduleNumber: string;
  chapter: string;
  teacher?: string;
  batch?: string;
  targetExam?: string;
  academicYear?: string;
}

export interface GlobalRemovalItem {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  pageRange?: "ALL" | "ODD" | "EVEN" | "CUSTOM";
  customPages?: number[];
}

export interface GlobalReplacementItem {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  replacementType: "image" | "text";
  imageUrl?: string;
  base64Data?: string;
  newText?: string;
  fontSize?: number;
  fontFamily?: "helvetica" | "times" | "courier";
  color?: string;
  pageRange?: "ALL" | "ODD" | "EVEN" | "CUSTOM";
  customPages?: number[];
}

export interface NativePdfEditPayload {
  originalPdfBuffer: Buffer | Uint8Array;
  textEdits?: TextEditItem[];
  whiteouts?: WhiteoutItem[];
  images?: ImageEditItem[];
  shapes?: ShapeEditItem[];
  globalRemovals?: GlobalRemovalItem[];
  globalReplacements?: GlobalReplacementItem[];
  background?: BackgroundConfig;
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
  return res.replace(/[^\x20-\x7E]/g, " ");
}

function isPageInRange(
  pageNumber: number,
  range?: "ALL" | "ODD" | "EVEN" | "CUSTOM",
  customPages?: number[],
  excludeFirstPage?: boolean
): boolean {
  if (excludeFirstPage && pageNumber === 1) return false;
  if (!range || range === "ALL") return true;
  if (range === "ODD") return pageNumber % 2 !== 0;
  if (range === "EVEN") return pageNumber % 2 === 0;
  if (range === "CUSTOM") {
    return Array.isArray(customPages) && customPages.includes(pageNumber);
  }
  return true;
}

async function embedImageBuffer(doc: PDFDocument, base64OrUrl: string): Promise<any> {
  if (base64OrUrl.startsWith("data:image/") || base64OrUrl.includes(";base64,")) {
    const isPng = base64OrUrl.includes("image/png");
    const clean = base64OrUrl.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
    const buf = Buffer.from(clean, "base64");
    return isPng ? await doc.embedPng(buf) : await doc.embedJpg(buf);
  } else if (base64OrUrl.startsWith("http://") || base64OrUrl.startsWith("https://")) {
    const res = await fetch(base64OrUrl);
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    const isPng = base64OrUrl.toLowerCase().endsWith(".png");
    return isPng ? await doc.embedPng(buf) : await doc.embedJpg(buf);
  }
  return null;
}

/**
 * Advanced Foxit-Style Native PDF Editing Engine for Atomic Pathshala.
 * Modifies existing PDF objects directly, supporting in-place text edits,
 * global object removal/replacement across all pages, image headers/footers,
 * watermarks, backgrounds, and front page replacement.
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
    globalRemovals = [],
    globalReplacements = [],
    background,
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
    if (family === "times") return isBold ? timesBold : timesFont;
    if (family === "courier") return courierFont;
    if (isBold && isItalic) return helveticaBoldItalic;
    if (isBold) return helveticaBold;
    if (isItalic) return helveticaItalic;
    return helveticaFont;
  };

  // 1. Handle Front Page Actions (Replace First / Delete First) & Deletions
  const originalPageCount = pdfDoc.getPageCount();
  const deletedSet = new Set(deletedPages);

  if (coverPage?.action === "REPLACE_FIRST" || coverPage?.action === "DELETE_FIRST") {
    deletedSet.add(1);
  }

  // Pre-embed Header/Footer/Watermark images if provided
  let headerImgEmbed: any = null;
  if (headerFooter?.headerImageBase64 || headerFooter?.headerImageUrl) {
    try {
      headerImgEmbed = await embedImageBuffer(
        pdfDoc,
        (headerFooter.headerImageBase64 || headerFooter.headerImageUrl)!
      );
    } catch (err) {
      console.warn("[processNativePdfEdits] Header image embed failed:", err);
    }
  }

  let footerImgEmbed: any = null;
  if (headerFooter?.footerImageBase64 || headerFooter?.footerImageUrl) {
    try {
      footerImgEmbed = await embedImageBuffer(
        pdfDoc,
        (headerFooter.footerImageBase64 || headerFooter.footerImageUrl)!
      );
    } catch (err) {
      console.warn("[processNativePdfEdits] Footer image embed failed:", err);
    }
  }

  let watermarkImgEmbed: any = null;
  if (watermark?.type === "image" && (watermark.base64Data || watermark.imageUrl)) {
    try {
      watermarkImgEmbed = await embedImageBuffer(
        pdfDoc,
        (watermark.base64Data || watermark.imageUrl)!
      );
    } catch (err) {
      console.warn("[processNativePdfEdits] Watermark image embed failed:", err);
    }
  }

  let bgImgEmbed: any = null;
  if (background?.enabled && (background.base64Data || background.imageUrl)) {
    try {
      bgImgEmbed = await embedImageBuffer(
        pdfDoc,
        (background.base64Data || background.imageUrl)!
      );
    } catch (err) {
      console.warn("[processNativePdfEdits] Background image embed failed:", err);
    }
  }

  // Handle Page Reordering / Deletions
  if (pageOrder && pageOrder.length > 0) {
    const finalDoc = await PDFDocument.create();
    for (const pNum of pageOrder) {
      if (pNum >= 1 && pNum <= originalPageCount && !deletedSet.has(pNum)) {
        const [copiedPage] = await finalDoc.copyPages(pdfDoc, [pNum - 1]);
        finalDoc.addPage(copiedPage);
      }
    }
    return continueProcessing(finalDoc);
  } else if (deletedSet.size > 0) {
    const sortedDeletes = Array.from(deletedSet).sort((a, b) => b - a);
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

      // 0. Apply Background Color / Image
      if (background?.enabled && isPageInRange(pageNum, background.pageRange, background.customPages)) {
        if (background.color) {
          page.drawRectangle({
            x: 0,
            y: 0,
            width,
            height,
            color: hexToRgb(background.color),
            opacity: background.opacity ?? 1,
          });
        }
        if (bgImgEmbed) {
          page.drawImage(bgImgEmbed, {
            x: 0,
            y: 0,
            width,
            height,
            opacity: background.opacity ?? 0.15,
          });
        }
      }

      // A. Old Header / Footer Masking
      if (headerFooter?.removeOldHeader && isPageInRange(pageNum, headerFooter.pageRange, headerFooter.customPages, headerFooter.excludeFirstPage)) {
        const hHeight = headerFooter.oldHeaderHeightPt || 42;
        page.drawRectangle({
          x: 0,
          y: height - hHeight,
          width,
          height: hHeight,
          color: rgb(1, 1, 1),
        });
      }

      if (headerFooter?.removeOldFooter && isPageInRange(pageNum, headerFooter.pageRange, headerFooter.customPages, headerFooter.excludeFirstPage)) {
        const fHeight = headerFooter.oldFooterHeightPt || 32;
        page.drawRectangle({
          x: 0,
          y: 0,
          width,
          height: fHeight,
          color: rgb(1, 1, 1),
        });
      }

      // B. Apply Global Object Removals (e.g. Logo removed across entire PDF)
      for (const removal of globalRemovals) {
        if (isPageInRange(pageNum, removal.pageRange, removal.customPages)) {
          const pdfY = height - removal.y - removal.height;
          page.drawRectangle({
            x: removal.x,
            y: Math.max(0, pdfY),
            width: removal.width,
            height: removal.height,
            color: removal.color ? hexToRgb(removal.color) : rgb(1, 1, 1),
          });
        }
      }

      // C. Apply Global Object Replacements (e.g. Old logo replaced with new logo across all pages)
      for (const rep of globalReplacements) {
        if (isPageInRange(pageNum, rep.pageRange, rep.customPages)) {
          const pdfY = height - rep.y - rep.height;
          // Mask underlying region first
          page.drawRectangle({
            x: rep.x,
            y: Math.max(0, pdfY),
            width: rep.width,
            height: rep.height,
            color: rgb(1, 1, 1),
          });

          if (rep.replacementType === "image" && (rep.base64Data || rep.imageUrl)) {
            try {
              const repImg = await embedImageBuffer(doc, (rep.base64Data || rep.imageUrl)!);
              if (repImg) {
                page.drawImage(repImg, {
                  x: rep.x,
                  y: Math.max(0, pdfY),
                  width: rep.width,
                  height: rep.height,
                });
              }
            } catch (err) {
              console.warn("[processNativePdfEdits] Global replacement image failed:", err);
            }
          } else if (rep.replacementType === "text" && rep.newText) {
            const font = getFont(rep.fontFamily, false, false);
            const fontSize = Math.max(6, rep.fontSize || 11);
            page.drawText(rep.newText.replace(/[^\x20-\x7E]/g, " "), {
              x: rep.x,
              y: Math.max(4, pdfY + rep.height - fontSize),
              size: fontSize,
              font,
              color: rep.color ? hexToRgb(rep.color) : rgb(0.1, 0.1, 0.1),
            });
          }
        }
      }

      // D. Apply Page-Specific Whiteouts / Redactions
      const pageWhiteouts = whiteouts.filter((w) => w.pageNumber === pageNum);
      for (const w of pageWhiteouts) {
        const rectColor = w.color ? hexToRgb(w.color) : rgb(1, 1, 1);
        const pdfY = height - w.y - w.height;
        page.drawRectangle({
          x: w.x,
          y: Math.max(0, pdfY),
          width: w.width,
          height: w.height,
          color: rectColor,
        });
      }

      // E. Apply In-Place Text Edits (with whiteout mask + replacement text)
      const pageTextEdits = textEdits.filter((t) => t.pageNumber === pageNum);
      for (const t of pageTextEdits) {
        const pdfY = height - t.y - t.height;

        // Mask original text area
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

      // F. Apply Inserted Images
      const pageImages = images.filter((img) => img.pageNumber === pageNum);
      for (const img of pageImages) {
        try {
          const embeddedImg = await embedImageBuffer(doc, (img.base64Data || img.imageUrl)!);
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

      // G. Apply Shapes & Highlights
      const pageShapes = shapes.filter((s) => s.pageNumber === pageNum);
      for (const s of pageShapes) {
        const pdfY = height - s.y - s.height;
        const strokeColor = s.strokeColor ? hexToRgb(s.strokeColor) : undefined;
        const fillColor = s.fillColor ? hexToRgb(s.fillColor) : undefined;

        if (s.type === "highlight") {
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

      // H. Running Header & Footer
      if (headerFooter?.enabled && isPageInRange(pageNum, headerFooter.pageRange, headerFooter.customPages, headerFooter.excludeFirstPage)) {
        const topOffset = headerFooter.headerTopOffsetPt || 0;
        const hHeight = headerFooter.headerImageHeight || 28;
        const bannerY = height - hHeight - topOffset;
        const accentCol = headerFooter.accentColor ? hexToRgb(headerFooter.accentColor) : rgb(0.917, 0.345, 0.047);
        const navyText = rgb(0.06, 0.09, 0.16);
        const slateText = rgb(0.4, 0.45, 0.52);

        // Header Background Banner & Accent Line
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

        // If Image Header is configured
        if (headerImgEmbed) {
          const imgH = hHeight - 6;
          const imgW = (headerImgEmbed.width / headerImgEmbed.height) * imgH;
          let imgX = 24;
          if (headerFooter.headerImagePosition === "center") imgX = (width - imgW) / 2;
          if (headerFooter.headerImagePosition === "right") imgX = width - imgW - 24;

          page.drawImage(headerImgEmbed, {
            x: imgX,
            y: bannerY + 3,
            width: imgW,
            height: imgH,
          });
        }

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

        if (!headerImgEmbed || headerFooter.headerImagePosition !== "left") {
          page.drawText(leftH, { x: 24, y: bannerY + 9, size: 9, font: helveticaBold, color: accentCol });
        }
        if (!headerImgEmbed || headerFooter.headerImagePosition !== "center") {
          page.drawText(centerH, { x: 140, y: bannerY + 9, size: 8, font: helveticaFont, color: navyText });
        }

        const rightW = helveticaFont.widthOfTextAtSize(rightH, 8);
        if (width - rightW - 24 > 280 && (!headerImgEmbed || headerFooter.headerImagePosition !== "right")) {
          page.drawText(rightH, { x: width - rightW - 24, y: bannerY + 9, size: 8, font: helveticaFont, color: slateText });
        }

        // Running Footer
        const bottomOffset = headerFooter.footerBottomOffsetPt || 0;
        const footerH = headerFooter.footerImageHeight || 22;
        const footerY = bottomOffset;

        page.drawRectangle({
          x: 20,
          y: footerY + footerH,
          width: width - 40,
          height: 0.5,
          color: rgb(0.88, 0.9, 0.94),
        });

        // If Image Footer is configured
        if (footerImgEmbed) {
          const imgH = footerH - 4;
          const imgW = (footerImgEmbed.width / footerImgEmbed.height) * imgH;
          let imgX = (width - imgW) / 2;
          if (headerFooter.footerImagePosition === "left") imgX = 24;
          if (headerFooter.footerImagePosition === "right") imgX = width - imgW - 24;

          page.drawImage(footerImgEmbed, {
            x: imgX,
            y: footerY + 3,
            width: imgW,
            height: imgH,
          });
        }

        const leftF = replaceVariables(headerFooter.footerLeft || "Atomic Pathshala | India's Leading NEET Accelerator", vars);
        const rightF = replaceVariables(headerFooter.footerRight || "Page {page} of {totalPages}", vars);

        if (!footerImgEmbed || headerFooter.footerImagePosition !== "left") {
          page.drawText(leftF, { x: 24, y: footerY + 7, size: 7.5, font: helveticaFont, color: slateText });
        }
        const pgW = helveticaBold.widthOfTextAtSize(rightF, 8);
        if (!footerImgEmbed || headerFooter.footerImagePosition !== "right") {
          page.drawText(rightF, { x: width - pgW - 24, y: footerY + 7, size: 8, font: helveticaBold, color: accentCol });
        }
      }

      // I. Watermark Overlay (Text or Image)
      if (watermark?.enabled && isPageInRange(pageNum, watermark.pageRange, watermark.customPages, watermark.excludeFirstPage)) {
        if (watermark.type === "image" && watermarkImgEmbed) {
          const wmWidth = watermark.imageWidth || width * 0.5;
          const wmHeight = watermark.imageHeight || (watermarkImgEmbed.height / watermarkImgEmbed.width) * wmWidth;
          let wmX = (width - wmWidth) / 2;
          let wmY = (height - wmHeight) / 2;

          if (watermark.position === "TOP") wmY = height - wmHeight - 60;
          if (watermark.position === "BOTTOM") wmY = 60;

          page.drawImage(watermarkImgEmbed, {
            x: wmX,
            y: wmY,
            width: wmWidth,
            height: wmHeight,
            opacity: watermark.opacity ?? 0.08,
            rotate: degrees(watermark.rotation ?? 0),
          });
        } else if (watermark.text) {
          const wmClean = watermark.text.replace(/[^\x20-\x7E]/g, " ");
          const wmSize = watermark.fontSize || Math.min(width, height) * 0.08;
          const textWidth = helveticaBold.widthOfTextAtSize(wmClean, wmSize);
          let wmX = width / 2 - textWidth / 2;
          let wmY = height / 2;

          if (watermark.position === "TOP") wmY = height - 120;
          if (watermark.position === "BOTTOM") wmY = 120;

          page.drawText(wmClean, {
            x: wmX,
            y: wmY,
            size: wmSize,
            font: helveticaBold,
            color: watermark.color ? hexToRgb(watermark.color) : rgb(0.917, 0.345, 0.047),
            opacity: watermark.opacity ?? 0.05,
            rotate: degrees(watermark.rotation ?? 35),
          });
        }
      }
    }

    // 2. Prepend Atomic Pathshala Front Cover Page if enabled
    if (coverPage?.enabled && (coverPage.action === "PREPEND" || coverPage.action === "REPLACE_FIRST" || !coverPage.action)) {
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
