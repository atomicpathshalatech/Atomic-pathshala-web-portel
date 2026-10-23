import "server-only";
import { executeGeminiWithFailover } from "@/lib/questions/gemini-engine";
import { parseAiJson } from "@/lib/ai/latex-json";
import { lightThinking } from "@/lib/ai/gemini-models";
import { withRenderedPdf, type RenderedPdf } from "@/lib/pdf/page-renderer";
import { loadServerPdfJs } from "@/lib/pdf/server-pdf";

/**
 * Chemical structures, diagrams, graphs and circuits can't be "read" from a
 * PDF's text — the text extractor used to make up a sentence describing them
 * ("C6H8O (represented as a six-membered ring…)"). Instead, each page is
 * rendered to an image, the model only LOCATES every figure (question number,
 * where it belongs, bounding box), and the figure is cropped from the page
 * itself — so the student sees exactly the printed structure, however
 * complicated, pixel for pixel.
 */

export type FigurePlace = "STATEMENT" | "A" | "B" | "C" | "D";
export type CroppedFigure = { questionNumber: number; place: FigurePlace; page: number; png: Buffer; box: [number, number, number, number] };

const PAGES_PER_CALL = 3;

const LOCATE_PROMPT = `You are given exam paper pages (images, in order). For EVERY question on these pages, find every printed figure that is part of the question: chemical structure / skeletal formula, reaction scheme drawing, diagram, graph, circuit, apparatus, table drawn as an image.

Return STRICT JSON:
{"figures":[{"page":1,"question":12,"place":"STATEMENT","box":[ymin,xmin,ymax,xmax]}]}

Rules:
- "page" is the 1-based index of the image in THIS request.
- "question" is the printed question number the figure belongs to.
- "place": "STATEMENT" if the figure is in the question stem; "A","B","C","D" if it is inside that option (options may be printed as (1)(2)(3)(4) — map 1→A, 2→B, 3→C, 4→D).
- "box": tight bounding box around the WHOLE figure (all atoms, bonds, labels, charges, arrows), normalized 0–1000 on that page image, as [ymin, xmin, ymax, xmax]. Include the full structure — never cut off a substituent or label — but exclude the question text and option letters.
- One entry per figure. If an option contains only a structure, give that option's structure.
- Text, equations and formulas that are typed text (not drawings) are NOT figures.
- If a page has no figures, return nothing for it.`;

type Located = { page: number; question: number; place: string; box: number[] };

async function locateFigures(images: string[]): Promise<Located[]> {
  const parts = images.map((b64) => ({ inlineData: { mimeType: "image/jpeg", data: b64.replace(/^data:[^,]+,/, "") } }));
  const raw = await executeGeminiWithFailover(async (client, modelName) => {
    const model = client.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType: "application/json", temperature: 0, ...lightThinking(modelName, "low") } });
    const res = await model.generateContent([LOCATE_PROMPT, ...parts]);
    return res.response?.text() || "";
  });
  const parsed = parseAiJson<{ figures?: Located[] }>(raw.replace(/```json|```/gi, "").trim());
  return (parsed.figures ?? []).filter(
    (f) => Number.isInteger(f.page) && Number.isInteger(f.question) && Array.isArray(f.box) && f.box.length === 4 && f.box.every((n) => typeof n === "number")
  );
}

/**
 * Renders the PDF, locates the figures and crops them.
 * - `pages`: only these pages (e.g. the pages that have a figure question).
 *   Each page is its own AI call — with 3 pages per call the model often
 *   returned the wrong page index, so crops came from the wrong page.
 * - Without `pages`, the first `maxPages` pages (default 60) are scanned.
 * - `deadlineMs`: stop starting new pages after this time.
 */
export async function cropQuestionFigures(pdf: Buffer, opts: { maxPages?: number; pages?: number[]; deadlineMs?: number } = {}): Promise<CroppedFigure[]> {
  return withRenderedPdf(pdf, (doc) => cropFiguresOnDoc(doc, opts));
}

/**
 * Same as cropQuestionFigures, on a PDF that is already rendered — a chunk
 * read from page images crops its figures in the same browser session
 * instead of starting a second one.
 */
export async function cropFiguresOnDoc(
  doc: RenderedPdf,
  opts: { maxPages?: number; pages?: number[]; deadlineMs?: number } = {}
): Promise<CroppedFigure[]> {
  {
    const list = (opts.pages?.length ? opts.pages : Array.from({ length: Math.min(doc.pageCount, opts.maxPages ?? 60) }, (_, i) => i + 1))
      .filter((n) => n >= 1 && n <= doc.pageCount)
      .sort((a, b) => a - b);
    const perCall = opts.pages?.length ? 1 : PAGES_PER_CALL;
    const crops: CroppedFigure[] = [];
    for (let i = 0; i < list.length; i += perCall) {
      if (opts.deadlineMs && Date.now() > opts.deadlineMs) break;
      const numbers = list.slice(i, i + perCall);
      const images = await Promise.all(numbers.map((n) => doc.jpeg(n)));
      const found = await locateFigures(images).catch((err) => {
        console.warn("[figure-crops] locate failed for pages", numbers, err);
        return [] as Located[];
      });
      for (const f of found) {
        const idx = numbers.length === 1 ? 1 : f.page; // single page: ignore the model's page index
        if (idx < 1 || idx > numbers.length) continue;
        const absPage = numbers[idx - 1]!;
        const box = f.box.map((n) => Math.max(0, Math.min(1000, n))) as [number, number, number, number];
        if (box[2] - box[0] < 8 || box[3] - box[1] < 8) continue;
        // Grows past a tight box (labels like CH3 / NO2 / the O of C=O),
        // trims a stray text line, then fits the drawing.
        const png = await doc.crop(absPage, box, { grow: true, option: ["A", "B", "C", "D"].includes(String(f.place).toUpperCase()) });
        if (!png) continue;
        const place = (["STATEMENT", "A", "B", "C", "D"].includes(String(f.place).toUpperCase()) ? String(f.place).toUpperCase() : "STATEMENT") as FigurePlace;
        crops.push({ questionNumber: f.question, place, page: absPage, box, png });
      }
      for (const n of numbers) await doc.release(n);
    }
    return crops;
  }
}

/**
 * Pages that place a real picture, read from the PDF itself: an image of
 * real size — not a tiny logo, not a full-page background or scan. Figures
 * used to be looked for only on pages where the text model said "this
 * question has an image"; a pasted diagram it missed never came.
 * (Drawn lines are not counted: many coaching PDFs draw their text, Hindi
 * especially, as outlines — every page would look like a figure.)
 */
export async function pagesWithDrawings(pdf: Buffer, pages: number[]): Promise<number[]> {
  if (!pages.length) return [];
  try {
    const pdfjs = await loadServerPdfJs();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf), useWorkerFetch: false, isEvalSupported: false, disableFontFace: true, verbosity: 0 }).promise;
    const OPS = pdfjs.OPS as Record<string, number>;
    const imageOps = new Set([OPS.paintImageXObject, OPS.paintInlineImageXObject, OPS.paintImageXObjectRepeat].filter((x) => typeof x === "number"));
    const found: number[] = [];
    try {
      for (const n of pages) {
        if (n < 1 || n > doc.numPages) continue;
        const page = await doc.getPage(n);
        const [, , pw, ph] = page.view as number[];
        const pageArea = Math.max(1, (pw ?? 1) * (ph ?? 1));
        const ops = await page.getOperatorList();
        let figureImage = false;
        // Track the current transform scale to size placed images.
        const stack: number[][] = [];
        let ctm = [1, 0, 0, 1, 0, 0];
        for (let i = 0; i < ops.fnArray.length; i++) {
          const fn = ops.fnArray[i];
          const args = ops.argsArray[i] as unknown[];
          if (fn === OPS.save) stack.push(ctm);
          else if (fn === OPS.restore) ctm = stack.pop() ?? ctm;
          else if (fn === OPS.transform && Array.isArray(args)) {
            const [a, b, c, d, e, f] = args as number[];
            ctm = [
              ctm[0]! * a! + ctm[2]! * b!,
              ctm[1]! * a! + ctm[3]! * b!,
              ctm[0]! * c! + ctm[2]! * d!,
              ctm[1]! * c! + ctm[3]! * d!,
              ctm[0]! * e! + ctm[2]! * f! + ctm[4]!,
              ctm[1]! * e! + ctm[3]! * f! + ctm[5]!,
            ];
          } else if (imageOps.has(fn!)) {
            const area = Math.abs(ctm[0]! * ctm[3]! - ctm[1]! * ctm[2]!);
            const share = area / pageArea;
            if (share > 0.006 && share < 0.6) figureImage = true;
          }
          if (figureImage) break;
        }
        page.cleanup();
        if (figureImage) found.push(n);
      }
    } finally {
      await doc.destroy().catch(() => undefined);
    }
    return found;
  } catch (err) {
    console.warn("[figure-crops] drawing scan failed:", err);
    return [];
  }
}

/**
 * Figures whose question number the locator misread (it matches no question
 * extracted on that page) go to the one question on that page that needs a
 * figure and has none — instead of being dropped.
 */
export function matchFiguresToQuestions<F extends { questionNumber: number; page: number }>(
  figures: F[],
  questions: { originalNumber: number; sourcePage: number; hasImage?: boolean }[]
): F[] {
  const numbers = new Set(questions.map((q) => q.originalNumber));
  const matched = new Set(figures.filter((f) => numbers.has(f.questionNumber)).map((f) => f.questionNumber));
  return figures.map((f) => {
    if (numbers.has(f.questionNumber)) return f;
    const waiting = questions.filter((q) => q.sourcePage === f.page && q.hasImage && !matched.has(q.originalNumber));
    if (waiting.length !== 1) return f;
    matched.add(waiting[0]!.originalNumber);
    return { ...f, questionNumber: waiting[0]!.originalNumber };
  });
}

export const FIGURE_PLACEHOLDER = "[FIGURE]";

type QuestionWithFigures = {
  originalNumber: number;
  statement: string;
  statementHi?: string | null;
  options: Record<string, string>;
  optionsHi?: Record<string, string> | null;
  hasImage?: boolean;
  missingImage?: boolean;
  missingImageReason?: string;
  imageUrl?: string | null;
};

/**
 * Puts each cropped figure into its question: at the "[FIGURE]" marker the
 * text extractor left (statement or option, English and Hindi), else after
 * the statement / inside the option.
 */
export function attachFigures<Q extends QuestionWithFigures>(questions: Q[], figures: { questionNumber: number; place: FigurePlace; url: string }[]): Q[] {
  const byQ = new Map<number, typeof figures>();
  for (const f of figures) byQ.set(f.questionNumber, [...(byQ.get(f.questionNumber) ?? []), f]);
  return questions.map((q) => {
    const figs = byQ.get(q.originalNumber);
    if (!figs?.length) return q;
    const md = (url: string, place: FigurePlace) => `![${place === "STATEMENT" ? "45%" : "70%"}](${url})`;
    const put = (text: string | null | undefined, img: string) => {
      const t = text ?? "";
      return t.includes(FIGURE_PLACEHOLDER) ? t.replace(FIGURE_PLACEHOLDER, img) : `${t}${t.trim() ? "\n" : ""}${img}`;
    };
    const next: Q = { ...q, options: { ...q.options }, optionsHi: q.optionsHi ? { ...q.optionsHi } : q.optionsHi };
    // One crop for an option written as "[FIGURE] and [FIGURE]": the crop
    // shows the whole printed option, so the option becomes just that image
    // (otherwise "and" would appear twice).
    for (const place of ["A", "B", "C", "D"] as const) {
      const mine = figs.filter((f) => f.place === place);
      const markers = (next.options[place] ?? "").split(FIGURE_PLACEHOLDER).length - 1;
      if (mine.length === 1 && markers > 1) {
        next.options[place] = FIGURE_PLACEHOLDER;
        if (next.optionsHi) next.optionsHi[place] = FIGURE_PLACEHOLDER;
      }
    }
    for (const f of figs) {
      const img = md(f.url, f.place);
      if (f.place === "STATEMENT") {
        next.statement = put(next.statement, img);
        if (next.statementHi != null) next.statementHi = put(next.statementHi, img);
        next.imageUrl = next.imageUrl || f.url;
      } else {
        next.options[f.place] = put(next.options[f.place], img);
        if (next.optionsHi) next.optionsHi[f.place] = put(next.optionsHi[f.place], img);
      }
    }
    // Any marker left without a figure is dropped from the text.
    const strip = (t: string | null | undefined) => (t ? t.split(FIGURE_PLACEHOLDER).join("").trim() : t);
    next.statement = strip(next.statement) as string;
    if (next.statementHi != null) next.statementHi = strip(next.statementHi);
    next.hasImage = true;
    next.missingImage = false;
    next.missingImageReason = "";
    return next;
  });
}

export type CroppedQuestionCard = {
  page: number;
  questionNumber: number;
  png: Buffer;
  box: [number, number, number, number];
};

/**
 * Deterministically crops the full question reference card for each question:
 * question number, sitting tag, statement, all math equations, diagrams, and options A, B, C, D.
 * Rendered at ~180 DPI via headless Chromium / pdf.js. No AI calls or quota limits needed.
 */
export async function cropQuestionCards(
  pdf: Buffer,
  questions: { number: number; sourcePage: number }[]
): Promise<CroppedQuestionCard[]> {
  const pdfjs = await loadServerPdfJs();
  const pdfDoc = await pdfjs.getDocument({
    data: new Uint8Array(pdf),
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
    verbosity: 0,
  }).promise;

  const byPage = new Map<number, number[]>();
  for (const q of questions) {
    if (!byPage.has(q.sourcePage)) byPage.set(q.sourcePage, []);
    byPage.get(q.sourcePage)!.push(q.number);
  }

  const results: CroppedQuestionCard[] = [];

  await withRenderedPdf(pdf, async (doc) => {
    for (const [pageNum, qNums] of byPage.entries()) {
      if (pageNum < 1 || pageNum > pdfDoc.numPages) continue;
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 });
      const textContent = await page.getTextContent();
      const pageHeight = viewport.height;

      const items = (textContent.items as any[])
        .filter((it) => "str" in it && String(it.str).trim() !== "")
        .map((it) => ({
          str: String(it.str).trim(),
          x: Number(it.transform?.[4] ?? 0),
          y: Number(it.transform?.[5] ?? 0),
        }));

      const Q_PREFIX = /^\s*(?:Q(?:uestion)?\.?\s*(?:No\.?)?\s*)?(\d{1,3})\s*(?:\.(?!\d)|[):]|\s|$)/i;
      const foundStarts: { qNum: number; y: number }[] = [];
      for (const it of items) {
        const m = it.str.match(Q_PREFIX);
        if (m) {
          const num = Number(m[1]);
          if (qNums.includes(num) && !foundStarts.some((f) => f.qNum === num)) {
            foundStarts.push({ qNum: num, y: it.y });
          }
        }
      }

      foundStarts.sort((a, b) => b.y - a.y);

      for (let i = 0; i < foundStarts.length; i++) {
        const curr = foundStarts[i]!;
        const next = foundStarts[i + 1];

        const topPdfY = Math.min(pageHeight, curr.y + 12);
        const bottomPdfY = next ? next.y + 22 : 55;

        const ymin = Math.max(0, Math.round(((pageHeight - topPdfY) / pageHeight) * 1000));
        const ymax = Math.min(1000, Math.round(((pageHeight - bottomPdfY) / pageHeight) * 1000));
        const box: [number, number, number, number] = [ymin, 35, ymax, 965];

        const png = await doc.crop(pageNum, box);
        if (png) {
          results.push({ page: pageNum, questionNumber: curr.qNum, png, box });
        }
      }
      await doc.release(pageNum);
    }
  });

  return results;
}
