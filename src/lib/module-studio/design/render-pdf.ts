import "server-only";
import { PDFDocument, PDFName, PDFArray, StandardFonts, degrees, rgb, type PDFPage, type PDFFont } from "pdf-lib";
import { launchBrowser } from "@/lib/pdf/html-to-pdf";
import { loadServerPdfJs } from "@/lib/pdf/server-pdf";
import { pageBox, type DesignGraphic, type DesignSection, type ModuleDesign } from "./model";
import { buildBodyHtml, buildCoverHtml, effectiveTheme, headerFooterTemplates, type ChapterInfo } from "./render-html";
import { sourceHeaderFooterCount, type ContentPage } from "./content";

/**
 * Designed module → PDF.
 *
 *  1. Cover: its own one-page document (free positioning works there).
 *  2. Body: every other section in one document, so page numbers run on;
 *     header/footer/page numbers from Chromium's page templates. The
 *     contents page is filled in a second pass with the real page numbers,
 *     read from the PDF's named destinations (works for Hindi headings too —
 *     no text search).
 *  3. Blocks that are taller than a page are found before printing and
 *     allowed to continue on the next page — and reported; nothing is clipped.
 *  4. Background, watermark and master-page graphics are drawn onto every
 *     body page with pdf-lib (Chromium does not repeat fixed elements
 *     reliably). Print mode adds bleed, trim/bleed boxes and crop marks.
 */

export type IssueCategory = "OVERFLOW" | "MISSING_ASSET" | "BROKEN_IMAGE" | "FONT" | "EMPTY_PAGE" | "PAGE_SIZE" | "EXTRACTION" | "SPLIT" | "CONTENT" | "OUTPUT";
/** "error": something will be wrong or missing in the PDF — export asks first. "warning": check it. "info": good to know. */
export type ExportIssue = { category: IssueCategory; severity: "error" | "warning" | "info"; message: string };
type Sink = (category: IssueCategory, severity: ExportIssue["severity"], message: string) => void;

export type RenderResult = {
  pdf: Buffer;
  pageCount: number;
  warnings: string[];
  issues: ExportIssue[];
  sections: { id: string; title: string; firstPage: number; lastPage: number }[];
  contents: { label: string; page: number | null }[];
  timings: Record<string, number>;
};

const MM = 72 / 25.4;
const PX_PER_MM = 96 / 25.4;

type BodyPass = { pdf: Buffer; dests: Record<string, number>; tooTall: string[]; images: string[]; fonts: string[]; clipped: string[] };

async function printBody(browser: any, html: string, d: ModuleDesign, contentHeightPx: number, hf: { headerTemplate: string; footerTemplate: string }): Promise<BodyPass> {
  const page = await browser.newPage();
  try {
    await page.emulateMediaType("print");
    await page.setViewport({ width: Math.round((pageBox(d).w - d.page.marginLeftMm - d.page.marginRightMm) * PX_PER_MM), height: 1200 });
    await page.setContent(html, { waitUntil: "load", timeout: 90_000 });
    await page.evaluate(() => (document as any).fonts.ready);
    await page.evaluate(async () => {
      await Promise.all(Array.from(document.images).map((img) => (img.complete ? null : new Promise((r) => ((img.onload = r), (img.onerror = r))))));
    });
    // Blocks taller than a page cannot be kept together: let them continue on the next page and say so.
    const fonts = await missingFonts(page, d);
    const { tooTall, images, clipped } = await page.evaluate((limit: number) => {
      const tall: string[] = [];
      document.querySelectorAll<HTMLElement>('[data-keep="1"]').forEach((el) => {
        if (el.getBoundingClientRect().height > limit) {
          el.setAttribute("data-split", "1");
          tall.push(el.getAttribute("data-label") || "A block");
        }
      });
      const broken = Array.from(document.images).filter((i) => !i.naturalWidth).map((i) => i.src.slice(0, 120));
      // Content wider than its box is cut off at the edge (e.g. a very wide table or a long formula).
      const cut: string[] = [];
      document.querySelectorAll<HTMLElement>(".table-wrap, .q-card, .callout, .equation, .formula-card, .figure, .option").forEach((el) => {
        if (el.scrollWidth > el.clientWidth + 2) {
          const owner = el.closest("[data-label]") as HTMLElement | null;
          cut.push((el.getAttribute("data-label") || owner?.getAttribute("data-label") || el.className.split(" ")[0] || "A block") + "");
        }
      });
      return { tooTall: tall, images: broken, clipped: [...new Set(cut)] };
    }, contentHeightPx);
    const pdf = Buffer.from(await page.pdf({ preferCSSPageSize: true, printBackground: true, displayHeaderFooter: true, ...hf, timeout: 120_000 }));
    return { pdf, dests: await destinations(pdf), tooTall, images, fonts, clipped };
  } finally {
    await page.close().catch(() => undefined);
  }
}

/** Fonts of the design the browser could not load (it then uses a fallback). */
async function missingFonts(page: any, d: ModuleDesign): Promise<string[]> {
  const fams = [...new Set([d.theme.headingFont, d.theme.bodyFont, ...d.sections.flatMap((s) => [s.themeOverride?.headingFont, s.themeOverride?.bodyFont]), "Noto Sans Devanagari"].filter(Boolean) as string[])];
  // A family is missing when its stylesheet brought no faces at all, or when its faces failed to load.
  // Faces never needed (e.g. the Devanagari part of a font in an English-only module) stay "unloaded" — that is fine.
  return page.evaluate((list: string[]) => {
    const faces = Array.from((document as any).fonts as Iterable<any>);
    return list.filter((f) => {
      const mine = faces.filter((x) => String(x.family).replace(/["']/g, "") === f);
      return mine.length === 0 || (mine.some((x) => x.status === "error") && !mine.some((x) => x.status === "loaded"));
    });
  }, fams);
}

async function printCover(browser: any, html: string): Promise<{ pdf: Buffer; brokenImages: string[] }> {
  const page = await browser.newPage();
  try {
    await page.emulateMediaType("print");
    await page.setContent(html, { waitUntil: "load", timeout: 60_000 });
    await page.evaluate(() => (document as any).fonts.ready);
    await page.evaluate(async () => {
      await Promise.all(Array.from(document.images).map((img) => (img.complete ? null : new Promise((r) => ((img.onload = r), (img.onerror = r))))));
    });
    const brokenImages: string[] = await page.evaluate(() => Array.from(document.images).filter((i) => !i.naturalWidth).map((i) => i.src.slice(0, 120)));
    return { pdf: Buffer.from(await page.pdf({ preferCSSPageSize: true, printBackground: true, pageRanges: "1", timeout: 60_000 })), brokenImages };
  } finally {
    await page.close().catch(() => undefined);
  }
}

/** Anchor id → 1-based page, from the PDF's named destinations. */
async function destinations(pdf: Buffer): Promise<Record<string, number>> {
  const pdfjs = await loadServerPdfJs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf), verbosity: 0 }).promise;
  try {
    const all = (await doc.getDestinations()) as Record<string, any[]>;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(all)) {
      try {
        out[k] = (await doc.getPageIndex(v[0])) + 1;
      } catch {}
    }
    return out;
  } finally {
    await doc.destroy();
  }
}

const hexRgb = (h: string) => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);

/** Draws `fn` underneath the page's existing content (for backgrounds and watermarks). */
function drawBehind(doc: PDFDocument, page: PDFPage, fn: (p: PDFPage) => void) {
  const before = page.node.Contents();
  const beforeRefs = before instanceof PDFArray ? before.asArray() : before ? [page.node.get(PDFName.of("Contents"))!] : [];
  fn(page);
  const after = page.node.Contents();
  const afterRefs = after instanceof PDFArray ? after.asArray() : [];
  const added = afterRefs.filter((r) => !beforeRefs.includes(r));
  page.node.set(PDFName.of("Contents"), doc.context.obj([...added, ...afterRefs.filter((r) => !added.includes(r))]));
  // the next drawing must start a new content stream on top again
  (page as any).contentStream = undefined;
  (page as any).contentStreamRef = undefined;
}

async function fetchImage(doc: PDFDocument, url: string, cache: Map<string, any>, issue: Sink) {
  if (cache.has(url)) return cache.get(url);
  let img: any = null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf[0] === 0x89 && buf[1] === 0x50) img = await doc.embedPng(buf);
    else if (buf[0] === 0xff && buf[1] === 0xd8) img = await doc.embedJpg(buf);
    else issue("MISSING_ASSET", "error", `A page graphic is not PNG or JPEG and is missing from the PDF: ${url.slice(0, 80)}`);
  } catch (e: any) {
    issue("MISSING_ASSET", "error", `A page graphic could not be loaded (${e?.message ?? e}) and is missing from the PDF: ${url.slice(0, 80)}`);
  }
  cache.set(url, img);
  return img;
}

function latin(font: PDFFont, s: string, issue: Sink, what: string) {
  let out = "";
  let bad = 0;
  for (const ch of s) {
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      bad++;
    }
  }
  if (bad) issue("FONT", "warning", `${what}: ${bad} character(s) (e.g. Hindi) cannot be drawn on every page with the built-in PDF font and were left out — use a picture, or put Hindi text in the header/footer instead.`);
  return out;
}

/** Loads the pictures a set of graphics needs (so drawing them can be synchronous). */
async function loadGraphicImages(doc: PDFDocument, gs: DesignGraphic[], logoUrl: string | null, cache: Map<string, any>, issue: Sink) {
  for (const g of gs) {
    const src = g.kind === "LOGO" ? logoUrl : g.kind === "IMAGE" ? g.src : null;
    if (src) await fetchImage(doc, src, cache, issue);
  }
}

function drawGraphic(page: PDFPage, g: DesignGraphic, bleed: number, logoUrl: string | null, font: PDFFont, cache: Map<string, any>, issue: Sink) {
  const H = page.getHeight();
  const x = (g.x + bleed) * MM;
  const yTop = (g.y + bleed) * MM;
  const w = g.w * MM;
  const h = g.h * MM;
  const y = H - yTop - h;
  const opacity = g.opacity ?? 1;
  if (g.kind === "LOGO" || g.kind === "IMAGE") {
    const src = g.kind === "LOGO" ? logoUrl : g.src;
    if (!src) return;
    const img = cache.get(src);
    if (!img) return;
    const s = Math.min(w / img.width, h / img.height);
    page.drawImage(img, { x: x + (w - img.width * s) / 2, y: y + (h - img.height * s) / 2, width: img.width * s, height: img.height * s, opacity });
  } else if (g.kind === "RECT") {
    page.drawRectangle({ x, y, width: w, height: h, color: g.fill ? hexRgb(g.fill) : undefined, borderColor: g.stroke ? hexRgb(g.stroke) : undefined, borderWidth: g.stroke ? g.strokeWidthPt ?? 1 : 0, opacity, borderOpacity: opacity });
  } else if (g.kind === "ELLIPSE") {
    page.drawEllipse({ x: x + w / 2, y: y + h / 2, xScale: w / 2, yScale: h / 2, color: g.fill ? hexRgb(g.fill) : undefined, borderColor: g.stroke ? hexRgb(g.stroke) : undefined, borderWidth: g.stroke ? g.strokeWidthPt ?? 1 : 0, opacity, borderOpacity: opacity });
  } else if (g.kind === "LINE") {
    page.drawLine({ start: { x, y: y + h }, end: { x: x + w, y }, thickness: g.strokeWidthPt ?? 1, color: hexRgb(g.stroke ?? "#000000"), opacity });
  } else if (g.kind === "TEXT" && g.text) {
    const size = g.fontSizePt ?? 12;
    const text = latin(font, g.text, issue, "A text graphic on the page template");
    const tw = font.widthOfTextAtSize(text, size);
    const tx = g.align === "center" ? x + (w - tw) / 2 : g.align === "right" ? x + w - tw : x;
    page.drawText(text, { x: tx, y: y + h - size, size, font, color: hexRgb(g.color ?? "#000000"), opacity });
  }
}

function drawBackground(page: PDFPage, kind: string, t: { primary: string; soft: string; paper: string }, bleed: number) {
  const W = page.getWidth();
  const H = page.getHeight();
  if (t.paper.toLowerCase() !== "#ffffff") page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: hexRgb(t.paper) });
  const c = hexRgb(t.primary);
  if (kind === "TINT") page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: hexRgb(t.soft) });
  else if (kind === "GRID" || kind === "LINES") {
    const step = 5 * MM;
    for (let y = bleed * MM; y < H; y += step) page.drawLine({ start: { x: 0, y }, end: { x: W, y }, thickness: 0.3, color: c, opacity: 0.12 });
    if (kind === "GRID") for (let x = bleed * MM; x < W; x += step) page.drawLine({ start: { x, y: 0 }, end: { x, y: H }, thickness: 0.3, color: c, opacity: 0.12 });
  } else if (kind === "DOTS") {
    const step = 5 * MM;
    for (let y = step; y < H; y += step) for (let x = step; x < W; x += step) page.drawCircle({ x, y, size: 0.35, color: c, opacity: 0.25 });
  }
}

function drawWatermark(page: PDFPage, d: ModuleDesign, font: PDFFont, img: any, issue: Sink) {
  const W = page.getWidth();
  const H = page.getHeight();
  const wm = d.watermark;
  const a = (wm.angle * Math.PI) / 180;
  if (img) {
    const w = Math.min(W, H) * 0.55;
    const s = w / img.width;
    const ih = img.height * s;
    // centred, turned around the page centre
    const cx = W / 2 - (w / 2) * Math.cos(a) + (ih / 2) * Math.sin(a);
    const cy = H / 2 - (w / 2) * Math.sin(a) - (ih / 2) * Math.cos(a);
    page.drawImage(img, { x: cx, y: cy, width: w, height: ih, rotate: degrees(wm.angle), opacity: wm.opacity });
  } else if (wm.text) {
    const text = latin(font, wm.text, issue, "The watermark text");
    const size = Math.min(W, H) / Math.max(6, text.length * 0.62);
    const tw = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: W / 2 - (tw / 2) * Math.cos(a) + (size / 3) * Math.sin(a), y: H / 2 - (tw / 2) * Math.sin(a) - (size / 3) * Math.cos(a), size, font, color: hexRgb(d.theme.primary), rotate: degrees(wm.angle), opacity: wm.opacity });
  }
}

function cropMarks(page: PDFPage, bleed: number) {
  const W = page.getWidth();
  const H = page.getHeight();
  const b = bleed * MM;
  const len = Math.min(b - 1, 5 * MM);
  if (len <= 0) return;
  const k = rgb(0, 0, 0);
  for (const [x, y] of [[b, b], [W - b, b], [b, H - b], [W - b, H - b]] as const) {
    const sx = x < W / 2 ? -1 : 1;
    const sy = y < H / 2 ? -1 : 1;
    page.drawLine({ start: { x: x + sx * 1, y }, end: { x: x + sx * (1 + len), y }, thickness: 0.25, color: k });
    page.drawLine({ start: { x, y: y + sy * 1 }, end: { x, y: y + sy * (1 + len) }, thickness: 0.25, color: k });
  }
}

/**
 * Opens the finished PDF the way a reader would and checks it: it must load,
 * every page must have the designed size, and no page may be empty apart
 * from its header and footer.
 */
async function checkOutput(pdf: Buffer, d: ModuleDesign, coverCount: number, bodyPdf: Buffer): Promise<ExportIssue[]> {
  const out: ExportIssue[] = [];
  const pdfjs = await loadServerPdfJs();
  let doc: any;
  try {
    doc = await pdfjs.getDocument({ data: new Uint8Array(pdf), verbosity: 0 }).promise;
  } catch (e: any) {
    throw new Error(`The generated PDF could not be opened (${e?.message ?? e}) — nothing was exported.`);
  }
  try {
    if (!doc.numPages) throw new Error("The generated PDF has no pages — nothing was exported.");
    const bleed = d.output.mode === "PRINT" ? d.output.bleedMm : 0;
    const { w, h } = pageBox(d);
    const want = { w: (w + 2 * bleed) * MM, h: (h + 2 * bleed) * MM };
    const top = (d.page.marginTopMm + bleed) * MM;
    const bottom = (d.page.marginBottomMm + bleed) * MM;
    const badSize: number[] = [];
    const empty: number[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const [x0 = 0, y0 = 0, x1 = 0, y1 = 0] = page.view as number[];
      if (Math.abs(x1 - x0 - want.w) > 1.5 || Math.abs(y1 - y0 - want.h) > 1.5) badSize.push(n);
      page.cleanup();
    }
    // Empty pages are judged on the laid-out body, before the watermark and page graphics are drawn on.
    const body = await pdfjs.getDocument({ data: new Uint8Array(bodyPdf), verbosity: 0 }).promise;
    for (let n = 1; n <= body.numPages; n++) {
      const page = await body.getPage(n);
      const [, y0b = 0, , y1b = 0] = page.view as number[];
      const text = await page.getTextContent();
      const pageH = y1b - y0b;
      // text inside the content area (not the header/footer bands)
      const inside = (text.items as any[]).filter((it) => it.str?.trim() && it.transform[5] > bottom && it.transform[5] < pageH - top);
      if (!inside.length) {
        const ops = await page.getOperatorList();
        const images = ops.fnArray.filter((f: number) => f === pdfjs.OPS.paintImageXObject || f === pdfjs.OPS.paintInlineImageXObject).length;
        if (!images) empty.push(n + coverCount);
      }
      page.cleanup();
    }
    await body.destroy();
    if (badSize.length) out.push({ category: "PAGE_SIZE", severity: "error", message: `Page(s) ${badSize.join(", ")} do not have the designed page size.` });
    if (empty.length) out.push({ category: "EMPTY_PAGE", severity: "warning", message: `Page(s) ${empty.join(", ")} have nothing on them except the header and footer (often a page break right before a section start). Check the page breaks.` });
  } finally {
    await doc.destroy();
  }
  return out;
}

export async function renderModuleDesignPdf(input: { design: ModuleDesign; pages: ContentPage[]; chapter?: ChapterInfo | null }): Promise<RenderResult> {
  const t0 = Date.now();
  const timings: Record<string, number> = {};
  const { design: d, pages } = input;
  const issues: ExportIssue[] = [];
  const issue: Sink = (category, severity, message) => {
    if (!issues.some((i) => i.message === message)) issues.push({ category, severity, message });
  };
  const quiet: Sink = () => undefined; // same message on every page: report it once
  const bleed = d.output.mode === "PRINT" ? d.output.bleedMm : 0;
  const { w, h } = pageBox(d);
  const contentHeightPx = (h - d.page.marginTopMm - d.page.marginBottomMm) * PX_PER_MM;
  const enabled = d.sections.filter((s) => s.enabled);
  const covers = enabled.filter((s) => s.kind === "COVER");
  if (covers.length > 1) issue("CONTENT", "warning", "Only the first cover page is used.");
  const cover = covers[0];

  const devanagari = /[ऀ-ॿ]/;
  if (pages.some((pg) => pg.elements.some((e) => devanagari.test(e.content))) || devanagari.test(JSON.stringify(d.setup)))
    issue("FONT", "info", "Hindi text prints correctly, but copying or searching Hindi in this PDF can lose some letters (a limit of the browser's PDF text layer). The printed and on-screen text is right.");
  const hfLines = sourceHeaderFooterCount(pages);
  if (hfLines) issue("CONTENT", "info", `${hfLines} running header/footer line(s) of the original PDF are not printed — this design has its own header and footer.`);

  const browser = await launchBrowser();
  let coverPdf: Buffer | null = null;
  let coverImages: string[] = [];
  let body: BodyPass;
  let built: ReturnType<typeof buildBodyHtml>;
  try {
    if (cover) {
      const c = await printCover(browser, buildCoverHtml(d, cover));
      coverPdf = c.pdf;
      coverImages = c.brokenImages;
      timings.coverMs = Date.now() - t0;
    }
    const hf = headerFooterTemplates(d);
    built = buildBodyHtml(d, pages, { chapter: input.chapter });
    for (const s of built.skipped) issue("EMPTY_PAGE", "info", `"${s}" has nothing to show for this module's content and was left out (no blank pages).`);
    const hasToc = enabled.some((s) => s.kind === "CONTENTS");
    body = await printBody(browser, built.html, d, contentHeightPx, hf);
    timings.bodyPass1Ms = Date.now() - t0;
    if (hasToc && built.toc.length) {
      // Fill the contents with real numbers; repeat if that moved anything (rare: a line wrapped differently).
      for (let pass = 0; pass < 3; pass++) {
        // printed page numbers count body pages (the cover is not numbered), the same as the footer
        const numbers = Object.fromEntries(built.toc.map((e) => [e.anchor, body.dests[e.anchor] ?? null]).filter(([, v]) => v != null)) as Record<string, number>;
        const again = buildBodyHtml(d, pages, { chapter: input.chapter, tocPages: numbers });
        const next = await printBody(browser, again.html, d, contentHeightPx, hf);
        const stable = built.toc.every((e) => next.dests[e.anchor] === body.dests[e.anchor]);
        body = next;
        built = again;
        if (stable) break;
      }
      timings.bodyFinalMs = Date.now() - t0;
    }
  } finally {
    await browser.close().catch(() => undefined);
  }

  for (const l of body.tooTall) issue("OVERFLOW", "warning", `${l} is taller than one page, so it continues on the next page (it was not cut off). Shorten it or split it into parts to keep it on one page.`);
  for (const u of [...body.images, ...coverImages]) issue("BROKEN_IMAGE", "error", `A picture could not be loaded and is missing from the PDF: ${u}`);
  for (const c of body.clipped) issue("OVERFLOW", "error", `${c}: its content is wider than the page column and the right edge is cut off. Make the table/formula narrower (fewer columns, smaller text) or use one column.`);
  for (const f of body.fonts) issue("FONT", "warning", `The font "${f}" could not be loaded, so a fallback font was used — the PDF will not look exactly as designed.`);
  const missing = built.toc.filter((e) => body.dests[e.anchor] == null);
  if (missing.length) issue("CONTENT", "warning", `${missing.length} contents entr${missing.length > 1 ? "ies" : "y"} could not be given a page number and show none.`);

  // ---- assemble
  const out = await PDFDocument.create();
  out.setTitle(d.setup.title);
  out.setAuthor(d.setup.author || "Atomic Pathshala");
  out.setSubject([d.setup.subject, d.setup.chapterName].filter(Boolean).join(" — "));
  out.setCreator("Atomic Pathshala Module Studio");
  const font = await out.embedFont(StandardFonts.HelveticaBold);
  const cache = new Map<string, any>();
  if (coverPdf) {
    const src = await PDFDocument.load(coverPdf);
    const [p] = await out.copyPages(src, [0]);
    out.addPage(p!);
  }
  const bodyDoc = await PDFDocument.load(body.pdf);
  const bodyPages = await out.copyPages(bodyDoc, bodyDoc.getPageIndices());
  bodyPages.forEach((p) => out.addPage(p));
  const coverCount = coverPdf ? 1 : 0;

  // which section each body page belongs to
  const starts = built.sectionAnchors.map((a) => ({ anchor: a, page: body.dests[a] ?? null })).filter((x): x is { anchor: string; page: number } => x.page != null);
  const sectionOf = (bodyPage: number): DesignSection | undefined => {
    let cur: string | undefined;
    for (const s of starts) if (s.page <= bodyPage) cur = s.anchor;
    return enabled.find((s) => `sec-${s.id}` === cur);
  };
  const wmImg = d.watermark.enabled && d.watermark.imageUrl ? await fetchImage(out, d.watermark.imageUrl, cache, issue) : null;
  const all = out.getPages();
  for (let i = 0; i < all.length; i++) {
    const page = all[i]!;
    const isCover = i < coverCount;
    const sec = isCover ? cover : sectionOf(i - coverCount + 1);
    const t = effectiveTheme(d, sec);
    if (!isCover) {
      const behind = (sec?.graphics ?? []).filter((g) => g.z < 0).sort((a, b) => a.z - b.z);
      const needsBehind = t.background !== "PLAIN" || t.paper.toLowerCase() !== "#ffffff" || d.watermark.enabled || behind.length;
      if (needsBehind) {
        await loadGraphicImages(out, behind, d.setup.logoUrl, cache, issue);
        drawBehind(out, page, (p) => {
          drawBackground(p, t.background, t, bleed);
          if (d.watermark.enabled) drawWatermark(p, d, font, wmImg, i === coverCount ? issue : quiet);
          for (const g of behind) drawGraphic(p, g, bleed, d.setup.logoUrl, font, cache, i === coverCount ? issue : quiet);
        });
      }
      const front = (sec?.graphics ?? []).filter((x) => x.z >= 0).sort((a, b) => a.z - b.z);
      await loadGraphicImages(out, front, d.setup.logoUrl, cache, issue);
      for (const g of front) drawGraphic(page, g, bleed, d.setup.logoUrl, font, cache, i === coverCount ? issue : quiet);
    }
    if (bleed > 0) {
      page.setBleedBox(0, 0, page.getWidth(), page.getHeight());
      page.setTrimBox(bleed * MM, bleed * MM, w * MM, h * MM);
      if (d.output.cropMarks) cropMarks(page, bleed);
    }
  }

  const pdf = Buffer.from(await out.save());
  timings.totalMs = Date.now() - t0;
  const pageNo = (anchor: string) => (body.dests[anchor] != null ? body.dests[anchor]! : null);
  const sections = enabled
    .filter((s) => s.kind === "COVER" ? !!coverPdf && s === cover : starts.some((x) => x.anchor === `sec-${s.id}`))
    .map((s) => {
      if (s.kind === "COVER") return { id: s.id, title: s.title, firstPage: 1, lastPage: 1 };
      const idx = starts.findIndex((x) => x.anchor === `sec-${s.id}`);
      const first = starts[idx]!.page + coverCount;
      const last = (starts[idx + 1]?.page ?? bodyPages.length + 1) - 1 + coverCount;
      return { id: s.id, title: s.title, firstPage: first, lastPage: Math.max(first, last) };
    });
  if (d.output.mode === "PRINT") issue("OUTPUT", "info", "Print PDF: colours are RGB (no CMYK conversion) and the file is not checked against PDF/X — ask the printer whether RGB is fine.");
  for (const x of await checkOutput(pdf, d, coverCount, body.pdf)) issue(x.category, x.severity, x.message);
  return { pdf, pageCount: all.length, warnings: issues.map((i) => i.message), issues, sections, contents: built.toc.map((e) => ({ label: e.label, page: pageNo(e.anchor) })), timings };
}
