import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { executeGeminiWithFailover } from "@/lib/questions/gemini-engine";
import { parseAiJson } from "@/lib/ai/latex-json";
import { lightThinking } from "@/lib/ai/gemini-models";
import { launchBrowser } from "@/lib/pdf/html-to-pdf";

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

const RENDER_SCALE = 2.5; // ~210 dpi: sharp bonds and subscripts
const PAGES_PER_CALL = 3;

function moduleDataUrl(path: string) {
  return `data:text/javascript;base64,${readFileSync(path).toString("base64")}`;
}

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
  const parts = images.map((dataUrl) => ({ inlineData: { mimeType: "image/jpeg", data: dataUrl.replace(/^data:[^,]+,/, "") } }));
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

/** Renders the PDF, locates the figures and crops them. Pages beyond `maxPages` are skipped. */
export async function cropQuestionFigures(pdf: Buffer, opts: { maxPages?: number } = {}): Promise<CroppedFigure[]> {
  // Traced into the upload route (next.config.mjs outputFileTracingIncludes).
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

    // Render every page once; keep the canvases for cropping.
    const pageImages: string[] = await page.evaluate(
      async (b64: string, scale: number, maxPages: number) => {
        const P = (window as any).__pdfjs;
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const doc = await P.getDocument({ data: bytes }).promise;
        const canvases: HTMLCanvasElement[] = [];
        const out: string[] = [];
        for (let i = 1; i <= Math.min(doc.numPages, maxPages); i++) {
          const pg = await doc.getPage(i);
          const vp = pg.getViewport({ scale });
          const c = document.createElement("canvas");
          c.width = Math.ceil(vp.width);
          c.height = Math.ceil(vp.height);
          const ctx = c.getContext("2d")!;
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, c.width, c.height);
          await pg.render({ canvasContext: ctx, viewport: vp }).promise;
          canvases.push(c);
          // A smaller copy is enough for locating figures.
          const s = document.createElement("canvas");
          const k = Math.min(1, 1600 / c.height);
          s.width = Math.round(c.width * k);
          s.height = Math.round(c.height * k);
          s.getContext("2d")!.drawImage(c, 0, 0, s.width, s.height);
          out.push(s.toDataURL("image/jpeg", 0.85));
        }
        (window as any).__pages = canvases;
        return out;
      },
      pdf.toString("base64"),
      RENDER_SCALE,
      opts.maxPages ?? 60
    );

    const located: (Located & { absPage: number })[] = [];
    for (let i = 0; i < pageImages.length; i += PAGES_PER_CALL) {
      const batch = pageImages.slice(i, i + PAGES_PER_CALL);
      const found = await locateFigures(batch).catch((err) => {
        console.warn("[figure-crops] locate failed for pages", i + 1, err);
        return [] as Located[];
      });
      for (const f of found) if (f.page >= 1 && f.page <= batch.length) located.push({ ...f, absPage: i + f.page });
    }

    const crops: CroppedFigure[] = [];
    for (const f of located) {
      const [ymin, xmin, ymax, xmax] = f.box.map((n) => Math.max(0, Math.min(1000, n))) as [number, number, number, number];
      if (ymax - ymin < 8 || xmax - xmin < 8) continue;
      const dataUrl: string | null = await page.evaluate(
        (pi: number, box: number[]) => {
          const c = (window as any).__pages[pi] as HTMLCanvasElement | undefined;
          if (!c) return null;
          // The model's box is often a little tight (a CH3 or NO2 label sticking
          // out). Start from the box plus a small margin, then push each edge
          // outwards while it still cuts through ink, until a blank line —
          // so the whole drawing is always inside. Growth is capped so a
          // figure touching other text can't swallow the page.
          const pad = 0.012;
          let y0 = Math.round(Math.max(0, box[0]! / 1000 - pad) * c.height);
          let x0 = Math.round(Math.max(0, box[1]! / 1000 - pad) * c.width);
          let y1 = Math.round(Math.min(1, box[2]! / 1000 + pad) * c.height);
          let x1 = Math.round(Math.min(1, box[3]! / 1000 + pad) * c.width);
          // (No helper functions in here: this code runs in the page, and
          // bundlers may wrap named functions with helpers that don't exist there.)
          const px = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
          const W = c.width;
          const maxX = Math.round(c.width * 0.12);
          const maxY = Math.round(c.height * 0.06);
          // A label can sit a few pixels away from its bond (the O of a C=O),
          // so an edge only stops after a clear gap of GAP blank lines.
          const GAP = Math.max(6, Math.round(c.height * 0.006));
          for (let pass = 0; pass < 2; pass++) {
            // side: 0 top, 1 bottom, 2 left, 3 right
            for (let side = 0; side < 4; side++) {
              const vertical = side < 2;
              const limit = vertical ? c.height : c.width;
              const dir = side === 0 || side === 2 ? -1 : 1;
              let grown = 0;
              while (grown < (vertical ? maxY : maxX)) {
                const edge = side === 0 ? y0 : side === 1 ? y1 : side === 2 ? x0 : x1;
                const from = vertical ? x0 : y0;
                const to = vertical ? x1 : y1;
                // Nearest line within GAP (from the edge outwards) that has ink.
                let found = -1;
                for (let d = 0; d < GAP && found < 0; d++) {
                  const line = edge + dir * d;
                  if (line < 0 || line > limit - 1) break;
                  for (let k = from; k < to; k++) {
                    const i = (vertical ? line * W + k : k * W + line) * 4;
                    if (px[i]! + px[i + 1]! + px[i + 2]! < 600) { // darker than light grey
                      found = d;
                      break;
                    }
                  }
                }
                if (found < 0) break;
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
          const m = Math.round(c.width * 0.006);
          x0 = Math.max(0, x0 - m);
          y0 = Math.max(0, y0 - m);
          x1 = Math.min(c.width, x1 + m);
          y1 = Math.min(c.height, y1 + m);
          const out = document.createElement("canvas");
          out.width = x1 - x0;
          out.height = y1 - y0;
          out.getContext("2d")!.drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
          return out.toDataURL("image/png");
        },
        f.absPage - 1,
        [ymin, xmin, ymax, xmax]
      );
      if (!dataUrl) continue;
      const place = (["STATEMENT", "A", "B", "C", "D"].includes(String(f.place).toUpperCase()) ? String(f.place).toUpperCase() : "STATEMENT") as FigurePlace;
      crops.push({ questionNumber: f.question, place, page: f.absPage, box: [ymin, xmin, ymax, xmax], png: Buffer.from(dataUrl.split(",")[1]!, "base64") });
    }
    return crops;
  } finally {
    await browser.close().catch(() => undefined);
  }
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
