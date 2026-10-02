import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { executeGeminiWithFailover } from "@/lib/questions/gemini-engine";
import { parseAiJson } from "@/lib/ai/latex-json";
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
    const model = client.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType: "application/json", temperature: 0 } });
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
          // A little margin so a bond or charge at the edge is never clipped.
          const pad = 0.012;
          const y0 = Math.max(0, box[0]! / 1000 - pad) * c.height;
          const x0 = Math.max(0, box[1]! / 1000 - pad) * c.width;
          const y1 = Math.min(1, box[2]! / 1000 + pad) * c.height;
          const x1 = Math.min(1, box[3]! / 1000 + pad) * c.width;
          const out = document.createElement("canvas");
          out.width = Math.round(x1 - x0);
          out.height = Math.round(y1 - y0);
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
