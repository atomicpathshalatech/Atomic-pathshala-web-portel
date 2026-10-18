import "server-only";
import { launchBrowser } from "@/lib/pdf/html-to-pdf";
import { TEXT_LINE_HEIGHT, TEXT_PAD } from "./text-box";

/**
 * Text boxes the standard PDF fonts cannot write (Hindi and other scripts that
 * need shaping: joined letters, matras, conjuncts). pdf-lib draws glyphs one by
 * one and would break such words, so these boxes are laid out by headless
 * Chrome — the same CSS box the editor shows (padding, line height, wrapping,
 * alignment) — one box per PDF page, and placed into the export as vector pages.
 */

export interface ComplexTextBox {
  id: string;
  text: string;
  width: number; // pt
  height: number; // pt
  fontSize: number;
  fontFamily?: "helvetica" | "times" | "courier";
  isBold?: boolean;
  isItalic?: boolean;
  color?: string;
  align?: "left" | "center" | "right";
  lineHeight?: number;
}

export type ComplexTextResult =
  | { ok: true; pdf: Buffer; ids: string[] }
  | { ok: false; reason: "FONT_UNAVAILABLE" | "RENDER_FAILED"; detail: string };

// Latin first with metric-compatible web fallbacks (no Arial/Times on the server), then Devanagari.
const FAMILY = {
  helvetica: `Arial, Helvetica, Arimo, "Noto Sans Devanagari", sans-serif`,
  times: `"Times New Roman", Times, Tinos, "Noto Serif Devanagari", serif`,
  courier: `"Courier New", Courier, Cousine, "Noto Sans Devanagari", monospace`,
} as const;

const FONT_LINK =
  "https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;700&family=Noto+Serif+Devanagari:wght@400;700&family=Arimo:ital,wght@0,400;0,700;1,400;1,700&family=Tinos:ital,wght@0,400;0,700;1,400;1,700&family=Cousine:ital,wght@0,400;0,700;1,400;1,700&display=block";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const safeColor = (c?: string) => (c && /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : "#000000");
const num = (n: number, min: number) => (Number.isFinite(n) ? Math.max(min, n) : min);

export function complexTextHtml(boxes: ComplexTextBox[]): string {
  const pages = boxes
    .map((b, i) => {
      const w = num(b.width, 1);
      const h = num(b.height, 1);
      return `@page p${i} { size: ${w}pt ${h}pt; margin: 0; }
.b${i} { page: p${i}; width: ${w}pt; height: ${h}pt; font-size: ${num(b.fontSize, 4)}pt; font-family: ${FAMILY[b.fontFamily ?? "helvetica"] ?? FAMILY.helvetica};
  font-weight: ${b.isBold ? 700 : 400}; font-style: ${b.isItalic ? "italic" : "normal"}; color: ${safeColor(b.color)};
  text-align: ${b.align ?? "left"}; line-height: ${num(b.lineHeight || TEXT_LINE_HEIGHT, 0.5)}; }`;
    })
    .join("\n");
  const body = boxes.map((b, i) => `<div class="box b${i}" lang="hi">${esc(b.text)}</div>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="${FONT_LINK}">
<style>
html, body { margin: 0; padding: 0; background: transparent; }
.box { box-sizing: border-box; padding: ${TEXT_PAD}pt; white-space: pre-wrap; overflow-wrap: anywhere; overflow: hidden; break-after: page; }
.box:last-child { break-after: auto; }
${pages}
</style></head><body>${body}</body></html>`;
}

export async function renderComplexTextBoxes(boxes: ComplexTextBox[], opts: { timeoutMs?: number } = {}): Promise<ComplexTextResult> {
  if (!boxes.length) return { ok: true, pdf: Buffer.alloc(0), ids: [] };
  let browser: Awaited<ReturnType<typeof launchBrowser>> | null = null;
  try {
    browser = await launchBrowser();
    const page = await browser.newPage();
    await page.setContent(complexTextHtml(boxes), { waitUntil: "networkidle0", timeout: opts.timeoutMs ?? 30_000 });
    // Every face the text needs must really be loaded — never print empty boxes.
    const fonts = await page.evaluate(async () => {
      await document.fonts.ready;
      const faces = Array.from(document.fonts);
      const deva = faces.filter((f) => /Devanagari/.test(f.family));
      return { devaLoaded: deva.some((f) => f.status === "loaded"), devaFaces: deva.length };
    });
    const needsDeva = boxes.some((b) => /[ऀ-ॿ꣠-ꣿ]/.test(b.text));
    if (needsDeva && !fonts.devaLoaded) {
      return { ok: false, reason: "FONT_UNAVAILABLE", detail: fonts.devaFaces ? "the Hindi font did not load" : "the Hindi font could not be downloaded" };
    }
    const pdf = Buffer.from(await page.pdf({ printBackground: false, preferCSSPageSize: true, timeout: opts.timeoutMs ?? 30_000 }));
    return { ok: true, pdf, ids: boxes.map((b) => b.id) };
  } catch (err) {
    return { ok: false, reason: "RENDER_FAILED", detail: err instanceof Error ? err.message : String(err) };
  } finally {
    await browser?.close().catch(() => undefined);
  }
}
