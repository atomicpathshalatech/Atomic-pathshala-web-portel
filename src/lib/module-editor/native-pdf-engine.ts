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
  HeaderFooterConfig,
  WatermarkConfig,
  CoverPageConfig,
} from "./types";
import { CoordinateEngine, DEFAULT_PAGE_SIZE } from "./coordinate-engine";
import { ThemeEngine, SUBJECT_THEMES } from "./theme-engine";
import { LayerEngine } from "./layer-engine";
import { PreviewRenderer } from "./preview-renderer";
import { exportPlan, objectsOnPage } from "./overlay-model";
import { TEXT_PAD, TEXT_LINE_HEIGHT, FONT_ASCENT, FONT_BOX } from "./text-box";

export type { HeaderFooterConfig, WatermarkConfig, CoverPageConfig };

// -------------------------------------------------------------
// Compatibility Interfaces for FoxitModuleEditor & save-native API
// -------------------------------------------------------------
/**
 * Every overlay object (text, whiteout, image, shape) on a page shares one
 * stacking order: higher `z` is drawn later, i.e. on top — in the editor and
 * in the exported PDF alike. `pageNumber` is the page's id in the editor
 * (see overlay-model.ts: duplicated / blank pages get ids past the PDF's own).
 */
export interface OverlayCommon {
  z?: number;
  locked?: boolean;
}

export interface TextEditItem extends OverlayCommon {
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

export interface WhiteoutItem extends OverlayCommon {
  id: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string; // default #ffffff
}

export interface ImageEditItem extends OverlayCommon {
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

export interface ShapeEditItem extends OverlayCommon {
  id: string;
  pageNumber: number;
  type: "rect" | "circle" | "line" | "highlight" | "underline" | "callout" | "divider";
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
  /** Page id → source page (0 = blank) for duplicated / inserted pages (overlay-model.ts). */
  pageSources?: Record<number, number>;
  headerFooter?: HeaderFooterConfig;
  watermark?: WatermarkConfig;
  coverPage?: CoverPageConfig;
}

export interface NativePdfEditResult {
  pdfBytes: Uint8Array;
  pageCount: number;
  fileSizeBytes: number;
  processedAt: string;
  /** What could not be written into the PDF (told to the user, never dropped silently). */
  warnings: string[];
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
  let buf: Buffer;
  if (base64OrUrl.startsWith("data:image/") || base64OrUrl.includes(";base64,")) {
    buf = Buffer.from(base64OrUrl.slice(base64OrUrl.indexOf(",") + 1), "base64");
  } else if (base64OrUrl.startsWith("http://") || base64OrUrl.startsWith("https://")) {
    const res = await fetch(base64OrUrl);
    if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
    buf = Buffer.from(await res.arrayBuffer());
  } else {
    return null;
  }
  // Decided by the bytes, not the label or the file name (a ".jpg" that is
  // really a PNG, or an address with a query string, was read as JPEG and
  // silently left out of the PDF).
  const isPng = buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47;
  const isJpg = buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  if (isPng) return doc.embedPng(buf);
  if (isJpg) return doc.embedJpg(buf);
  throw new Error("This image format cannot go into a PDF (use PNG or JPEG).");
}

function replaceVariables(
  template: string = "",
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
    pageSources = {},
    headerFooter,
    watermark,
    coverPage,
  } = payload;
  const dropped = { chars: 0, images: 0 };

  const pdfDoc = await PDFDocument.load(originalPdfBuffer);

  // Text boxes are drawn into the finished document, so their fonts live there.
  const fontsFor = async (doc: PDFDocument) => {
    const f = async (name: StandardFonts) => doc.embedFont(name);
    return {
      helvetica: [await f(StandardFonts.Helvetica), await f(StandardFonts.HelveticaBold), await f(StandardFonts.HelveticaOblique), await f(StandardFonts.HelveticaBoldOblique)],
      times: [await f(StandardFonts.TimesRoman), await f(StandardFonts.TimesRomanBold), await f(StandardFonts.TimesRomanItalic), await f(StandardFonts.TimesRomanBoldItalic)],
      courier: [await f(StandardFonts.Courier), await f(StandardFonts.CourierBold), await f(StandardFonts.CourierOblique), await f(StandardFonts.CourierBoldOblique)],
    };
  };
  let fontSet: Awaited<ReturnType<typeof fontsFor>> | null = null;
  const getFont = (family?: string, isBold?: boolean, isItalic?: boolean): PDFFont => {
    const set = fontSet!;
    const fam = family === "times" ? set.times : family === "courier" ? set.courier : set.helvetica;
    return fam[(isBold ? 1 : 0) + (isItalic ? 2 : 0)]!;
  };

  const theme = ThemeEngine.getThemeForSubject(coverPage?.subject || "CHEMISTRY");

  // Handle deletions & Front Page actions
  const originalPageCount = pdfDoc.getPageCount();
  const deletedSet = new Set(deletedPages);

  if (coverPage?.action === "REPLACE_FIRST" || coverPage?.action === "DELETE_FIRST") {
    deletedSet.add(1);
  }

  // Pages of the finished PDF from the editor's page list (order, deletions,
  // duplicated and blank pages). Overlays are matched by page id, not by the
  // position the page ends up at, so reordering never moves them.
  const plan = exportPlan(
    {
      pageOrder: pageOrder && pageOrder.length ? pageOrder : Array.from({ length: originalPageCount }, (_, i) => i + 1),
      deletedPages: Array.from(deletedSet),
      pageSources,
      pageRotations,
    },
    originalPageCount
  );
  const workingDoc = await PDFDocument.create();
  const firstSize = originalPageCount ? pdfDoc.getPage(0).getSize() : { width: DEFAULT_PAGE_SIZE.width, height: DEFAULT_PAGE_SIZE.height };
  for (const entry of plan) {
    if (entry.source === 0) {
      workingDoc.addPage([firstSize.width, firstSize.height]);
    } else {
      const [copied] = await workingDoc.copyPages(pdfDoc, [entry.source - 1]);
      if (copied) workingDoc.addPage(copied);
    }
  }
  // The editor shows a page turned by its own /Rotate plus the user's turn; so does the PDF.
  workingDoc.getPages().forEach((pg, i) => {
    const extra = plan[i]!.rotation;
    if (extra) pg.setRotation(degrees((((pg.getRotation().angle + extra) % 360) + 360) % 360));
  });

  fontSet = await fontsFor(workingDoc);
  const helveticaFont = fontSet.helvetica[0]!;
  const helveticaBold = fontSet.helvetica[1]!;

  // Pre-embed images
  let headerImgEmbed: any = null;
  const hImg = headerFooter?.headerImageBase64 || headerFooter?.headerImageUrl;
  if (hImg) {
    try {
      headerImgEmbed = await embedImageBuffer(workingDoc, hImg);
    } catch (err) {
      console.warn("[processNativePdfEdits] Header image embed failed:", err);
    }
  }

  let footerImgEmbed: any = null;
  const fImg = headerFooter?.footerImageBase64 || headerFooter?.footerImageUrl;
  if (fImg) {
    try {
      footerImgEmbed = await embedImageBuffer(workingDoc, fImg);
    } catch (err) {
      console.warn("[processNativePdfEdits] Footer image embed failed:", err);
    }
  }

  let watermarkImgEmbed: any = null;
  const wmImg = watermark?.base64Data || watermark?.imageUrl;
  if (watermark?.type === "image" && wmImg) {
    try {
      watermarkImgEmbed = await embedImageBuffer(workingDoc, wmImg);
    } catch (err) {
      console.warn("[processNativePdfEdits] Watermark image embed failed:", err);
    }
  }

  const pages = workingDoc.getPages();
  const totalPages = pages.length;
  const overlayProject = { textEdits, whiteouts, images, shapes };
  const imageCache = new Map<string, any>();
  const embedCached = async (src: string) => {
    if (!imageCache.has(src)) imageCache.set(src, await embedImageBuffer(workingDoc, src).catch(() => null));
    return imageCache.get(src);
  };

  // Strict Layer Processing
  for (let pIdx = 0; pIdx < pages.length; pIdx++) {
    const pageNum = pIdx + 1;
    const page = pages[pIdx];
    if (!page) continue;
    const { width, height } = page.getSize();
    const turn = ((page.getRotation().angle % 360) + 360) % 360;
    const frame = viewFrame(width, height, turn);

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

    // Page objects, bottom to top in the editor's stacking order (z), at the
    // positions the editor shows them (top-left origin, in the turned page).
    for (const o of objectsOnPage(overlayProject, plan[pIdx]!.pageId)) {
      const pl = frame.place(o.x, o.y, o.width, o.height, o.kind === "image" ? o.rotation ?? 0 : 0);
      if (o.kind === "whiteout") {
        page.drawRectangle({ ...pl.at(0, 0), width: o.width, height: o.height, rotate: pl.rotate, color: o.color ? hexToRgb(o.color) : rgb(1, 1, 1) });
      } else if (o.kind === "text") {
        if (o.hideOriginal !== false) {
          const m = frame.place(o.x - 2, o.y - 2, o.width + 4, o.height + 4, 0);
          page.drawRectangle({ ...m.at(0, 0), width: o.width + 4, height: o.height + 4, rotate: m.rotate, color: o.backgroundColor ? hexToRgb(o.backgroundColor) : rgb(1, 1, 1) });
        }
        if (o.newText && o.newText.trim().length > 0) {
          const font = getFont(o.fontFamily, o.isBold, o.isItalic);
          const fontSize = Math.max(4, o.fontSize || 10);
          const lineHeight = o.lineHeight || TEXT_LINE_HEIGHT;
          const lines = wrapText(writable(font, o.newText, dropped), font, fontSize, Math.max(1, o.width - TEXT_PAD * 2));
          // Same box model as the editor: padding, line height, first baseline.
          const firstBaseline = TEXT_PAD + fontSize * ((lineHeight - FONT_BOX) / 2 + FONT_ASCENT);
          lines.forEach((line, i) => {
            const w = font.widthOfTextAtSize(line, fontSize);
            const lx = o.align === "center" ? (o.width - w) / 2 : o.align === "right" ? o.width - TEXT_PAD - w : TEXT_PAD;
            const top = firstBaseline + i * fontSize * lineHeight;
            if (!line) return;
            page.drawText(line, { ...pl.at(lx, o.height - top), size: fontSize, font, rotate: pl.rotate, color: o.color ? hexToRgb(o.color) : rgb(0, 0, 0) });
          });
        }
      } else if (o.kind === "image") {
        const src = o.base64Data || o.imageUrl;
        const embedded = src ? await embedCached(src) : null;
        if (embedded) {
          page.drawImage(embedded, { ...pl.at(0, 0), width: o.width, height: o.height, rotate: pl.rotate, opacity: o.opacity ?? 1 });
        } else {
          dropped.images++;
        }
      } else if (o.kind === "shape") {
        const s = o;
        const stroke = s.strokeColor ? hexToRgb(s.strokeColor) : undefined;
        const fill = s.fillColor ? hexToRgb(s.fillColor) : undefined;
        const strokeWidth = s.strokeWidth ?? 1.5;
        if (s.type === "highlight") {
          page.drawRectangle({ ...pl.at(0, 0), width: s.width, height: s.height, rotate: pl.rotate, color: fill || rgb(1, 0.9, 0.2), opacity: s.opacity ?? 0.4 });
        } else if (s.type === "rect" || s.type === "callout") {
          page.drawRectangle({
            ...pl.at(0, 0),
            width: s.width,
            height: s.height,
            rotate: pl.rotate,
            borderColor: stroke ?? (fill ? undefined : rgb(0, 0, 0)),
            borderWidth: stroke || !fill ? strokeWidth : 0,
            color: fill,
            opacity: fill ? s.opacity ?? 1 : undefined,
            borderOpacity: s.opacity ?? 1,
          });
        } else if (s.type === "circle") {
          page.drawEllipse({
            ...pl.at(s.width / 2, s.height / 2),
            xScale: s.width / 2,
            yScale: s.height / 2,
            rotate: pl.rotate,
            borderColor: stroke ?? (fill ? undefined : rgb(0, 0, 0)),
            borderWidth: stroke || !fill ? strokeWidth : 0,
            color: fill,
            opacity: fill ? s.opacity ?? 1 : undefined,
            borderOpacity: s.opacity ?? 1,
          });
        } else if (s.type === "line" || s.type === "divider") {
          page.drawLine({ start: pl.at(0, s.height), end: pl.at(s.width, 0), thickness: strokeWidth, color: stroke || rgb(0, 0, 0), opacity: s.opacity ?? 1 });
        } else if (s.type === "underline") {
          page.drawLine({ start: pl.at(0, 0), end: pl.at(s.width, 0), thickness: strokeWidth, color: stroke || rgb(0, 0, 0), opacity: s.opacity ?? 1 });
        }
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
  // The file must open again with every page before anyone gets it.
  const reopened = await PDFDocument.load(pdfBytes).catch((e) => {
    throw new Error(`The edited PDF could not be re-opened (${e?.message ?? e}) — nothing was saved.`);
  });
  if (reopened.getPageCount() !== workingDoc.getPageCount() || reopened.getPageCount() === 0) {
    throw new Error("The edited PDF lost pages while saving — nothing was saved.");
  }
  const warnings: string[] = [];
  if (dropped.chars) warnings.push(`${dropped.chars} character(s) in your text boxes (for example Hindi) cannot be written with the PDF's built-in fonts and were left blank in the exported PDF.`);
  if (dropped.images) warnings.push(`${dropped.images} picture(s) could not be read (only PNG and JPEG can go into the PDF) and are missing from the export.`);
  return {
    pdfBytes,
    pageCount: workingDoc.getPageCount(),
    fileSizeBytes: pdfBytes.length,
    processedAt: new Date().toISOString(),
    warnings,
  };
}

export { TEXT_PAD, TEXT_LINE_HEIGHT };

/**
 * The page as the editor shows it — turned by its rotation, origin at the top
 * left — and the way back to PDF space. `place` maps a box (plus a clockwise
 * turn of the object itself, for pictures) so that drawing at `at(lx, ly)` in
 * the box's own coordinates (origin bottom-left, y up) with `rotate` lands
 * exactly where the editor showed it.
 */
function viewFrame(W0: number, H0: number, turn: number) {
  const toPdf = (dx: number, dy: number): { x: number; y: number } => {
    switch (turn) {
      case 90:
        return { x: dy, y: dx };
      case 180:
        return { x: W0 - dx, y: dy };
      case 270:
        return { x: W0 - dy, y: H0 - dx };
      default:
        return { x: dx, y: H0 - dy };
    }
  };
  const place = (dx: number, dy: number, w: number, h: number, objectTurnCw: number) => {
    const angle = turn - objectTurnCw; // pdf-lib turns counter-clockwise
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const c = toPdf(dx + w / 2, dy + h / 2);
    return {
      rotate: degrees(angle),
      at: (lx: number, ly: number) => {
        const ux = lx - w / 2;
        const uy = ly - h / 2;
        return { x: c.x + ux * cos - uy * sin, y: c.y + ux * sin + uy * cos };
      },
    };
  };
  return { place };
}

/** Breaks text into lines that fit `maxWidth`, keeping the user's own line breaks. */
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const para of text.split("\n")) {
    const words = para.split(/(\s+)/);
    let line = "";
    for (const w of words) {
      const next = line + w;
      if (line && font.widthOfTextAtSize(next.trimEnd(), size) > maxWidth) {
        out.push(line.trimEnd());
        line = w.trimStart();
        // A single word wider than the box is cut by characters.
        while (line && font.widthOfTextAtSize(line, size) > maxWidth && line.length > 1) {
          let k = line.length - 1;
          while (k > 1 && font.widthOfTextAtSize(line.slice(0, k), size) > maxWidth) k--;
          out.push(line.slice(0, k));
          line = line.slice(k);
        }
      } else {
        line = next;
      }
    }
    out.push(line.trimEnd());
  }
  return out;
}

/** Characters the standard PDF fonts cannot write (Hindi, emoji…) become spaces — and are counted, not hidden. */
function writable(font: PDFFont, text: string, dropped: { chars: number; images: number }): string {
  let out = "";
  for (const ch of text) {
    if (ch === "\n") {
      out += ch;
      continue;
    }
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      out += " ";
      dropped.chars++;
    }
  }
  return out;
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
