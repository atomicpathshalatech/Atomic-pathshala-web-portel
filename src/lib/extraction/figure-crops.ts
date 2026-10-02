import "server-only";
import { executeGeminiWithFailover } from "@/lib/questions/gemini-engine";
import { parseAiJson } from "@/lib/ai/latex-json";
import { lightThinking } from "@/lib/ai/gemini-models";
import { withRenderedPdf } from "@/lib/pdf/page-renderer";

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

/** Renders the PDF, locates the figures and crops them. Pages beyond `maxPages` are skipped. */
export async function cropQuestionFigures(pdf: Buffer, opts: { maxPages?: number } = {}): Promise<CroppedFigure[]> {
  return withRenderedPdf(pdf, async (doc) => {
    const last = Math.min(doc.pageCount, opts.maxPages ?? 60);
    const crops: CroppedFigure[] = [];
    for (let first = 1; first <= last; first += PAGES_PER_CALL) {
      const numbers = Array.from({ length: Math.min(PAGES_PER_CALL, last - first + 1) }, (_, i) => first + i);
      const images = await Promise.all(numbers.map((n) => doc.jpeg(n)));
      const found = await locateFigures(images).catch((err) => {
        console.warn("[figure-crops] locate failed for pages", first, err);
        return [] as Located[];
      });
      for (const f of found) {
        if (f.page < 1 || f.page > numbers.length) continue;
        const absPage = numbers[f.page - 1]!;
        const box = f.box.map((n) => Math.max(0, Math.min(1000, n))) as [number, number, number, number];
        if (box[2] - box[0] < 8 || box[3] - box[1] < 8) continue;
        // Grows past a tight box (labels like CH3 / NO2 / the O of C=O),
        // trims a stray text line, then fits the drawing.
        const png = await doc.crop(absPage, box, { grow: true });
        if (!png) continue;
        const place = (["STATEMENT", "A", "B", "C", "D"].includes(String(f.place).toUpperCase()) ? String(f.place).toUpperCase() : "STATEMENT") as FigurePlace;
        crops.push({ questionNumber: f.question, place, page: absPage, box, png });
      }
      for (const n of numbers) await doc.release(n);
    }
    return crops;
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
