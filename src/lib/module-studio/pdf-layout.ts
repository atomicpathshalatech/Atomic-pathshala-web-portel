import "server-only";
import { parsePageTextNatively, type NativeParseOptions } from "./native-parser";
import { convertKrutiDevToUnicode, isKrutiDevEncoded } from "./krutidev-converter";
import type { ModuleElementInput } from "@/lib/validation/module";

/**
 * Reads ONE page of a PDF the way a person would, without any AI:
 *
 *   - every text line with its box (PDF points, top-left origin), font and size,
 *   - superscripts / subscripts recovered from size + baseline (x², H₂O, Ca²⁺),
 *   - two-column pages read column by column (left, then right), with
 *     full-width lines (headings, tables) kept in place,
 *   - pictures on the page (their boxes, from the drawing commands),
 *   - links, and the running header / footer (kept as their own blocks).
 *
 * Then builds editable blocks (questions, options, answers, headings,
 * paragraphs, tables…) with the existing rule-based parser and attaches each
 * block's source box. Nothing is dropped silently: lines the cleanup rules
 * remove are listed in the page's warnings.
 */

export type Box = { x: number; y: number; w: number; h: number };

export type LayoutLine = {
  text: string;
  bbox: Box;
  fontName: string | null;
  fontSize: number;
  column: "LEFT" | "RIGHT" | "FULL";
};

export type PageLayout = {
  width: number;
  height: number;
  lines: LayoutLine[];
  images: Box[];
  tinyImages: number;
  links: { url: string; bbox: Box }[];
  columns: 1 | 2;
  textChars: number;
  /** Glyphs the PDF could not map to Unicode (e.g. Hindi conjuncts without a ToUnicode entry). */
  brokenGlyphs: number;
};

const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻", "−": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", n: "ⁿ", i: "ⁱ" };
const SUB: Record<string, string> = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", "+": "₊", "-": "₋", "−": "₋", "=": "₌", "(": "₍", ")": "₎" };

function scriptify(s: string, map: Record<string, string>, fallback: "^" | "_"): string {
  const t = s.trim();
  if (!t) return s;
  if ([...t].every((ch) => map[ch])) return [...t].map((ch) => map[ch]).join("");
  return `${fallback}{${t}}`;
}

/**
 * Control characters some PDF generators leave in the text layer (NUL in
 * particular — Chrome-made Hindi PDFs have it). The database refuses NUL in
 * JSON, which used to fail the whole batch.
 */
export function cleanText(s: string): string {
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFFFE\uFFFF]/g, "");
}

/**
 * Text the PDF itself cannot decode: NUL glyphs (no ToUnicode entry — common for
 * Hindi conjuncts like "ध्य" in browser-made PDFs) and a vowel sign straight after
 * an independent vowel ("अा"), which only happens when a consonant went missing.
 * Such text looks almost right but has letters lost, so the page needs OCR.
 */
export function countBrokenGlyphs(rawItems: any[]): number {
  let n = 0;
  for (const it of rawItems) {
    if (!it || typeof it.str !== "string") continue;
    n += (it.str.match(/\u0000/g) ?? []).length;
    n += (it.str.replace(/\u0000/g, "").match(/[ऄ-औ][ा-ौ]/g) ?? []).length;
  }
  return n;
}

/**
 * Many PDFs store the short-i sign "ि" where it is drawn — before its consonant —
 * so the text reads "िकतने" instead of "कितने". In correct Unicode "ि" always
 * follows a consonant, so one that doesn't is moved after the consonant (cluster).
 */
export function repairDevanagari(s: string): string {
  return s.replace(/(^|[^क-हक़-य़़्])ि((?:[क-हक़-य़]़?्)*[क-हक़-य़]़?)/g, "$1$2ि");
}

type Item = { str: string; x: number; y: number; w: number; size: number; font: string | null };

function median(xs: number[]): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}

/** Text items → lines (with super/subscripts folded in), PDF space (y up). */
export function buildLines(rawItems: any[], pageHeight: number, viewX0 = 0, viewY0 = 0): Omit<LayoutLine, "column">[] {
  const items: Item[] = rawItems
    .filter((it) => it && typeof it.str === "string" && it.str.length > 0)
    .map((it) => ({ ...it, str: cleanText(it.str) }))
    .filter((it) => it.str.length > 0)
    .map((it) => {
      const t = it.transform || [1, 0, 0, 1, 0, 0];
      const size = Math.max(1, Math.hypot(t[2], t[3]) || it.height || 10);
      return { str: it.str, x: t[4] - viewX0, y: t[5] - viewY0, w: it.width ?? it.str.length * size * 0.5, size, font: it.fontName ?? null };
    })
    .filter((it) => it.str.trim().length > 0 || it.str === " ");
  if (!items.length) return [];

  const typical = median(items.filter((i) => i.str.trim().length >= 2).map((i) => i.size)) || median(items.map((i) => i.size));
  const tol = Math.max(2, typical * 0.55);
  items.sort((a, b) => b.y - a.y || a.x - b.x);

  // Only join text that is horizontally close — a column gutter (or a wide table gap) starts a new line.
  const gap = typical * 2;
  const near = (it: Item, grp: Item[]) => grp.some((m) => it.x + it.w >= m.x - gap && it.x <= m.x + m.w + gap);
  const baseOf = (grp: Item[]) => median(grp.map((m) => m.y));

  // Pass 1: lines from normal-size text. Pass 2: merge pieces of one line that met out of order.
  // Pass 3: small raised/lowered text (super/subscripts) joins the line it sits on.
  const isSmall = (it: Item) => it.size < typical * 0.9;
  const groups: Item[][] = [];
  for (const it of items.filter((i) => !isSmall(i))) {
    const g = groups.find((grp) => Math.abs(baseOf(grp) - it.y) <= tol && near(it, grp));
    if (g) g.push(it);
    else groups.push([it]);
  }
  for (let merged = true; merged; ) {
    merged = false;
    outer: for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        if (Math.abs(baseOf(groups[i]!) - baseOf(groups[j]!)) <= tol && groups[j]!.some((m) => near(m, groups[i]!))) {
          groups[i]!.push(...groups.splice(j, 1)[0]!);
          merged = true;
          break outer;
        }
      }
    }
  }
  for (const it of items.filter(isSmall)) {
    const g = groups
      .filter((grp) => grp.some((m) => !isSmall(m)) && Math.abs(baseOf(grp) - it.y) <= typical * 0.75 && near(it, grp))
      .sort((a, b) => Math.abs(baseOf(a) - it.y) - Math.abs(baseOf(b) - it.y))[0];
    const own = g ?? groups.find((grp) => grp.every(isSmall) && Math.abs(baseOf(grp) - it.y) <= tol && near(it, grp));
    if (own) own.push(it);
    else groups.push([it]);
  }

  const out: Omit<LayoutLine, "column">[] = [];
  for (const grp of groups) {
    grp.sort((a, b) => a.x - b.x);
    // Scripts are set ~80–85% of the body size, so "big" means within 10% of the line's largest text.
    const maxSize = Math.max(...grp.map((m) => m.size));
    const big = grp.filter((m) => m.size >= maxSize * 0.9);
    const lineSize = median((big.length ? big : grp).map((m) => m.size));
    const baseline = median((big.length ? big : grp).map((m) => m.y));
    let text = "";
    let prevEnd: number | null = null;
    for (const m of grp) {
      let piece = m.str;
      if (m.size < lineSize * 0.9 && lineSize > 0) {
        if (m.y > baseline + lineSize * 0.2) piece = scriptify(piece, SUP, "^");
        else if (m.y < baseline - lineSize * 0.08) piece = scriptify(piece, SUB, "_");
      }
      if (prevEnd !== null && m.x - prevEnd > lineSize * 0.22 && !text.endsWith(" ") && !piece.startsWith(" ")) text += " ";
      text += piece;
      prevEnd = m.x + m.w;
    }
    text = repairDevanagari(text.replace(/\s+/g, " ").trim());
    if (!text) continue;
    const x0 = Math.min(...grp.map((m) => m.x));
    const x1 = Math.max(...grp.map((m) => m.x + m.w));
    const top = Math.max(...grp.map((m) => m.y + m.size * 0.85));
    const bottom = Math.min(...grp.map((m) => m.y - m.size * 0.2));
    const fonts = new Map<string, number>();
    for (const m of grp) if (m.font) fonts.set(m.font, (fonts.get(m.font) ?? 0) + m.str.length);
    const fontName = [...fonts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    out.push({
      text,
      bbox: { x: round(x0), y: round(pageHeight - top), w: round(x1 - x0), h: round(top - bottom) },
      fontName,
      fontSize: round(lineSize),
    });
  }
  return out.sort((a, b) => a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x);
}

function round(n: number) {
  return Math.round(n * 10) / 10;
}

/** Two columns? Then read left column, then right, keeping full-width lines in place. */
export function orderReading(lines: Omit<LayoutLine, "column">[], pageWidth: number): { lines: LayoutLine[]; columns: 1 | 2 } {
  const asOne = () => ({ lines: lines.map((l) => ({ ...l, column: "FULL" as const })), columns: 1 as const });
  if (lines.length < 8) return asOne();
  let best: { gx: number; crossing: number } | null = null;
  for (let f = 0.35; f <= 0.65; f += 0.01) {
    const gx = pageWidth * f;
    const crossing = lines.filter((l) => l.bbox.x < gx - 2 && l.bbox.x + l.bbox.w > gx + 2).length;
    if (!best || crossing < best.crossing) best = { gx, crossing };
  }
  if (!best) return asOne();
  const left = lines.filter((l) => l.bbox.x + l.bbox.w <= best!.gx + 2);
  const right = lines.filter((l) => l.bbox.x >= best!.gx - 2);
  const enough = (n: number) => n >= Math.max(3, lines.length * 0.2);
  if (!enough(left.length) || !enough(right.length) || best.crossing > lines.length * 0.15) return asOne();

  const tagged: LayoutLine[] = lines.map((l) => ({
    ...l,
    column: l.bbox.x + l.bbox.w <= best!.gx + 2 ? "LEFT" : l.bbox.x >= best!.gx - 2 ? "RIGHT" : "FULL",
  }));
  // Bands between full-width lines; inside a band: all of the left column, then the right.
  const full = tagged.filter((l) => l.column === "FULL").sort((a, b) => a.bbox.y - b.bbox.y);
  const ordered: LayoutLine[] = [];
  let bandTop = -Infinity;
  const emitBand = (bottom: number) => {
    const inBand = (l: LayoutLine) => l.bbox.y >= bandTop && l.bbox.y < bottom;
    ordered.push(...tagged.filter((l) => l.column === "LEFT" && inBand(l)).sort((a, b) => a.bbox.y - b.bbox.y));
    ordered.push(...tagged.filter((l) => l.column === "RIGHT" && inBand(l)).sort((a, b) => a.bbox.y - b.bbox.y));
  };
  for (const f of full) {
    emitBand(f.bbox.y);
    ordered.push(f);
    bandTop = f.bbox.y;
  }
  emitBand(Infinity);
  return { lines: ordered, columns: 2 };
}

type Matrix = [number, number, number, number, number, number];
const mul = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

/** Picture boxes from the page's drawing commands (no rendering needed). */
export async function findImageBoxes(page: any, OPS: Record<string, number>, pageHeight: number, viewX0 = 0, viewY0 = 0): Promise<{ boxes: Box[]; tiny: number }> {
  const ops = await page.getOperatorList();
  const paint = new Set([OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageMaskXObject, OPS.paintImageXObjectRepeat].filter((v) => typeof v === "number"));
  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  const stack: Matrix[] = [];
  const boxes: Box[] = [];
  let tiny = 0;
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];
    if (fn === OPS.save) stack.push(ctm);
    else if (fn === OPS.restore) ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
    else if (fn === OPS.transform && Array.isArray(args) && args.length >= 6) ctm = mul(ctm, args as Matrix);
    else if (fn === OPS.paintFormXObjectBegin) {
      // Pictures inside a form XObject (browsers' PDFs) are drawn in the form's own coordinates.
      stack.push(ctm);
      const m = Array.isArray(args) ? args[0] : null;
      if (m && m.length >= 6) ctm = mul(ctm, Array.from(m as ArrayLike<number>).slice(0, 6) as Matrix);
    } else if (fn === OPS.paintFormXObjectEnd) ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0];
    else if (paint.has(fn)) {
      const pts = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([u, v]) => [ctm[0] * u! + ctm[2] * v! + ctm[4], ctm[1] * u! + ctm[3] * v! + ctm[5]]);
      const xs = pts.map((p) => p[0]! - viewX0), ys = pts.map((p) => p[1]! - viewY0);
      const box = { x: round(Math.min(...xs)), y: round(pageHeight - Math.max(...ys)), w: round(Math.max(...xs) - Math.min(...xs)), h: round(Math.max(...ys) - Math.min(...ys)) };
      if (box.w < 12 || box.h < 12) tiny++;
      else boxes.push(box);
    }
  }
  return { boxes, tiny };
}

export async function extractPageLayout(page: any, OPS: Record<string, number>): Promise<PageLayout> {
  const viewport = page.getViewport({ scale: 1 });
  const [vx0, vy0] = viewport.viewBox ?? [0, 0];
  const width = viewport.width as number;
  const height = viewport.height as number;
  const content = await page.getTextContent();
  const brokenGlyphs = countBrokenGlyphs(content.items);
  const raw = buildLines(content.items, height, vx0, vy0);
  const { lines, columns } = orderReading(raw, width);
  let images: Box[] = [];
  let tiny = 0;
  try {
    const found = await findImageBoxes(page, OPS, height, vx0, vy0);
    images = found.boxes;
    tiny = found.tiny;
  } catch {
    // a page whose drawing commands cannot be read still has its text
  }
  const links: PageLayout["links"] = [];
  try {
    for (const a of await page.getAnnotations({ intent: "display" })) {
      if (a?.subtype === "Link" && typeof a.url === "string" && Array.isArray(a.rect)) {
        const [x0, y0, x1, y1] = a.rect as number[];
        links.push({ url: a.url, bbox: { x: round(x0! - vx0), y: round(height - (y1! - vy0)), w: round(x1! - x0!), h: round(y1! - y0!) } });
      }
    }
  } catch {
    // optional
  }
  const textChars = lines.reduce((n, l) => n + l.text.replace(/\s/g, "").length, 0);
  return { width, height, lines, images, tinyImages: tiny, links, columns, textChars, brokenGlyphs };
}

const norm = (s: string) => s.replace(/[\s*_$`]/g, "").toLowerCase();

function unionBox(boxes: Box[]): Box | undefined {
  if (!boxes.length) return undefined;
  const x0 = Math.min(...boxes.map((b) => b.x)), y0 = Math.min(...boxes.map((b) => b.y));
  const x1 = Math.max(...boxes.map((b) => b.x + b.w)), y1 = Math.max(...boxes.map((b) => b.y + b.h));
  return { x: round(x0), y: round(y0), w: round(x1 - x0), h: round(y1 - y0) };
}

/**
 * Layout → editable blocks. `structure` turns ordered text into blocks
 * (the rule-based parser by default; AI mode passes its own).
 */
export function layoutToBlocks(
  layout: PageLayout,
  pageNumber: number,
  options: NativeParseOptions & { structure?: (text: string) => ModuleElementInput[] } = {}
): { elements: ModuleElementInput[]; warnings: string[] } {
  const warnings: string[] = [];
  const H = layout.height;
  // A running header/footer sits in the page margin AND has clear space between it and the
  // text below/above — the first line of a column that happens to start high is body text.
  const overlapsX = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w;
  const isEdge = (l: LayoutLine, top: boolean) => {
    if (!(top ? l.bbox.y + l.bbox.h <= H * 0.07 : l.bbox.y >= H * 0.93) || l.text.length > 120) return false;
    const minGap = l.bbox.h * 0.8;
    const inBand = (o: LayoutLine) => (top ? o.bbox.y + o.bbox.h <= H * 0.07 : o.bbox.y >= H * 0.93);
    return layout.lines.every((o) => {
      if (o === l || inBand(o) || !overlapsX(o.bbox, l.bbox)) return true;
      const gap = top ? o.bbox.y - (l.bbox.y + l.bbox.h) : l.bbox.y - (o.bbox.y + o.bbox.h);
      return gap >= minGap;
    });
  };
  const header = layout.lines.filter((l) => isEdge(l, true));
  const footer = layout.lines.filter((l) => isEdge(l, false));
  const body = layout.lines.filter((l) => !header.includes(l) && !footer.includes(l));

  const fix = (t: string) => (isKrutiDevEncoded(t) ? convertKrutiDevToUnicode(t) : t);
  const bodyText = body.map((l) => fix(l.text)).join("\n");
  const structured = options.structure ? options.structure(bodyText) : parsePageTextNatively(bodyText, pageNumber, options);

  // Attach source boxes: walk the body lines in reading order, giving each
  // block the lines whose text it contains.
  let cursor = 0;
  const used = new Set<number>();
  const elements: ModuleElementInput[] = structured.map((el) => {
    const target = norm(el.content || (el.tableData ?? []).flat().join(""));
    const mine: Box[] = [];
    for (let i = cursor; i < body.length && target; i++) {
      const lt = norm(fix(body[i]!.text));
      if (!lt) continue;
      if (target.includes(lt.slice(0, Math.min(lt.length, 40)))) {
        mine.push(body[i]!.bbox);
        used.add(i);
        cursor = i + 1;
      } else if (mine.length) break;
    }
    const answer = el.type === "PARAGRAPH" && /^(ans(wer)?\b\.?|उत्तर|सही उत्तर)/i.test(el.content.trim());
    return { ...el, type: answer ? "ANSWER" : el.type, sourcePage: pageNumber, source: "TEXT", ...(mine.length && { bbox: unionBox(mine) }) };
  });

  const dropped = body.filter((_, i) => !used.has(i)).map((l) => l.text).filter((t) => {
    const n = norm(t);
    return n.length > 0 && !elements.some((e) => norm(e.content).includes(n.slice(0, 40)));
  });
  if (dropped.length) warnings.push(`${dropped.length} line(s) were removed by the cleanup rules: ${dropped.slice(0, 5).map((t) => `"${t.slice(0, 60)}"`).join(", ")}${dropped.length > 5 ? "…" : ""}`);

  const edge = (lines: LayoutLine[], type: "HEADER" | "FOOTER"): ModuleElementInput[] =>
    lines.length ? [{ id: `p${pageNumber}-${type.toLowerCase()}`, type, order: 0, content: lines.map((l) => fix(l.text)).join(" · "), sourcePage: pageNumber, source: "TEXT", bbox: unionBox(lines.map((l) => l.bbox)) }] : [];

  const pictures: ModuleElementInput[] = layout.images.map((b, i) => ({
    id: `p${pageNumber}-img-${i}`,
    type: "IMAGE",
    order: 0,
    content: "",
    label: `Picture from page ${pageNumber}`,
    sourcePage: pageNumber,
    source: "IMAGE_REGION",
    bbox: b,
  }));
  if (pictures.length) warnings.push(`${pictures.length} picture(s) kept as their position on the source page — crop or replace them in the editor.`);
  if (layout.tinyImages) warnings.push(`${layout.tinyImages} very small image(s) (under 12 pt, usually bullets or lines) were not turned into blocks.`);

  // Pictures go between the blocks by their vertical position, in their own
  // column on a two-column page.
  const colOf = (bx: Box) => (layout.columns === 2 ? (bx.x + bx.w / 2 < layout.width / 2 ? "LEFT" : "RIGHT") : "FULL");
  const main = [...elements];
  for (const pic of pictures) {
    const col = colOf(pic.bbox!);
    let at = -1;
    let lastSameCol = -1;
    for (let i = 0; i < main.length; i++) {
      const bx = main[i]!.bbox;
      if (!bx || colOf(bx) !== col) continue;
      lastSameCol = i;
      if (bx.y > pic.bbox!.y) { at = i; break; }
    }
    main.splice(at >= 0 ? at : lastSameCol >= 0 ? lastSameCol + 1 : main.length, 0, pic);
  }

  const all = [...edge(header, "HEADER"), ...main, ...edge(footer, "FOOTER")].map((el, i) => ({ ...el, order: i }));
  return { elements: all, warnings };
}
