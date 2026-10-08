import {
  PDFDocument,
  rgb,
  degrees,
  StandardFonts,
  PDFPage,
  PDFFont,
  Color,
} from "pdf-lib";
import {
  ModuleEditorState,
  ModuleEditorObject,
  TextObject,
  ImageObject,
  ShapeObject,
  RedactionObject,
  ModuleVariables,
  VisualLayer,
  ModuleTheme,
} from "./types";
import { CoordinateEngine, DEFAULT_PAGE_SIZE } from "./coordinate-engine";
import { ThemeEngine, SUBJECT_THEMES } from "./theme-engine";
import { LayerEngine } from "./layer-engine";
import { PreviewRenderer } from "./preview-renderer";

// -------------------------------------------------------------
// Compatibility Interfaces for FoxitModuleEditor & save-native API
// -------------------------------------------------------------
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
  base64Data?: string;
  opacity?: number;
  rotation?: number;
}

export interface ShapeEditItem {
  id: string;
  pageNumber: number;
  type: "rect" | "circle" | "line" | "highlight" | "callout" | "divider";
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor?: string;
  fillColor?: string;
  strokeWidth?: number;
  opacity?: number;
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
  scale?: number;
  position?: "CENTER" | "TOP" | "BOTTOM" | "CUSTOM";
  customX?: number;
  customY?: number;
  layer?: "BEHIND_CONTENT" | "ABOVE_CONTENT";
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

export interface NativePdfEditPayload {
  originalPdfBuffer: Buffer | Uint8Array;
  textEdits?: TextEditItem[];
  whiteouts?: WhiteoutItem[];
  images?: ImageEditItem[];
  shapes?: ShapeEditItem[];
  globalRemovals?: GlobalRemovalItem[];
  globalReplacements?: GlobalReplacementItem[];
  background?: BackgroundConfig;
  pageRotations?: Record<number, number>;
  deletedPages?: number[];
  pageOrder?: number[];
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

export interface PdfExportOptions {
  state: ModuleEditorState;
  pdfBuffer?: Buffer | Uint8Array;
}

export interface PdfExportResult {
  pdfBytes: Uint8Array;
  pageCount: number;
  fileSizeBytes: number;
  exportedAt: string;
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

async function embedImageBuffer(doc: PDFDocument, base64OrUrl: string): Promise<any> {
  if (!base64OrUrl) return null;
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
    targetExam?: string;
  }
): string {
  if (!template) return "";
  let res = template;
  res = res.replace(/\{page\}/gi, String(vars.page));
  res = res.replace(/\{totalPages\}/gi, String(vars.totalPages));
  res = res.replace(/\{subject\}/gi, vars.subject || "");
  res = res.replace(/\{chapter\}/gi, vars.chapter || "");
  res = res.replace(/\{teacher\}/gi, vars.teacher || "");
  res = res.replace(/\{date\}/gi, vars.date || "");
  res = res.replace(/\{moduleNumber\}/gi, vars.moduleNumber || "");
  res = res.replace(/\{targetExam\}/gi, vars.targetExam || "");
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

/**
 * Enhanced processNativePdfEdits for Atomic Pathshala Module Editor API
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

  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helveticaItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const timesFont = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const courierFont = await pdfDoc.embedFont(StandardFonts.Courier);

  const getFont = (family?: string, isBold?: boolean, isItalic?: boolean): PDFFont => {
    if (family === "times") return isBold ? timesBold : timesFont;
    if (family === "courier") return courierFont;
    if (isBold && isItalic) return helveticaBold;
    if (isBold) return helveticaBold;
    if (isItalic) return helveticaItalic;
    return helveticaFont;
  };

  const theme = ThemeEngine.getThemeForSubject(coverPage?.subject || "CHEMISTRY");

  // Handle deletions & Front Page actions
  const originalPageCount = pdfDoc.getPageCount();
  const deletedSet = new Set(deletedPages);

  if (coverPage?.action === "REPLACE_FIRST" || coverPage?.action === "DELETE_FIRST") {
    deletedSet.add(1);
  }

  // Pre-embed images
  let headerImgEmbed: any = null;
  const hImg = headerFooter?.headerImageBase64 || headerFooter?.headerImageUrl;
  if (hImg) {
    try {
      headerImgEmbed = await embedImageBuffer(pdfDoc, hImg);
    } catch (err) {
      console.warn("[processNativePdfEdits] Header image embed failed:", err);
    }
  }

  let footerImgEmbed: any = null;
  const fImg = headerFooter?.footerImageBase64 || headerFooter?.footerImageUrl;
  if (fImg) {
    try {
      footerImgEmbed = await embedImageBuffer(pdfDoc, fImg);
    } catch (err) {
      console.warn("[processNativePdfEdits] Footer image embed failed:", err);
    }
  }

  let watermarkImgEmbed: any = null;
  const wmImg = watermark?.base64Data || watermark?.imageUrl;
  if (watermark?.type === "image" && wmImg) {
    try {
      watermarkImgEmbed = await embedImageBuffer(pdfDoc, wmImg);
    } catch (err) {
      console.warn("[processNativePdfEdits] Watermark image embed failed:", err);
    }
  }

  let workingDoc = pdfDoc;
  if (pageOrder && pageOrder.length > 0) {
    const reorderedDoc = await PDFDocument.create();
    for (const pNum of pageOrder) {
      if (pNum >= 1 && pNum <= originalPageCount && !deletedSet.has(pNum)) {
        const [copied] = await reorderedDoc.copyPages(pdfDoc, [pNum - 1]);
        reorderedDoc.addPage(copied);
      }
    }
    workingDoc = reorderedDoc;
  } else if (deletedSet.size > 0) {
    const sortedDeletes = Array.from(deletedSet).sort((a, b) => b - a);
    for (const pNum of sortedDeletes) {
      if (pNum >= 1 && pNum <= workingDoc.getPageCount()) {
        workingDoc.removePage(pNum - 1);
      }
    }
  }

  const pages = workingDoc.getPages();
  const totalPages = pages.length;

  // Apply Page Rotations
  for (const [pNumStr, rotDeg] of Object.entries(pageRotations)) {
    const pNum = Number(pNumStr);
    if (pNum >= 1 && pNum <= pages.length) {
      pages[pNum - 1].setRotation(degrees(Number(rotDeg)));
    }
  }

  // Strict Layer Processing
  for (let pIdx = 0; pIdx < pages.length; pIdx++) {
    const pageNum = pIdx + 1;
    const page = pages[pIdx];
    const { width, height } = page.getSize();

    const vars = {
      page: pageNum,
      totalPages,
      subject: coverPage?.subject || theme.name,
      chapter: coverPage?.chapter || "Academic Chapter",
      teacher: coverPage?.teacher || "Atomic Pathshala Faculty",
      date: new Date().toLocaleDateString("en-IN"),
      moduleNumber: coverPage?.moduleNumber || "01",
      targetExam: coverPage?.targetExam || "NEET / JEE",
    };

    // Layer 0: Background
    if (background?.enabled && isPageInRange(pageNum, background.pageRange, background.customPages)) {
      if (background.color && background.color !== "#ffffff") {
        page.drawRectangle({
          x: 0,
          y: 0,
          width,
          height,
          color: hexToRgb(background.color),
          opacity: background.opacity ?? 1,
        });
      }
    }

    // Layer 20: Watermark (Behind Content)
    if (watermark?.enabled && watermark.layer !== "ABOVE_CONTENT" && isPageInRange(pageNum, watermark.pageRange, watermark.customPages, watermark.excludeFirstPage)) {
      renderWatermark(page, watermark, theme, watermarkImgEmbed, helveticaBold, width, height);
    }

    // Layer 30: Removal Masks (Old Header/Footer)
    if (headerFooter?.removeOldHeader && isPageInRange(pageNum, headerFooter.pageRange, headerFooter.customPages, headerFooter.excludeFirstPage)) {
      const hHeight = headerFooter.oldHeaderHeightPt || 42;
      page.drawRectangle({ x: 0, y: height - hHeight, width, height: hHeight, color: rgb(1, 1, 1) });
    }
    if (headerFooter?.removeOldFooter && isPageInRange(pageNum, headerFooter.pageRange, headerFooter.customPages, headerFooter.excludeFirstPage)) {
      const fHeight = headerFooter.oldFooterHeightPt || 32;
      page.drawRectangle({ x: 0, y: 0, width, height: fHeight, color: rgb(1, 1, 1) });
    }

    // Global Removals (Logos/Banners across pages)
    for (const rem of globalRemovals) {
      if (isPageInRange(pageNum, rem.pageRange, rem.customPages)) {
        const pdfY = height - rem.y - rem.height;
        page.drawRectangle({
          x: rem.x,
          y: Math.max(0, pdfY),
          width: rem.width,
          height: rem.height,
          color: rem.color ? hexToRgb(rem.color) : rgb(1, 1, 1),
        });
      }
    }

    // Global Replacements
    for (const rep of globalReplacements) {
      if (isPageInRange(pageNum, rep.pageRange, rep.customPages)) {
        const pdfY = height - rep.y - rep.height;
        page.drawRectangle({ x: rep.x, y: Math.max(0, pdfY), width: rep.width, height: rep.height, color: rgb(1, 1, 1) });
        if (rep.replacementType === "image" && (rep.base64Data || rep.imageUrl)) {
          try {
            const repImg = await embedImageBuffer(workingDoc, (rep.base64Data || rep.imageUrl)!);
            if (repImg) page.drawImage(repImg, { x: rep.x, y: Math.max(0, pdfY), width: rep.width, height: rep.height });
          } catch (err) {
            console.warn("[processNativePdfEdits] Replacement image failed:", err);
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

    // Whiteouts
    const pageWhiteouts = whiteouts.filter((w) => w.pageNumber === pageNum);
    for (const w of pageWhiteouts) {
      const pdfY = height - w.y - w.height;
      page.drawRectangle({
        x: w.x,
        y: Math.max(0, pdfY),
        width: w.width,
        height: w.height,
        color: w.color ? hexToRgb(w.color) : rgb(1, 1, 1),
      });
    }

    // In-Place Text Edits
    const pageTextEdits = textEdits.filter((t) => t.pageNumber === pageNum);
    for (const t of pageTextEdits) {
      const pdfY = height - t.y - t.height;
      if (t.hideOriginal !== false) {
        page.drawRectangle({
          x: t.x - 2,
          y: Math.max(0, pdfY - 2),
          width: t.width + 4,
          height: t.height + 4,
          color: t.backgroundColor ? hexToRgb(t.backgroundColor) : rgb(1, 1, 1),
        });
      }

      if (t.newText && t.newText.trim().length > 0) {
        const font = getFont(t.fontFamily, t.isBold, t.isItalic);
        const textColor = t.color ? hexToRgb(t.color) : hexToRgb(theme.colors.bodyText);
        const fontSize = Math.max(6, t.fontSize || 10);
        const cleanText = t.newText.replace(/[^\x20-\x7E\n]/g, " ");
        const lines = cleanText.split("\n");
        let lineY = pdfY + t.height - fontSize;

        for (const line of lines) {
          let lineX = t.x;
          if (t.align === "center") {
            const textW = font.widthOfTextAtSize(line, fontSize);
            lineX = t.x + Math.max(0, (t.width - textW) / 2);
          } else if (t.align === "right") {
            const textW = font.widthOfTextAtSize(line, fontSize);
            lineX = t.x + Math.max(0, t.width - textW);
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

    // Inserted Images
    const pageImages = images.filter((img) => img.pageNumber === pageNum);
    for (const img of pageImages) {
      try {
        const embedded = await embedImageBuffer(workingDoc, (img.base64Data || img.imageUrl)!);
        if (embedded) {
          const pdfY = height - img.y - img.height;
          page.drawImage(embedded, {
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

    // Inserted Shapes
    const pageShapes = shapes.filter((s) => s.pageNumber === pageNum);
    for (const s of pageShapes) {
      const pdfY = height - s.y - s.height;
      const stroke = s.strokeColor ? hexToRgb(s.strokeColor) : undefined;
      const fill = s.fillColor ? hexToRgb(s.fillColor) : undefined;

      if (s.type === "highlight") {
        page.drawRectangle({
          x: s.x,
          y: Math.max(0, pdfY),
          width: s.width,
          height: s.height,
          color: fill || hexToRgb(theme.colors.tagBg),
          opacity: s.opacity ?? 0.35,
        });
      } else if (s.type === "rect" || s.type === "callout") {
        page.drawRectangle({
          x: s.x,
          y: Math.max(0, pdfY),
          width: s.width,
          height: s.height,
          borderColor: stroke || hexToRgb(theme.colors.border),
          borderWidth: s.strokeWidth || 1.5,
          color: fill,
          opacity: s.opacity ?? 1,
        });
      } else if (s.type === "divider" || s.type === "line") {
        page.drawLine({
          start: { x: s.x, y: pdfY + s.height },
          end: { x: s.x + s.width, y: pdfY },
          thickness: s.strokeWidth || theme.structuralDividerThickness,
          color: stroke || hexToRgb(theme.colors.primary),
        });
      } else if (s.type === "circle") {
        const radius = Math.min(s.width, s.height) / 2;
        page.drawCircle({
          x: s.x + radius,
          y: Math.max(0, pdfY + radius),
          size: radius,
          borderColor: stroke,
          borderWidth: s.strokeWidth || 1.5,
          color: fill,
          opacity: s.opacity ?? 1,
        });
      }
    }

    // Running Header & Footer
    if (headerFooter?.enabled && isPageInRange(pageNum, headerFooter.pageRange, headerFooter.customPages, headerFooter.excludeFirstPage)) {
      const topOffset = headerFooter.headerTopOffsetPt || 0;
      const hHeight = headerFooter.headerImageHeight || 36;
      const bannerY = height - hHeight - topOffset;
      const accentCol = hexToRgb(headerFooter.accentColor || theme.colors.primary);
      const navyText = hexToRgb(theme.colors.headingText);
      const slateText = hexToRgb(theme.colors.secondary);

      page.drawRectangle({ x: 0, y: bannerY, width, height: hHeight, color: hexToRgb(theme.colors.headerBannerBg) });
      page.drawRectangle({ x: 0, y: bannerY, width, height: theme.headerBorderThickness, color: accentCol });

      if (headerImgEmbed) {
        const imgH = hHeight - 8;
        const imgW = (headerImgEmbed.width / headerImgEmbed.height) * imgH;
        let imgX = 24;
        if (headerFooter.headerImagePosition === "center") imgX = (width - imgW) / 2;
        if (headerFooter.headerImagePosition === "right") imgX = width - imgW - 24;
        page.drawImage(headerImgEmbed, { x: imgX, y: bannerY + 4, width: imgW, height: imgH });
      }

      const leftH = replaceVariables(headerFooter.headerLeft || "ATOMIC PATHSHALA", vars);
      const centerH = replaceVariables(headerFooter.headerCenter || "| {subject} - {chapter}", vars);
      const rightH = replaceVariables(headerFooter.headerRight || "{teacher}", vars);

      if (!headerImgEmbed || headerFooter.headerImagePosition !== "left") {
        page.drawText(leftH, { x: 24, y: bannerY + hHeight / 2 - 4, size: headerFooter.fontSize || 9, font: helveticaBold, color: accentCol });
      }
      if (!headerImgEmbed || headerFooter.headerImagePosition !== "center") {
        page.drawText(centerH, { x: 150, y: bannerY + hHeight / 2 - 4, size: (headerFooter.fontSize || 9) - 0.5, font: helveticaFont, color: navyText });
      }
      const rightW = helveticaFont.widthOfTextAtSize(rightH, (headerFooter.fontSize || 9) - 0.5);
      if (!headerImgEmbed || headerFooter.headerImagePosition !== "right") {
        page.drawText(rightH, { x: width - rightW - 24, y: bannerY + hHeight / 2 - 4, size: (headerFooter.fontSize || 9) - 0.5, font: helveticaFont, color: slateText });
      }

      // Footer
      const bottomOffset = headerFooter.footerBottomOffsetPt || 0;
      const fHeight = headerFooter.footerImageHeight || 28;
      const footerY = bottomOffset;

      page.drawRectangle({ x: 20, y: footerY + fHeight, width: width - 40, height: theme.structuralDividerThickness, color: hexToRgb(theme.colors.border) });

      if (footerImgEmbed) {
        const imgH = fHeight - 6;
        const imgW = (footerImgEmbed.width / footerImgEmbed.height) * imgH;
        let imgX = (width - imgW) / 2;
        if (headerFooter.footerImagePosition === "left") imgX = 24;
        if (headerFooter.footerImagePosition === "right") imgX = width - imgW - 24;
        page.drawImage(footerImgEmbed, { x: imgX, y: footerY + 3, width: imgW, height: imgH });
      }

      const leftF = replaceVariables(headerFooter.footerLeft || "Atomic Pathshala | India's Leading NEET Accelerator", vars);
      const rightF = replaceVariables(headerFooter.footerRight || "Page {page} of {totalPages}", vars);

      if (!footerImgEmbed || headerFooter.footerImagePosition !== "left") {
        page.drawText(leftF, { x: 24, y: footerY + 8, size: 7.5, font: helveticaFont, color: slateText });
      }
      const pgW = helveticaBold.widthOfTextAtSize(rightF, 8);
      if (!footerImgEmbed || headerFooter.footerImagePosition !== "right") {
        page.drawText(rightF, { x: width - pgW - 24, y: footerY + 8, size: 8, font: helveticaBold, color: accentCol });
      }
    }

    // Layer 70: Watermark (Above Content)
    if (watermark?.enabled && watermark.layer === "ABOVE_CONTENT" && isPageInRange(pageNum, watermark.pageRange, watermark.customPages, watermark.excludeFirstPage)) {
      renderWatermark(page, watermark, theme, watermarkImgEmbed, helveticaBold, width, height);
    }
  }

  // Prepend Cover Page
  if (coverPage?.enabled && (coverPage.action === "PREPEND" || coverPage.action === "REPLACE_FIRST" || !coverPage.action)) {
    renderCoverPage(workingDoc, coverPage, theme, helveticaBold, helveticaFont);
  }

  const pdfBytes = await workingDoc.save();
  return {
    pdfBytes,
    pageCount: workingDoc.getPageCount(),
    fileSizeBytes: pdfBytes.length,
    processedAt: new Date().toISOString(),
  };
}

function renderWatermark(
  page: PDFPage,
  config: WatermarkConfig,
  theme: ModuleTheme,
  watermarkImgEmbed: any,
  boldFont: PDFFont,
  width: number,
  height: number
) {
  if (config.type === "image" && watermarkImgEmbed) {
    const scale = config.scale || 1.0;
    const wmWidth = (config.imageWidth || width * 0.5) * scale;
    const wmHeight = (config.imageHeight || (watermarkImgEmbed.height / watermarkImgEmbed.width) * wmWidth) * scale;
    let wmX = (width - wmWidth) / 2;
    let wmY = (height - wmHeight) / 2;

    if (config.position === "TOP") wmY = height - wmHeight - 80;
    if (config.position === "BOTTOM") wmY = 80;
    if (config.position === "CUSTOM" && config.customX !== undefined && config.customY !== undefined) {
      wmX = config.customX;
      wmY = height - config.customY - wmHeight;
    }

    page.drawImage(watermarkImgEmbed, {
      x: wmX,
      y: wmY,
      width: wmWidth,
      height: wmHeight,
      opacity: config.opacity ?? 0.08,
      rotate: degrees(config.rotation ?? 0), // 0 is strictly standard unrotated
    });
  } else if (config.text) {
    const clean = config.text.replace(/[^\x20-\x7E]/g, " ");
    const fontSize = config.fontSize || Math.min(width, height) * 0.07;
    const textW = boldFont.widthOfTextAtSize(clean, fontSize);
    let wmX = (width - textW) / 2;
    let wmY = height / 2;

    if (config.position === "TOP") wmY = height - 120;
    if (config.position === "BOTTOM") wmY = 120;

    page.drawText(clean, {
      x: wmX,
      y: wmY,
      size: fontSize,
      font: boldFont,
      color: config.color ? hexToRgb(config.color) : hexToRgb(theme.colors.primary),
      opacity: config.opacity ?? 0.05,
      rotate: degrees(config.rotation ?? 35),
    });
  }
}

function renderCoverPage(
  doc: PDFDocument,
  coverPage: CoverPageConfig,
  theme: ModuleTheme,
  boldFont: PDFFont,
  font: PDFFont
) {
  const cover = doc.insertPage(0, [DEFAULT_PAGE_SIZE.width, DEFAULT_PAGE_SIZE.height]);
  const { width, height } = cover.getSize();
  const primaryCol = hexToRgb(theme.colors.primary);
  const darkNavy = hexToRgb(theme.colors.headingText);
  const slate = hexToRgb(theme.colors.secondary);
  const orange = rgb(0.917, 0.345, 0.047);

  // Top Brand
  cover.drawText("ATOMIC", { x: 48, y: height - 55, size: 18, font: boldFont, color: orange });
  cover.drawText("PATHSHALA", { x: 125, y: height - 55, size: 18, font: boldFont, color: darkNavy });
  cover.drawText("LEARN - EXPLORE - EXCEL", { x: 48, y: height - 68, size: 8, font: boldFont, color: slate });

  // Subject Title
  const cleanSubj = (coverPage.subject || theme.name).replace(/[^\x20-\x7E]/g, " ");
  cover.drawText(cleanSubj.toUpperCase(), { x: 48, y: height - 240, size: 30, font: boldFont, color: primaryCol });

  // Module Pill
  cover.drawText("MODULE -", { x: 48, y: height - 280, size: 15, font: boldFont, color: darkNavy });
  cover.drawRectangle({ x: 135, y: height - 286, width: 42, height: 22, color: primaryCol });
  const modNum = (coverPage.moduleNumber || "01").replace(/[^0-9]/g, "").padStart(2, "0") || "01";
  cover.drawText(modNum, { x: 147, y: height - 280, size: 13, font: boldFont, color: rgb(1, 1, 1) });

  // Chapter Title
  cover.drawText("- CHAPTER -", { x: 48, y: height - 315, size: 10, font: boldFont, color: slate });
  const cleanChapter = (coverPage.chapter || "Academic Chapter").replace(/[^\x20-\x7E]/g, " ").toUpperCase();
  cover.drawText(cleanChapter, { x: 48, y: height - 345, size: 18, font: boldFont, color: darkNavy });

  // Features
  const features = [
    "Core Concepts & Detailed Theory",
    "NCERT Illustrations & Step-by-Step Solutions",
    "Levelwise Mastery Exercises",
    "Previous Years Question Bank (PYQ)",
  ];
  let featY = height - 410;
  features.forEach((feat) => {
    cover.drawRectangle({ x: 48, y: featY - 2, width: 14, height: 14, color: primaryCol });
    cover.drawText(feat, { x: 72, y: featY + 1, size: 10.5, font: boldFont, color: darkNavy });
    featY -= 26;
  });

  // Bottom Guidance
  cover.drawRectangle({ x: 48, y: 48, width: width - 96, height: 1, color: hexToRgb(theme.colors.border) });
  const cleanTeacher = (coverPage.teacher || "Atomic Pathshala Faculty").replace(/[^\x20-\x7E]/g, " ");
  cover.drawText(`Faculty: ${cleanTeacher}`, { x: 48, y: 32, size: 9, font: boldFont, color: darkNavy });
  const alignText = "100% NCERT ALIGNED - PRINT READY";
  const alignW = boldFont.widthOfTextAtSize(alignText, 9);
  cover.drawText(alignText, { x: width - 48 - alignW, y: 32, size: 9, font: boldFont, color: primaryCol });
}

export class NativePdfEngine {
  public static async exportPdf(options: PdfExportOptions): Promise<PdfExportResult> {
    const { state, pdfBuffer } = options;

    const res = await processNativePdfEdits({
      originalPdfBuffer: pdfBuffer || Buffer.alloc(0),
      textEdits: state.objects.filter((o) => o.type === "text" && !o.isDeleted).map((o) => {
        const txt = o as TextObject;
        return {
          id: txt.id,
          pageNumber: txt.pageNumber,
          x: txt.transform.x,
          y: txt.transform.y,
          width: txt.transform.width,
          height: txt.transform.height,
          newText: txt.text,
          fontSize: txt.fontSize,
          fontFamily: txt.fontFamily,
          color: txt.color,
          isBold: txt.isBold,
          isItalic: txt.isItalic,
          align: txt.align,
          lineHeight: txt.lineHeight,
          hideOriginal: txt.hideOriginalUnderneath,
          backgroundColor: txt.backgroundColor,
        };
      }),
      images: state.objects.filter((o) => o.type === "image" && !o.isDeleted).map((o) => {
        const img = o as ImageObject;
        return {
          id: img.id,
          pageNumber: img.pageNumber,
          x: img.transform.x,
          y: img.transform.y,
          width: img.transform.width,
          height: img.transform.height,
          imageUrl: img.imageUrl,
          base64Data: img.base64Data,
          opacity: img.transform.opacity,
          rotation: img.transform.rotation,
        };
      }),
      shapes: state.objects.filter((o) => o.type === "shape" && !o.isDeleted).map((o) => {
        const shp = o as ShapeObject;
        return {
          id: shp.id,
          pageNumber: shp.pageNumber,
          type: shp.shapeType,
          x: shp.transform.x,
          y: shp.transform.y,
          width: shp.transform.width,
          height: shp.transform.height,
          strokeColor: shp.strokeColor,
          fillColor: shp.fillColor,
          strokeWidth: shp.strokeWidth,
          opacity: shp.transform.opacity,
        };
      }),
      whiteouts: state.objects.filter((o) => o.type === "redaction" && !o.isDeleted).map((o) => {
        const red = o as RedactionObject;
        return {
          id: red.id,
          pageNumber: red.pageNumber,
          x: red.transform.x,
          y: red.transform.y,
          width: red.transform.width,
          height: red.transform.height,
          color: red.color,
        };
      }),
      headerFooter: state.headerFooter,
      watermark: state.watermark,
      coverPage: state.coverPage,
      pageRotations: state.pageRotations,
      deletedPages: state.deletedPages,
      pageOrder: state.pageOrder,
    });

    return {
      pdfBytes: res.pdfBytes,
      pageCount: res.pageCount,
      fileSizeBytes: res.fileSizeBytes,
      exportedAt: res.processedAt,
    };
  }
}
