import "server-only";
import { executeGeminiWithFailover } from "@/lib/questions/gemini-engine";
import { parseAiJson } from "@/lib/ai/latex-json";
import { lightThinking } from "@/lib/ai/gemini-models";
import { withRenderedPdf, type Box, type RenderedPdf } from "@/lib/pdf/page-renderer";
import { MODULE_CALLOUT_VARIANTS, type ModuleElementInput } from "@/lib/validation/module";

/**
 * Turns one page of an existing (often black-and-white) study module into
 * structured, editable blocks for the premium redesign. The model LOOKS at
 * the rendered page (layout, boxes, columns, figures) and also gets the
 * page's own text layer for exact spelling; every figure is cropped from the
 * page itself, so diagrams and structures stay exactly as printed.
 */

export type PremiumOptions = {
  removeWords?: string[];
  renames?: Record<string, string>;
};

export type PremiumPageResult = {
  pageNumber: number;
  width: number;
  height: number;
  elements: ModuleElementInput[];
  warnings: string[];
  scanned: boolean;
};

type RawBlock = {
  type?: string;
  text?: string;
  variant?: string;
  label?: string;
  rows?: string[][];
  items?: string[];
  box?: number[];
  caption?: string;
};

const PROMPT = `You are converting ONE page of a printed coaching study module (NEET/JEE/Boards) into structured blocks so it can be re-typeset in a modern colourful design. You get the page IMAGE and, when available, the page's TEXT LAYER (exact characters; use it for spelling, but follow the IMAGE for layout and reading order).

Return STRICT JSON: {"blocks":[ ... ]} in reading order (two columns → finish the left column, then the right).

Block types:
- {"type":"HEADING","text":"..."}            chapter / main section title
- {"type":"SUBHEADING","text":"..."}         sub-section / topic title
- {"type":"PARAGRAPH","text":"..."}          running text
- {"type":"BULLETS","items":["...","..."]}   bulleted / numbered points (one per item, without the bullet symbol)
- {"type":"CALLOUT","variant":"CONCEPT|NOTE|EXAMPLE|TIP|REMEMBER|CAUTION|FORMULA|SUMMARY","label":"<the box's own printed heading, e.g. Note, Example 3, Key Point>","text":"<box content>"}   any boxed / shaded / highlighted area. Pick the closest variant.
- {"type":"TABLE","rows":[["h1","h2"],["a","b"]]}   real tables (first row = header)
- {"type":"EQUATION","text":"<LaTeX, no $>"}   a standalone displayed equation / reaction
- {"type":"QUESTION","text":"<number and question>"}, then {"type":"OPTION","text":"(1) ..."} per option, and {"type":"SOLUTION","text":"..."} for an answer / solution / hint if printed
- {"type":"FIGURE","box":[ymin,xmin,ymax,xmax],"caption":"<printed caption or empty>"}   ANY drawing: diagram, graph, chemical structure, apparatus, map, photo, flowchart, circuit, table printed as an image. box is normalized 0–1000 on the page image and must cover the WHOLE figure including its own atom labels / axis labels, but NOT any line of running text, question text or caption above or below it.

Rules:
- Keep the text exactly as printed, in its original language (Hindi stays Hindi, English stays English). Never summarise, translate or add content.
- Inline maths, units and chemical formulas in LaTeX inside $...$ (e.g. $\\text{H}_2\\text{SO}_4$, $v = u + at$, $10^{-3}$).
- Bold words as **bold**.
- SKIP: running headers and footers, page numbers, publisher / institute names and logos, watermarks, "visit our website" lines, decorative borders.
- A box that contains a figure: emit the CALLOUT for the text and a separate FIGURE.
- If the page has no content (blank / cover art only), return {"blocks":[]}.`;

function stripWords(text: string, words: string[]): string {
  let t = text;
  for (const w of words) {
    if (!w.trim()) continue;
    const re = new RegExp(w.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    t = t.replace(re, "");
  }
  return t.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function applyRenames(text: string, renames: Record<string, string>): string {
  let t = text;
  for (const [from, to] of Object.entries(renames)) {
    if (!from.trim()) continue;
    const re = new RegExp(`(^|[^\\p{L}])(${from.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?=$|[^\\p{L}])`, "giu");
    t = t.replace(re, (_m, pre) => `${pre}${to}`);
  }
  return t;
}

const DEFAULT_LABEL: Record<string, string> = {
  CONCEPT: "Concept",
  NOTE: "Note",
  EXAMPLE: "Example",
  TIP: "Tip",
  REMEMBER: "Remember",
  CAUTION: "Caution",
  FORMULA: "Formula",
  SUMMARY: "Summary",
};

async function locateBlocks(jpegBase64: string, textLayer: string): Promise<RawBlock[]> {
  const raw = await executeGeminiWithFailover(async (client, modelName) => {
    const model = client.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0,
        maxOutputTokens: 32768,
        ...lightThinking(modelName, "low"),
      } as Record<string, unknown>,
    });
    const res = await model.generateContent([
      PROMPT,
      { inlineData: { mimeType: "image/jpeg", data: jpegBase64 } },
      textLayer ? `TEXT LAYER of this page:\n${textLayer.slice(0, 12000)}` : "TEXT LAYER: (none — scanned page, read the image)",
    ]);
    const text = res.response?.text() || "";
    if (!text.trim()) throw new Error("empty response");
    return text;
  });
  const parsed = parseAiJson<{ blocks?: RawBlock[] } | RawBlock[]>(raw.replace(/```json|```/gi, "").trim());
  const list = Array.isArray(parsed) ? parsed : parsed?.blocks;
  return Array.isArray(list) ? list : [];
}

async function processPage(
  doc: RenderedPdf,
  n: number,
  opts: PremiumOptions,
  uploadImage: (png: Buffer, name: string) => Promise<string>
): Promise<PremiumPageResult> {
  const size = await doc.render(n);
  const warnings: string[] = [];
  const textLayer = await doc.text(n);
  const scanned = textLayer.length < 20;
  let blocks: RawBlock[] = [];
  try {
    blocks = await locateBlocks(await doc.jpeg(n), textLayer);
  } catch (err) {
    warnings.push(`AI could not read this page: ${(err as Error).message?.slice(0, 160)}`);
  }

  const removeWords = opts.removeWords ?? [];
  const renames = opts.renames ?? {};
  const clean = (t: unknown) => stripWords(String(t ?? ""), removeWords);
  // Renames apply to box labels and headings only — never inside sentences or tables.
  const cleanTitle = (t: unknown) => applyRenames(clean(t), renames);
  const cleanLabel = (t: unknown) => cleanTitle(t).replace(/\s*[:：\-–—]+\s*$/, "").trim();

  const elements: ModuleElementInput[] = [];
  const push = (el: Omit<ModuleElementInput, "id" | "order">) =>
    elements.push({ id: `p${n}-${elements.length}-${Math.random().toString(36).slice(2, 7)}`, order: elements.length, ...el });

  let figureNo = 0;
  for (const b of blocks) {
    const type = String(b.type ?? "").toUpperCase();
    if (type === "FIGURE") {
      const box = Array.isArray(b.box) && b.box.length === 4 && b.box.every((v) => typeof v === "number") ? (b.box.map((v) => Math.max(0, Math.min(1000, v))) as Box) : null;
      if (!box || box[2] - box[0] < 8 || box[3] - box[1] < 8) continue;
      const png = await doc.crop(n, box, { grow: true });
      if (!png) continue;
      try {
        const url = await uploadImage(png, `p${n}-fig${++figureNo}.png`);
        // Printed at its original size: the page was rendered at 180 dpi.
        const widthMm = Math.round((png.readUInt32BE(16) / 180) * 25.4);
        push({ type: "IMAGE", content: `![w=${widthMm}mm](${url})`, label: clean(b.caption).slice(0, 80) || undefined });
      } catch (err) {
        warnings.push(`A figure on this page could not be saved: ${(err as Error).message?.slice(0, 120)}`);
      }
      continue;
    }
    if (type === "TABLE") {
      const rows = (Array.isArray(b.rows) ? b.rows : []).map((r) => (Array.isArray(r) ? r.map((c) => clean(c)) : [])).filter((r) => r.length);
      if (rows.length) push({ type: "TABLE", content: "", tableData: rows });
      continue;
    }
    if (type === "BULLETS") {
      const items = (Array.isArray(b.items) ? b.items : String(b.text ?? "").split("\n")).map((i) => clean(i)).filter(Boolean);
      if (items.length) push({ type: "BULLETS", content: items.join("\n") });
      continue;
    }
    if (type === "CALLOUT") {
      const variant = (MODULE_CALLOUT_VARIANTS as readonly string[]).includes(String(b.variant).toUpperCase()) ? String(b.variant).toUpperCase() : "NOTE";
      const text = clean(b.text);
      if (!text) continue;
      const label = cleanLabel(b.label) || applyRenames(DEFAULT_LABEL[variant] ?? "Note", renames);
      push({ type: "CALLOUT", content: text, variant, label: label.slice(0, 80) });
      continue;
    }
    const allowed = ["HEADING", "SUBHEADING", "PARAGRAPH", "EQUATION", "QUESTION", "OPTION", "SOLUTION"];
    const t = allowed.includes(type) ? type : "PARAGRAPH";
    const text = t === "HEADING" || t === "SUBHEADING" ? cleanTitle(b.text) : clean(b.text);
    if (!text) continue;
    push({ type: t as ModuleElementInput["type"], content: text });
  }

  if (!elements.length && !warnings.length) warnings.push(scanned ? "Scanned page with no readable content." : "No content found on this page.");
  await doc.release(n);
  return { pageNumber: n, width: size.width / 2.5, height: size.height / 2.5, elements, warnings, scanned };
}

/**
 * Processes pages [fromPage, toPage] of the PDF, a few at a time, calling
 * onProgress after each page.
 */
export async function extractPremiumModule(
  pdf: Buffer,
  opts: PremiumOptions & {
    fromPage?: number;
    toPage?: number;
    concurrency?: number;
    uploadImage: (png: Buffer, name: string) => Promise<string>;
    onProgress?: (done: number, total: number) => Promise<void> | void;
  }
): Promise<{ pageCount: number; pages: PremiumPageResult[] }> {
  return withRenderedPdf(pdf, async (doc) => {
    const from = Math.max(1, opts.fromPage ?? 1);
    const to = Math.min(doc.pageCount, opts.toPage ?? doc.pageCount);
    const numbers = Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);
    const results: PremiumPageResult[] = [];
    const concurrency = Math.max(1, opts.concurrency ?? 3);
    let done = 0;
    for (let i = 0; i < numbers.length; i += concurrency) {
      const batch = numbers.slice(i, i + concurrency);
      const out = await Promise.all(batch.map((n) => processPage(doc, n, opts, opts.uploadImage)));
      results.push(...out);
      done += batch.length;
      await opts.onProgress?.(done, numbers.length);
    }
    return { pageCount: doc.pageCount, pages: results };
  });
}
