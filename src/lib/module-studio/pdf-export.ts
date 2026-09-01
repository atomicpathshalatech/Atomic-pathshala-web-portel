import "server-only";
import { jsPDF } from "jspdf";
import type { ModuleElementInput, ModuleElementStyle } from "@/lib/validation/module";

// Rebuilds a module's content as a fresh, branded PDF from its stored
// elements. This is a genuine re-typeset, not a pixel-perfect clone of the
// original source PDF — this pipeline never captured real x/y layout data
// (see pdf-text.ts's comment on why), so there is nothing to reproduce
// pixel-for-pixel. What it does do for real: brand header/footer/tagline on
// every page, type-appropriate styling per content block honoring each
// block's own font/size/weight/color/alignment/line-height when the author
// set one in Note Studio, questions numbered, options indented, solutions
// in a distinct style, real image blocks, real tables, and an optional
// watermark — a working, useful export, honestly scoped rather than faking
// precise layout fidelity or fonts it can't actually embed.
//
// Font family is intentionally limited to jsPDF's built-in base-14 set
// (Helvetica, Times, Courier) — the only fonts this pipeline can embed
// without shipping and registering real font files. That also means
// non-Latin scripts (Devanagari, etc.) will not render correctly in the
// exported PDF even though they display fine on screen in the editor;
// see the Note Studio "Roadmap" panel for what real font embedding would
// take.
//
// Letter-spacing is an on-screen-only editor hint — jsPDF's base API has
// no reliable cross-font character-spacing primitive, so it is not
// reproduced here.

export type ExportPage = { pageNumber: number; elements: ModuleElementInput[] };
export type ExportBrand = {
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  tagline: string | null;
  websiteUrl: string | null;
} | null;

const MARGIN = 18;
const PAGE_WIDTH = 210; // A4 mm
const PAGE_HEIGHT = 297;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

function hexToRgb(hex: string | null | undefined): [number, number, number] | null {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return null;
  const num = parseInt(hex.slice(1), 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

async function tryFetchImageDataUrl(url: string): Promise<{ dataUrl: string; format: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") ?? "image/png";
    if (!contentType.startsWith("image/")) return null;
    const format = contentType.includes("png") ? "PNG" : contentType.includes("webp") ? "WEBP" : "JPEG";
    return { dataUrl: `data:${contentType};base64,${buf.toString("base64")}`, format };
  } catch {
    // Best-effort — a missing/unreachable image should never block export.
    return null;
  }
}

// Pulls the URL out of the `![](url)` markdown-image syntax Note Studio's
// IMAGE blocks use — the same inline-image convention the Question Bank's
// formula renderer already uses (src/lib/test-portal/formula.ts).
function extractImageUrl(content: string): string | null {
  const match = /!\[\]\((.+?)\)/.exec(content);
  return match?.[1] ?? null;
}

type TypeDefaults = {
  fontFamily: "helvetica" | "times" | "courier";
  fontSize: number;
  bold: boolean;
  italic: boolean;
  align: "left" | "center" | "right" | "justify";
  indent: number;
};

const TYPE_DEFAULTS: Record<string, TypeDefaults> = {
  HEADING: { fontFamily: "helvetica", fontSize: 15, bold: true, italic: false, align: "left", indent: 0 },
  SUBHEADING: { fontFamily: "helvetica", fontSize: 12, bold: true, italic: false, align: "left", indent: 0 },
  QUESTION: { fontFamily: "helvetica", fontSize: 11, bold: true, italic: false, align: "left", indent: 0 },
  OPTION: { fontFamily: "helvetica", fontSize: 10, bold: false, italic: false, align: "left", indent: 6 },
  SOLUTION: { fontFamily: "helvetica", fontSize: 10, bold: false, italic: true, align: "left", indent: 0 },
  EQUATION: { fontFamily: "courier", fontSize: 10, bold: false, italic: false, align: "left", indent: 4 },
  CHEMICAL_EQUATION: { fontFamily: "courier", fontSize: 10, bold: false, italic: false, align: "left", indent: 4 },
  CHEMICAL_STRUCTURE: { fontFamily: "courier", fontSize: 10, bold: false, italic: false, align: "left", indent: 4 },
  DIAGRAM: { fontFamily: "helvetica", fontSize: 10, bold: false, italic: false, align: "left", indent: 0 },
  TABLE: { fontFamily: "courier", fontSize: 9, bold: false, italic: false, align: "left", indent: 0 },
  IMAGE: { fontFamily: "helvetica", fontSize: 9, bold: false, italic: false, align: "left", indent: 0 },
  PARAGRAPH: { fontFamily: "helvetica", fontSize: 10.5, bold: false, italic: false, align: "left", indent: 0 },
  TEXT: { fontFamily: "helvetica", fontSize: 10.5, bold: false, italic: false, align: "left", indent: 0 },
};

function effectiveStyle(el: ModuleElementInput): TypeDefaults {
  const base = TYPE_DEFAULTS[el.type] ?? TYPE_DEFAULTS.TEXT!;
  const s: ModuleElementStyle = el.style ?? {};
  return {
    fontFamily: s.fontFamily ?? base.fontFamily,
    fontSize: s.fontSize ?? base.fontSize,
    bold: s.bold ?? base.bold,
    italic: s.italic ?? base.italic,
    align: s.align ?? base.align,
    indent: base.indent,
  };
}

function jsPdfFontStyle(fontFamily: string, bold: boolean, italic: boolean): string {
  if (fontFamily === "courier") {
    if (bold && italic) return "boldoblique";
    if (italic) return "oblique";
    if (bold) return "bold";
    return "normal";
  }
  if (bold && italic) return "bolditalic";
  if (italic) return "italic";
  if (bold) return "bold";
  return "normal";
}

export async function generateModulePdf(params: {
  moduleTitle: string;
  pages: ExportPage[];
  brand: ExportBrand;
  includeWatermark: boolean;
}): Promise<Buffer> {
  const doc = new jsPDF("p", "mm", "a4");
  const brandRgb = hexToRgb(params.brand?.primaryColor) ?? [17, 24, 39];
  const [pr, pg, pb] = brandRgb;
  const logo = params.brand?.logoUrl ? await tryFetchImageDataUrl(params.brand.logoUrl) : null;

  function drawHeader() {
    doc.setFillColor(pr, pg, pb);
    doc.rect(0, 0, PAGE_WIDTH, 14, "F");
    if (logo) {
      try {
        doc.addImage(logo.dataUrl, logo.format, MARGIN, 2, 10, 10);
      } catch {
        // Unsupported image format for jsPDF — skip rather than fail export.
      }
    }
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(params.brand?.name ?? "Atomic Pathshala", logo ? MARGIN + 13 : MARGIN, 9);
    doc.setTextColor(0, 0, 0);
  }

  function drawFooter(pageNumber: number) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    const footerBits = [params.brand?.tagline, params.brand?.websiteUrl].filter(Boolean).join(" · ");
    if (footerBits) doc.text(footerBits, MARGIN, PAGE_HEIGHT - 8);
    doc.text(String(pageNumber), PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 8, { align: "right" });
    doc.setTextColor(0, 0, 0);
  }

  function drawWatermark() {
    if (!params.includeWatermark) return;
    doc.saveGraphicsState();
    doc.setFont("helvetica", "normal");
    doc.setTextColor(230, 230, 230);
    doc.setFontSize(48);
    doc.text(params.brand?.name ?? "Atomic Pathshala", PAGE_WIDTH / 2, PAGE_HEIGHT / 2, {
      align: "center",
      angle: 45,
    });
    doc.restoreGraphicsState();
    doc.setTextColor(0, 0, 0);
  }

  function ensureRoom(y: number, needed: number, pageIndex: number): { y: number; pageIndex: number } {
    if (y + needed <= PAGE_HEIGHT - 20) return { y, pageIndex };
    drawFooter(pageIndex);
    doc.addPage();
    const nextIndex = pageIndex + 1;
    drawWatermark();
    drawHeader();
    return { y: 22, pageIndex: nextIndex };
  }

  function drawTable(el: ModuleElementInput, yStart: number, pageIndex: number): { y: number; pageIndex: number } {
    const rows = (el.tableData ?? []).filter((r) => r.length > 0);
    if (rows.length === 0) return { y: yStart, pageIndex };
    const cols = Math.max(...rows.map((r) => r.length));
    const colWidth = CONTENT_WIDTH / cols;
    let y = yStart;
    let idx = pageIndex;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    for (const row of rows) {
      const cellLines = row.map((cell) => doc.splitTextToSize(cell, colWidth - 3) as string[]);
      const rowHeight = Math.max(1, ...cellLines.map((l) => l.length)) * 4.2 + 2;
      const room = ensureRoom(y, rowHeight, idx);
      y = room.y;
      idx = room.pageIndex;
      for (let c = 0; c < cols; c++) {
        const x = MARGIN + c * colWidth;
        doc.rect(x, y, colWidth, rowHeight);
        const lines = cellLines[c] ?? [];
        lines.forEach((line, li) => doc.text(line, x + 1.5, y + 4 + li * 4.2));
      }
      y += rowHeight;
    }
    return { y: y + 2, pageIndex: idx };
  }

  function drawImage(el: ModuleElementInput, yStart: number, pageIndex: number, img: { dataUrl: string; format: string }): { y: number; pageIndex: number } {
    // Fixed display width, height derived from the source image's own
    // aspect ratio isn't knowable without decoding it — use a sensible
    // fixed box so layout stays predictable across arbitrary uploads.
    const displayWidth = Math.min(CONTENT_WIDTH, 100);
    const displayHeight = 60;
    const room = ensureRoom(yStart, displayHeight + 2, pageIndex);
    try {
      doc.addImage(img.dataUrl, img.format, MARGIN, room.y, displayWidth, displayHeight);
    } catch {
      // Unsupported/corrupt image — skip rather than fail the whole export.
    }
    return { y: room.y + displayHeight + 3, pageIndex: room.pageIndex };
  }

  let pageIndex = 0;
  for (const page of params.pages) {
    if (pageIndex > 0) doc.addPage();
    pageIndex++;

    drawWatermark();
    drawHeader();
    let y = 22;
    let questionNumber = 0;

    const sorted = [...page.elements].sort((a, b) => a.order - b.order);
    for (const el of sorted) {
      if (el.type === "TABLE" && el.tableData && el.tableData.length > 0) {
        const result = drawTable(el, y, pageIndex);
        y = result.y;
        pageIndex = result.pageIndex;
        continue;
      }

      if (el.type === "IMAGE") {
        const url = extractImageUrl(el.content);
        const img = url ? await tryFetchImageDataUrl(url) : null;
        if (img) {
          const result = drawImage(el, y, pageIndex, img);
          y = result.y;
          pageIndex = result.pageIndex;
          continue;
        }
        // No resolvable image URL — fall through and render the block's
        // text content (e.g. an alt-text placeholder) instead of skipping
        // it silently.
      }

      if (el.type === "EQUATION" || el.type === "CHEMICAL_EQUATION") {
        // No LaTeX typesetting engine is wired into the PDF export path
        // (see the Note Studio Roadmap panel) — the raw source renders
        // correctly on screen via KaTeX, but here it prints as styled
        // monospace source text rather than a typeset formula.
      }

      const style = effectiveStyle(el);
      const colorRgb = hexToRgb(el.style?.color);
      doc.setFont(style.fontFamily, jsPdfFontStyle(style.fontFamily, style.bold, style.italic));
      doc.setFontSize(style.fontSize);
      if (colorRgb) doc.setTextColor(colorRgb[0], colorRgb[1], colorRgb[2]);
      else doc.setTextColor(0, 0, 0);

      let prefix = "";
      if (el.type === "QUESTION") {
        prefix = `Q${questionNumber + 1}. `;
        questionNumber++;
      } else if (el.type === "SOLUTION") {
        prefix = "Solution: ";
      }

      const usableWidth = CONTENT_WIDTH - style.indent;
      const lines = doc.splitTextToSize(`${prefix}${el.content}`, usableWidth) as string[];
      const lineHeight = style.fontSize * 0.5 * (el.style?.lineHeight ?? 1);

      for (const line of lines) {
        const room = ensureRoom(y, lineHeight, pageIndex);
        y = room.y;
        pageIndex = room.pageIndex;
        if (colorRgb) doc.setTextColor(colorRgb[0], colorRgb[1], colorRgb[2]);
        doc.setFont(style.fontFamily, jsPdfFontStyle(style.fontFamily, style.bold, style.italic));
        doc.setFontSize(style.fontSize);

        if (style.align === "center") {
          doc.text(line, PAGE_WIDTH / 2, y, { align: "center" });
        } else if (style.align === "right") {
          doc.text(line, PAGE_WIDTH - MARGIN, y, { align: "right" });
        } else if (style.align === "justify") {
          doc.text(line, MARGIN + style.indent, y, { maxWidth: usableWidth, align: "justify" });
        } else {
          doc.text(line, MARGIN + style.indent, y);
        }
        y += lineHeight;
      }
      doc.setTextColor(0, 0, 0);
      y += 2; // spacing between blocks
    }

    drawFooter(pageIndex);
  }

  return Buffer.from(doc.output("arraybuffer"));
}
