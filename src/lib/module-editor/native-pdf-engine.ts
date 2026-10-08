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

export class NativePdfEngine {
  /**
   * Main PDF compilation and rendering function
   */
  public static async exportPdf(options: PdfExportOptions): Promise<PdfExportResult> {
    const { state, pdfBuffer } = options;
    const theme = state.theme || SUBJECT_THEMES.CHEMISTRY;

    // 1. Create or Load Document
    let doc: PDFDocument;
    if (pdfBuffer && pdfBuffer.length > 0) {
      doc = await PDFDocument.load(pdfBuffer);
    } else {
      doc = await PDFDocument.create();
      // Add blank pages matching state pageCount (minimum 1)
      const count = Math.max(1, state.pageCount || 1);
      for (let i = 0; i < count; i++) {
        doc.addPage([state.pageSize.width || DEFAULT_PAGE_SIZE.width, state.pageSize.height || DEFAULT_PAGE_SIZE.height]);
      }
    }

    // Embed standard typography fonts
    const helveticaFont = await doc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const helveticaItalic = await doc.embedFont(StandardFonts.HelveticaOblique);
    const timesFont = await doc.embedFont(StandardFonts.TimesRoman);
    const timesBold = await doc.embedFont(StandardFonts.TimesRomanBold);
    const courierFont = await doc.embedFont(StandardFonts.Courier);

    const getFont = (family?: string, isBold?: boolean, isItalic?: boolean): PDFFont => {
      if (family === "times") return isBold ? timesBold : timesFont;
      if (family === "courier") return courierFont;
      if (isBold && isItalic) return helveticaBold;
      if (isBold) return helveticaBold;
      if (isItalic) return helveticaItalic;
      return helveticaFont;
    };

    // Pre-embed Header / Footer / Watermark images
    let headerImgEmbed: any = null;
    const hImgSrc = state.headerFooter.headerImageBase64 || state.headerFooter.headerImageUrl;
    if (hImgSrc) {
      try {
        headerImgEmbed = await embedImageBuffer(doc, hImgSrc);
      } catch (err) {
        console.warn("[NativePdfEngine] Header image embed failed:", err);
      }
    }

    let footerImgEmbed: any = null;
    const fImgSrc = state.headerFooter.footerImageBase64 || state.headerFooter.footerImageUrl;
    if (fImgSrc) {
      try {
        footerImgEmbed = await embedImageBuffer(doc, fImgSrc);
      } catch (err) {
        console.warn("[NativePdfEngine] Footer image embed failed:", err);
      }
    }

    let watermarkImgEmbed: any = null;
    const wmImgSrc = state.watermark.base64Data || state.watermark.imageUrl;
    if (state.watermark.type === "image" && wmImgSrc) {
      try {
        watermarkImgEmbed = await embedImageBuffer(doc, wmImgSrc);
      } catch (err) {
        console.warn("[NativePdfEngine] Watermark image embed failed:", err);
      }
    }

    // Handle Page Reordering and Deletions
    const deletedSet = new Set(state.deletedPages || []);
    if (state.coverPage?.action === "REPLACE_FIRST" || state.coverPage?.action === "DELETE_FIRST") {
      deletedSet.add(1);
    }

    let workingDoc = doc;
    if (state.pageOrder && state.pageOrder.length > 0) {
      const reorderedDoc = await PDFDocument.create();
      for (const pNum of state.pageOrder) {
        if (!deletedSet.has(pNum) && pNum >= 1 && pNum <= doc.getPageCount()) {
          const [copied] = await reorderedDoc.copyPages(doc, [pNum - 1]);
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
    for (const [pNumStr, rotDeg] of Object.entries(state.pageRotations || {})) {
      const pNum = Number(pNumStr);
      if (pNum >= 1 && pNum <= pages.length) {
        pages[pNum - 1].setRotation(degrees(Number(rotDeg)));
      }
    }

    // 2. Process each page according to the strict visual layering pipeline
    for (let pIdx = 0; pIdx < pages.length; pIdx++) {
      const pageNum = pIdx + 1;
      const page = pages[pIdx];
      const { width, height } = page.getSize();

      const vars: ModuleVariables = {
        page: pageNum,
        totalPages,
        subject: state.coverPage?.subject || theme.name,
        chapter: state.coverPage?.chapter || "Academic Chapter",
        teacher: state.coverPage?.teacher || "Atomic Pathshala Faculty",
        date: new Date().toLocaleDateString("en-IN"),
        moduleNumber: state.coverPage?.moduleNumber || "01",
        targetExam: state.coverPage?.targetExam || "NEET / JEE",
      };

      // ----------------------------------------------------
      // Layer 0: Page Background & Subtle Tint (if enabled)
      // ----------------------------------------------------
      if (theme.enableSubtlePaperTint && theme.colors.paperBg !== "#ffffff") {
        page.drawRectangle({
          x: 0,
          y: 0,
          width,
          height,
          color: hexToRgb(theme.colors.paperBg),
        });
      }

      // ----------------------------------------------------
      // Layer 20: Behind-Content Watermark
      // ----------------------------------------------------
      if (state.watermark.enabled && state.watermark.layer === "BEHIND_CONTENT") {
        this.renderWatermarkToPage(page, state.watermark, theme, watermarkImgEmbed, helveticaBold, width, height, pageNum);
      }

      // ----------------------------------------------------
      // Layer 30: Old Header / Footer Removal Masks
      // ----------------------------------------------------
      if (state.headerFooter.removeOldHeader && PreviewRenderer.isPageActive(pageNum, state.headerFooter.pageRange, state.headerFooter.customPages, state.headerFooter.excludeFirstPage)) {
        const hHeight = state.headerFooter.oldHeaderHeightPt || 42;
        page.drawRectangle({
          x: 0,
          y: height - hHeight,
          width,
          height: hHeight,
          color: rgb(1, 1, 1),
        });
      }

      if (state.headerFooter.removeOldFooter && PreviewRenderer.isPageActive(pageNum, state.headerFooter.pageRange, state.headerFooter.customPages, state.headerFooter.excludeFirstPage)) {
        const fHeight = state.headerFooter.oldFooterHeightPt || 32;
        page.drawRectangle({
          x: 0,
          y: 0,
          width,
          height: fHeight,
          color: rgb(1, 1, 1),
        });
      }

      // ----------------------------------------------------
      // Layer 50: Running Header & Footer
      // ----------------------------------------------------
      if (state.headerFooter.enabled && PreviewRenderer.isPageActive(pageNum, state.headerFooter.pageRange, state.headerFooter.customPages, state.headerFooter.excludeFirstPage)) {
        this.renderHeaderFooterToPage(
          page,
          state.headerFooter,
          theme,
          vars,
          headerImgEmbed,
          footerImgEmbed,
          helveticaFont,
          helveticaBold,
          width,
          height
        );
      }

      // ----------------------------------------------------
      // Layer 40 & 60: Active User Objects (Real Delete guarantees no deleted items rendered)
      // ----------------------------------------------------
      const activeObjects = LayerEngine.getObjectsForPage(state.objects, pageNum);

      for (const obj of activeObjects) {
        if (obj.isDeleted) continue; // Real Delete: strictly skip deleted objects

        const pdfBox = CoordinateEngine.uiToPdfCoord(
          {
            x: obj.transform.x,
            y: obj.transform.y,
            width: obj.transform.width,
            height: obj.transform.height,
          },
          height
        );

        if (obj.type === "redaction") {
          const red = obj as RedactionObject;
          page.drawRectangle({
            x: pdfBox.x,
            y: pdfBox.y,
            width: pdfBox.width,
            height: pdfBox.height,
            color: hexToRgb(red.color || "#ffffff"),
          });
        } else if (obj.type === "shape") {
          const shape = obj as ShapeObject;
          const stroke = shape.strokeColor ? hexToRgb(shape.strokeColor) : undefined;
          const fill = shape.fillColor ? hexToRgb(shape.fillColor) : undefined;

          if (shape.shapeType === "highlight") {
            page.drawRectangle({
              x: pdfBox.x,
              y: pdfBox.y,
              width: pdfBox.width,
              height: pdfBox.height,
              color: fill || hexToRgb(theme.colors.tagBg),
              opacity: obj.transform.opacity ?? 0.35,
            });
          } else if (shape.shapeType === "rect" || shape.shapeType === "callout") {
            page.drawRectangle({
              x: pdfBox.x,
              y: pdfBox.y,
              width: pdfBox.width,
              height: pdfBox.height,
              borderColor: stroke || hexToRgb(theme.colors.border),
              borderWidth: shape.strokeWidth || 1.5,
              color: fill,
              opacity: obj.transform.opacity ?? 1,
            });
          } else if (shape.shapeType === "divider") {
            page.drawLine({
              start: { x: pdfBox.x, y: pdfBox.y + pdfBox.height / 2 },
              end: { x: pdfBox.x + pdfBox.width, y: pdfBox.y + pdfBox.height / 2 },
              thickness: shape.strokeWidth || theme.structuralDividerThickness,
              color: stroke || hexToRgb(theme.colors.primary),
            });
          } else if (shape.shapeType === "circle") {
            const radius = Math.min(pdfBox.width, pdfBox.height) / 2;
            page.drawCircle({
              x: pdfBox.x + radius,
              y: pdfBox.y + radius,
              size: radius,
              borderColor: stroke,
              borderWidth: shape.strokeWidth || 1.5,
              color: fill,
              opacity: obj.transform.opacity ?? 1,
            });
          }
        } else if (obj.type === "text") {
          const txt = obj as TextObject;
          if (txt.hideOriginalUnderneath) {
            page.drawRectangle({
              x: pdfBox.x - 2,
              y: pdfBox.y - 2,
              width: pdfBox.width + 4,
              height: pdfBox.height + 4,
              color: txt.backgroundColor ? hexToRgb(txt.backgroundColor) : rgb(1, 1, 1),
            });
          }

          if (txt.text && txt.text.trim().length > 0) {
            const font = getFont(txt.fontFamily, txt.isBold, txt.isItalic);
            const textColor = txt.color ? hexToRgb(txt.color) : hexToRgb(theme.colors.bodyText);
            const fontSize = Math.max(6, txt.fontSize || 10);
            const cleanText = txt.text.replace(/[^\x20-\x7E\n]/g, " ");
            const lines = cleanText.split("\n");
            let lineY = pdfBox.y + pdfBox.height - fontSize;

            for (const line of lines) {
              let lineX = pdfBox.x;
              if (txt.align === "center") {
                const textW = font.widthOfTextAtSize(line, fontSize);
                lineX = pdfBox.x + Math.max(0, (pdfBox.width - textW) / 2);
              } else if (txt.align === "right") {
                const textW = font.widthOfTextAtSize(line, fontSize);
                lineX = pdfBox.x + Math.max(0, pdfBox.width - textW);
              }

              page.drawText(line, {
                x: lineX,
                y: Math.max(4, lineY),
                size: fontSize,
                font,
                color: textColor,
              });

              lineY -= fontSize * (txt.lineHeight || 1.25);
            }
          }
        } else if (obj.type === "image") {
          const imgObj = obj as ImageObject;
          const imgSrc = imgObj.base64Data || imgObj.imageUrl;
          if (imgSrc) {
            try {
              const embedded = await embedImageBuffer(workingDoc, imgSrc);
              if (embedded) {
                page.drawImage(embedded, {
                  x: pdfBox.x,
                  y: pdfBox.y,
                  width: pdfBox.width,
                  height: pdfBox.height,
                  opacity: obj.transform.opacity ?? 1,
                  rotate: degrees(obj.transform.rotation ?? 0),
                });
              }
            } catch (err) {
              console.warn("[NativePdfEngine] Failed to render image object:", err);
            }
          }
        }
      }

      // ----------------------------------------------------
      // Layer 70: Above-Content Watermark
      // ----------------------------------------------------
      if (state.watermark.enabled && state.watermark.layer === "ABOVE_CONTENT") {
        this.renderWatermarkToPage(page, state.watermark, theme, watermarkImgEmbed, helveticaBold, width, height, pageNum);
      }
    }

    // 3. Prepend Front Cover Page if enabled
    if (state.coverPage?.enabled && (state.coverPage.action === "PREPEND" || state.coverPage.action === "REPLACE_FIRST")) {
      this.renderCoverPage(workingDoc, state.coverPage, theme, helveticaBold, helveticaFont);
    }

    const pdfBytes = await workingDoc.save();
    return {
      pdfBytes,
      pageCount: workingDoc.getPageCount(),
      fileSizeBytes: pdfBytes.length,
      exportedAt: new Date().toISOString(),
    };
  }

  private static renderHeaderFooterToPage(
    page: PDFPage,
    config: any,
    theme: ModuleTheme,
    vars: ModuleVariables,
    headerImgEmbed: any,
    footerImgEmbed: any,
    font: PDFFont,
    boldFont: PDFFont,
    width: number,
    height: number
  ) {
    const topOffset = config.headerTopOffsetPt || 0;
    const hHeight = config.headerHeightPt || 36;
    const bannerY = height - hHeight - topOffset;
    const accentCol = hexToRgb(config.accentColor || theme.colors.primary);
    const navyText = hexToRgb(theme.colors.headingText);
    const slateText = hexToRgb(theme.colors.secondary);

    // Header Background Banner & Accent Line
    page.drawRectangle({
      x: 0,
      y: bannerY,
      width,
      height: hHeight,
      color: hexToRgb(theme.colors.headerBannerBg),
    });
    page.drawRectangle({
      x: 0,
      y: bannerY,
      width,
      height: theme.headerBorderThickness,
      color: accentCol,
    });

    if (headerImgEmbed) {
      const imgH = hHeight - 8;
      const imgW = (headerImgEmbed.width / headerImgEmbed.height) * imgH;
      let imgX = 24;
      if (config.headerImagePosition === "center") imgX = (width - imgW) / 2;
      if (config.headerImagePosition === "right") imgX = width - imgW - 24;

      page.drawImage(headerImgEmbed, {
        x: imgX,
        y: bannerY + 4,
        width: imgW,
        height: imgH,
      });
    }

    const leftH = PreviewRenderer.interpolateVariables(config.headerLeft || "ATOMIC PATHSHALA", vars);
    const centerH = PreviewRenderer.interpolateVariables(config.headerCenter || "| {subject} - {chapter}", vars);
    const rightH = PreviewRenderer.interpolateVariables(config.headerRight || "{teacher}", vars);

    if (!headerImgEmbed || config.headerImagePosition !== "left") {
      page.drawText(leftH, { x: 24, y: bannerY + hHeight / 2 - 4, size: config.fontSize || 9, font: boldFont, color: accentCol });
    }
    if (!headerImgEmbed || config.headerImagePosition !== "center") {
      page.drawText(centerH, { x: 150, y: bannerY + hHeight / 2 - 4, size: (config.fontSize || 9) - 0.5, font, color: navyText });
    }
    const rightW = font.widthOfTextAtSize(rightH, (config.fontSize || 9) - 0.5);
    if (!headerImgEmbed || config.headerImagePosition !== "right") {
      page.drawText(rightH, { x: width - rightW - 24, y: bannerY + hHeight / 2 - 4, size: (config.fontSize || 9) - 0.5, font, color: slateText });
    }

    // Running Footer
    const bottomOffset = config.footerBottomOffsetPt || 0;
    const fHeight = config.footerHeightPt || 28;
    const footerY = bottomOffset;

    page.drawRectangle({
      x: 20,
      y: footerY + fHeight,
      width: width - 40,
      height: theme.structuralDividerThickness,
      color: hexToRgb(theme.colors.border),
    });

    if (footerImgEmbed) {
      const imgH = fHeight - 6;
      const imgW = (footerImgEmbed.width / footerImgEmbed.height) * imgH;
      let imgX = (width - imgW) / 2;
      if (config.footerImagePosition === "left") imgX = 24;
      if (config.footerImagePosition === "right") imgX = width - imgW - 24;

      page.drawImage(footerImgEmbed, {
        x: imgX,
        y: footerY + 3,
        width: imgW,
        height: imgH,
      });
    }

    const leftF = PreviewRenderer.interpolateVariables(config.footerLeft || "Atomic Pathshala | India's Leading NEET Accelerator", vars);
    const rightF = PreviewRenderer.interpolateVariables(config.footerRight || "Page {page} of {totalPages}", vars);

    if (!footerImgEmbed || config.footerImagePosition !== "left") {
      page.drawText(leftF, { x: 24, y: footerY + 8, size: 7.5, font, color: slateText });
    }
    const pgW = boldFont.widthOfTextAtSize(rightF, 8);
    if (!footerImgEmbed || config.footerImagePosition !== "right") {
      page.drawText(rightF, { x: width - pgW - 24, y: footerY + 8, size: 8, font: boldFont, color: accentCol });
    }
  }

  private static renderWatermarkToPage(
    page: PDFPage,
    config: any,
    theme: ModuleTheme,
    watermarkImgEmbed: any,
    boldFont: PDFFont,
    width: number,
    height: number,
    pageNumber: number
  ) {
    if (!PreviewRenderer.isPageActive(pageNumber, config.pageRange, config.customPages, config.excludeFirstPage)) {
      return;
    }

    if (config.type === "image" && watermarkImgEmbed) {
      const scale = config.scale || 1.0;
      const wmWidth = (config.width || width * 0.5) * scale;
      const wmHeight = (config.height || (watermarkImgEmbed.height / watermarkImgEmbed.width) * wmWidth) * scale;
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
        rotate: degrees(config.rotation ?? 0), // 0 is standard unrotated
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

  private static renderCoverPage(
    doc: PDFDocument,
    coverPage: any,
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

    // Subject Title (Themed)
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
}
