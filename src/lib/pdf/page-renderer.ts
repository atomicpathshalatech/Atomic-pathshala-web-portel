import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { launchBrowser } from "@/lib/pdf/html-to-pdf";

/**
 * Renders PDF pages in headless Chromium with pdf.js — page images for the
 * AI to look at, each page's own text layer, and pixel-exact crops of any
 * region (figures, structures, diagrams).
 *
 * Pages are rendered one at a time on demand and released after use, so a
 * 100-page book never holds 100 full-resolution canvases in memory.
 *
 * Code passed to page.evaluate() avoids named inner functions: bundlers may
 * wrap those with helpers that don't exist inside the page.
 */

export type Box = [number, number, number, number]; // [ymin, xmin, ymax, xmax], 0–1000

export type RenderedPdf = {
  pageCount: number;
  /** Renders page `n` (1-based) at full resolution and keeps it until release(n). */
  render(n: number): Promise<{ width: number; height: number }>;
  /** A JPEG of a rendered page, at most `maxHeight` px tall (base64, no data: prefix). */
  jpeg(n: number, maxHeight?: number): Promise<string>;
  /** The page's text layer (empty for scanned pages). */
  text(n: number): Promise<string>;
  /** PNG crop of a rendered page; with grow, edges move out past ink to a clear gap. */
  crop(n: number, box: Box, opts?: { grow?: boolean }): Promise<Buffer | null>;
  release(n: number): Promise<void>;
};

const RENDER_SCALE = 2.5; // ~180 dpi: sharp bonds, subscripts and small print

function moduleDataUrl(path: string) {
  return `data:text/javascript;base64,${readFileSync(path).toString("base64")}`;
}

export async function withRenderedPdf<T>(pdf: Buffer, fn: (doc: RenderedPdf) => Promise<T>): Promise<T> {
  // Traced into the routes that use this (next.config.mjs outputFileTracingIncludes).
  const dir = join(process.cwd(), "node_modules", "pdfjs-dist", "build");
  const mainUrl = moduleDataUrl(join(dir, "pdf.min.mjs"));
  const workerUrl = moduleDataUrl(join(dir, "pdf.worker.min.mjs"));
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent("<!doctype html><html><body></body></html>");
    await page.addScriptTag({
      type: "module",
      content: `import * as P from "${mainUrl}"; P.GlobalWorkerOptions.workerSrc = "${workerUrl}"; window.__pdfjs = P;`,
    });
    await page.waitForFunction("window.__pdfjs", { timeout: 20_000 });

    const pageCount: number = await page.evaluate(async (b64: string) => {
      const P = (window as any).__pdfjs;
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const doc = await P.getDocument({ data: bytes }).promise;
      (window as any).__doc = doc;
      (window as any).__canvases = {};
      return doc.numPages as number;
    }, pdf.toString("base64"));

    const doc = makeDoc(page, pageCount);
    return await fn(doc);
  } finally {
    await browser.close().catch(() => undefined);
  }
}

type PuppeteerPage = Awaited<ReturnType<Awaited<ReturnType<typeof launchBrowser>>["newPage"]>>;

function makeDoc(page: PuppeteerPage, pageCount: number): RenderedPdf {
  const doc: RenderedPdf = {
    pageCount,
    async render(n) {
      return page.evaluate(
        async (n: number, scale: number) => {
          const w = window as any;
          if (w.__canvases[n]) return { width: w.__canvases[n].width, height: w.__canvases[n].height };
          const pg = await w.__doc.getPage(n);
          const vp = pg.getViewport({ scale });
          const c = document.createElement("canvas");
          c.width = Math.ceil(vp.width);
          c.height = Math.ceil(vp.height);
          const ctx = c.getContext("2d", { willReadFrequently: true })!;
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, c.width, c.height);
          await pg.render({ canvasContext: ctx, viewport: vp }).promise;
          w.__canvases[n] = c;
          return { width: c.width, height: c.height };
        },
        n,
        RENDER_SCALE
      );
    },
    async jpeg(n, maxHeight = 1600) {
      await doc.render(n);
      const url: string = await page.evaluate(
        (n: number, maxHeight: number) => {
          const c = (window as any).__canvases[n] as HTMLCanvasElement;
          const s = document.createElement("canvas");
          const k = Math.min(1, maxHeight / c.height);
          s.width = Math.round(c.width * k);
          s.height = Math.round(c.height * k);
          s.getContext("2d")!.drawImage(c, 0, 0, s.width, s.height);
          return s.toDataURL("image/jpeg", 0.85);
        },
        n,
        maxHeight
      );
      return url.replace(/^data:[^,]+,/, "");
    },
    async text(n) {
      return page.evaluate(async (n: number) => {
        const pg = await (window as any).__doc.getPage(n);
        const content = await pg.getTextContent();
        let out = "";
        let lastY: number | null = null;
        for (const item of content.items as any[]) {
          if (!("str" in item)) continue;
          const y = item.transform ? item.transform[5] : null;
          if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) out += "\n";
          else if (out && !out.endsWith(" ")) out += " ";
          out += item.str;
          lastY = y;
        }
        return out.replace(/[ \t]+/g, " ").trim();
      }, n);
    },
    async crop(n, box, opts = {}) {
      await doc.render(n);
      const dataUrl: string | null = await page.evaluate(
        (n: number, box: number[], grow: boolean) => {
          const c = (window as any).__canvases[n] as HTMLCanvasElement | undefined;
          if (!c) return null;
          const pad = grow ? 0.004 : 0.012;
          let y0 = Math.round(Math.max(0, box[0]! / 1000 - pad) * c.height);
          let x0 = Math.round(Math.max(0, box[1]! / 1000 - pad) * c.width);
          let y1 = Math.round(Math.min(1, box[2]! / 1000 + pad) * c.height);
          let x1 = Math.round(Math.min(1, box[3]! / 1000 + pad) * c.width);
          if (grow) {
            // Push each edge outwards while it still cuts through ink; a
            // label can sit a few px from its bond, so stop only after a
            // clear gap of GAP blank lines. Growth is capped.
            const px = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
            const W = c.width;
            const GAP = Math.max(6, Math.round(c.height * 0.006));
            const maxX = Math.round(c.width * 0.12);
            const maxY = Math.round(c.height * 0.06);
            for (let pass = 0; pass < 2; pass++) {
              for (let side = 0; side < 4; side++) {
                const vertical = side < 2;
                const limit = vertical ? c.height : c.width;
                const dir = side === 0 || side === 2 ? -1 : 1;
                let grown = 0;
                // Only an edge that cuts through the drawing moves: one
                // sitting in white space next to a text line stays put.
                let first = true;
                while (grown < (vertical ? maxY : maxX)) {
                  const edge = side === 0 ? y0 : side === 1 ? y1 : side === 2 ? x0 : x1;
                  const from = vertical ? x0 : y0;
                  const to = vertical ? x1 : y1;
                  let found = -1;
                  for (let d = 0; d < (first ? 1 : GAP) && found < 0; d++) {
                    const line = edge + dir * d;
                    if (line < 0 || line > limit - 1) break;
                    for (let k = from; k < to; k++) {
                      const i = (vertical ? line * W + k : k * W + line) * 4;
                      if (px[i]! + px[i + 1]! + px[i + 2]! < 600) {
                        found = d;
                        break;
                      }
                    }
                  }
                  if (found < 0) break;
                  first = false;
                  const step = found + 1;
                  if (side === 0) y0 = Math.max(0, y0 - step);
                  else if (side === 1) y1 = Math.min(limit - 1, y1 + step);
                  else if (side === 2) x0 = Math.max(0, x0 - step);
                  else x1 = Math.min(limit - 1, x1 + step);
                  grown += step;
                  if ((side === 0 && y0 === 0) || (side === 2 && x0 === 0) || (side === 1 && y1 === limit - 1) || (side === 3 && x1 === limit - 1)) break;
                }
              }
            }
            // A full-width line of text glued to the top or bottom of the
            // crop (the sentence before the figure, a caption) is cut off:
            // a band of ink rows, separated from the rest by a blank gap,
            // that is short like a text line and spans most of the crop.
            // A small label (the O of a C=O) is narrow, so it stays.
            const rowHas: boolean[] = [];
            const rowMinX: number[] = [];
            const rowMaxX: number[] = [];
            for (let y = y0; y < y1; y++) {
              let mn = -1;
              let mx = -1;
              for (let x = x0; x < x1; x++) {
                const i = (y * W + x) * 4;
                if (px[i]! + px[i + 1]! + px[i + 2]! < 600) {
                  if (mn < 0) mn = x;
                  mx = x;
                }
              }
              rowHas.push(mn >= 0);
              rowMinX.push(mn);
              rowMaxX.push(mx);
            }
            const bands: { s: number; e: number; minX: number; maxX: number }[] = [];
            for (let r = 0; r < rowHas.length; r++) {
              if (!rowHas[r]) continue;
              const last = bands[bands.length - 1];
              // Rows a few px apart (a letter and its descender) are one band.
              if (last && r - last.e <= 5) {
                last.e = r;
                last.minX = Math.min(last.minX, rowMinX[r]!);
                last.maxX = Math.max(last.maxX, rowMaxX[r]!);
              } else bands.push({ s: r, e: r, minX: rowMinX[r]!, maxX: rowMaxX[r]! });
            }
            // A pasted screenshot is small: use pixel minimums there.
              const isImage = !(window as any).__doc;
              const lineH = isImage ? Math.max(c.height * 0.022, 30) : c.height * 0.022;
            const wideMin = (x1 - x0) * 0.55;
            while (
              bands.length > 1 &&
              bands[0]!.e - bands[0]!.s < lineH &&
              bands[0]!.maxX - bands[0]!.minX > wideMin &&
              bands[1]!.s - bands[0]!.e > 4
            ) {
              bands.shift();
            }
            while (
              bands.length > 1 &&
              bands[bands.length - 1]!.e - bands[bands.length - 1]!.s < lineH &&
              bands[bands.length - 1]!.maxX - bands[bands.length - 1]!.minX > wideMin &&
              bands[bands.length - 1]!.s - bands[bands.length - 2]!.e > 4
            ) {
              bands.pop();
            }
            // A speck left over at the very top/bottom (a cut-off descender
            // or dot of the text line) goes too.
            const speck = isImage ? Math.max(c.height * 0.003, 3) : c.height * 0.003;
            while (bands.length > 1 && bands[0]!.e - bands[0]!.s < speck && bands[1]!.s - bands[0]!.e > 4) bands.shift();
            while (bands.length > 1 && bands[bands.length - 1]!.e - bands[bands.length - 1]!.s < speck && bands[bands.length - 1]!.s - bands[bands.length - 2]!.e > 4) bands.pop();
            if (bands.length) {
              // Tighten to the drawing that is left, on all four sides.
              const top = bands[0]!.s;
              const bottom = bands[bands.length - 1]!.e;
              let left = Infinity;
              let right = -1;
              for (const b of bands) {
                left = Math.min(left, b.minX);
                right = Math.max(right, b.maxX);
              }
              y1 = y0 + bottom + 1;
              y0 = y0 + top;
              if (right >= left) {
                x0 = left;
                x1 = right + 1;
              }
            }
            const m = Math.round(c.width * 0.006);
            x0 = Math.max(0, x0 - m);
            y0 = Math.max(0, y0 - m);
            x1 = Math.min(c.width, x1 + m);
            y1 = Math.min(c.height, y1 + m);
          }
          if (x1 - x0 < 4 || y1 - y0 < 4) return null;
          const out = document.createElement("canvas");
          out.width = x1 - x0;
          out.height = y1 - y0;
          out.getContext("2d")!.drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
          return out.toDataURL("image/png");
        },
        n,
        box,
        opts.grow ?? true
      );
      return dataUrl ? Buffer.from(dataUrl.split(",")[1]!, "base64") : null;
    },
    async release(n) {
      await page.evaluate((n: number) => {
        delete (window as any).__canvases[n];
      }, n);
    },
  };
  return doc;
}

/**
 * Same as withRenderedPdf for a single image (a pasted screenshot of a
 * question): page 1 is the image at its own resolution, so crops are exact.
 */
export async function withRenderedImage<T>(image: Buffer, mimeType: string, fn: (doc: RenderedPdf) => Promise<T>): Promise<T> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent("<!doctype html><html><body></body></html>");
    const ok: boolean = await page.evaluate(async (dataUrl: string) => {
      const img = new Image();
      img.src = dataUrl;
      try {
        await img.decode();
      } catch {
        return false;
      }
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d", { willReadFrequently: true })!;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0);
      (window as any).__doc = null;
      (window as any).__canvases = { 1: c };
      return true;
    }, `data:${mimeType || "image/png"};base64,${image.toString("base64")}`);
    if (!ok) throw new Error("Could not read the image.");
    return await fn(makeDoc(page, 1));
  } finally {
    await browser.close().catch(() => undefined);
  }
}
