import type { RenderedPdf } from "@/lib/pdf/page-renderer";
import type { ExtractedAiQuestion } from "./pdf-extractor";
import { cropFiguresOnDoc, type CroppedFigure } from "./figure-crops";
import { cardBoxFromMarkers, questionMarkers, snapCardBox, type QuestionMarker } from "./card-snap";

/** A question whose text has a [FIGURE] placeholder. */
export const hasFigure = (q: ExtractedAiQuestion) => /\[FIGURE\]/.test([q.statement, ...Object.values(q.options || {})].join(" "));

const area = (b: number[]) => Math.max(0, b[2]! - b[0]!) * Math.max(0, b[3]! - b[1]!);
/** Share of the smaller box inside the other. */
const contained = (a: number[], b: number[]) => {
  const inter = Math.max(0, Math.min(a[2]!, b[2]!) - Math.max(a[0]!, b[0]!)) * Math.max(0, Math.min(a[3]!, b[3]!) - Math.max(a[1]!, b[1]!));
  return inter / Math.max(1, Math.min(area(a), area(b)));
};

/**
 * The two images of each question read from page images, cropped from the
 * pages already rendered:
 * - figures: the drawings that go into the statement / options. The
 *   dedicated figure locator's boxes are much tighter than the ones the
 *   extraction call gives, so its crops are used; the extraction decides
 *   where they go ([FIGURE] in the statement or an option) when both found
 *   the same number of drawings. The extraction's own boxes are only used
 *   when the locator found nothing for that question.
 * - cards: the reference image of the whole printed question, by number.
 */
export async function cropQuestionImages(opts: {
  doc: RenderedPdf;
  pdf: Buffer | null;
  questions: ExtractedAiQuestion[];
  /** The pages these questions were read from. */
  pages: number[];
  /** Pages with drawings, for the figure locator. */
  figurePages: number[];
}): Promise<{ figures: CroppedFigure[]; cards: Map<number, Buffer> }> {
  const { doc, pdf, questions, pages, figurePages } = opts;
  const inPages = (pg: number) => pages.includes(pg);
  const figures: CroppedFigure[] = [];
  const cards = new Map<number, Buffer>();

  // Printed question numbers on these pages (text layer): the reference
  // image runs from a question's number to the next one.
  const markers = pdf
    ? await questionMarkers(pdf, pages).catch(() => new Map<number, QuestionMarker[]>())
    : new Map<number, QuestionMarker[]>();
  // A figure box holding another question's printed number is far too big
  // (it ran into the next question): never used. A number sits a little
  // left of its text, so the box is looked at with room on the left.
  const foreign = (num: number, page: number, box: number[]) =>
    (markers.get(page) ?? []).some((m) => m.num > 0 && m.num !== num && m.y > box[0]! && m.y < box[2]! && m.x > box[1]! - 60 && m.x < box[3]!);

  const located = (
    figurePages.length
      ? await cropFiguresOnDoc(doc, { pages: figurePages }).catch((err) => {
          console.warn("[question-images] figure locator failed:", err);
          return [] as CroppedFigure[];
        })
      : []
  ).filter((l) => !foreign(l.questionNumber, l.page, l.box));

  // Grown out to the ink; when that ran far past the box (through lines of
  // text packed close), the box as given is used instead.
  const pageSize = new Map<number, { width: number; height: number }>();
  const cropFigure = async (page: number, box: [number, number, number, number], place: string) => {
    const png = await doc.crop(page, box, { grow: true, option: place !== "STATEMENT" }).catch(() => null);
    if (!png) return null;
    if (!pageSize.has(page)) pageSize.set(page, await doc.render(page));
    const expected = ((box[2] - box[0]) / 1000) * pageSize.get(page)!.height;
    return png.readUInt32BE(20) > expected * 1.6 + 40 ? await doc.crop(page, box, { grow: false }).catch(() => png) : png;
  };

  const reading = (x: { box: number[] }, y: { box: number[] }) => x.box[0]! - y.box[0]! || x.box[1]! - y.box[1]!;
  for (const q of questions) {
    const own = located.filter((l) => l.questionNumber === q.originalNumber && inPages(l.page)).sort(reading);
    const asked = (q.figureBoxes ?? [])
      .map((f) => ({ ...f, page: inPages(f.page) ? f.page : q.sourcePage }))
      .filter((f) => inPages(f.page) && f.box[2] - f.box[0] >= 8 && f.box[3] - f.box[1] >= 8 && !foreign(q.originalNumber, f.page, f.box))
      .sort(reading);
    if (own.length && own.length === asked.length) {
      // Both reads found the same drawings: the locator's crop (its boxes
      // are the tighter ones), placed where the extraction put [FIGURE] —
      // unless the extraction's box is clearly the tighter one.
      for (const [i, f] of asked.entries()) {
        const l = own[i]!;
        const tighter = contained(l.box, f.box) > 0.6 && area(f.box) < area(l.box) * 0.7;
        const box = tighter ? f.box : l.box;
        const png = await cropFigure(l.page, box, f.place);
        if (png) figures.push({ questionNumber: q.originalNumber, place: f.place, page: l.page, png, box });
      }
    } else if (own.length) {
      for (const l of own) {
        const png = await cropFigure(l.page, l.box, l.place);
        if (png) figures.push({ ...l, png });
      }
    } else {
      for (const f of asked) {
        // The extraction's box is often a little tight (a CH₃ above a ring
        // got clipped): widen it, then the crop tightens back to the ink. An
        // option's drawing sits right after its "(1)".
        const [y0, x0, y1, x1] = f.box;
        const left = f.place === "STATEMENT" ? 12 : 3;
        const box: [number, number, number, number] = [Math.max(0, y0 - 18), Math.max(0, x0 - left), Math.min(1000, y1 + 18), Math.min(1000, x1 + 12)];
        const png = await cropFigure(f.page, box, f.place);
        if (png) figures.push({ questionNumber: q.originalNumber, place: f.place, page: f.page, png, box: f.box });
      }
    }

    const cardPage = q.cardBox && inPages(q.cardBox.page) ? q.cardBox.page : q.sourcePage;
    if (!inPages(cardPage)) continue;
    // The whole question as printed. Snapped to the printed numbers (the AI
    // box only says which column / roughly where); without an AI box, from
    // the printed numbers alone; scanned pages keep the AI box, never into
    // the next question's box below it.
    const pageMarkers = markers.get(cardPage);
    const snap = q.cardBox ? snapCardBox(pageMarkers, q.originalNumber, q.cardBox.box) : null;
    const fromText = !q.cardBox ? cardBoxFromMarkers(pageMarkers, q.originalNumber) : null;
    let png: Buffer | null = null;
    if (snap?.snapped || fromText) {
      png = await doc.crop(cardPage, (snap?.snapped ? snap.box : fromText)!, { card: true }).catch(() => null);
    } else if (q.cardBox) {
      const [y0, x0, y1, x1] = q.cardBox.box;
      const below = questions
        .map((o) => o.cardBox)
        .filter((o): o is NonNullable<typeof o> => !!o && o !== q.cardBox && o.page === q.cardBox!.page && o.box[0] > y0 + 10 && Math.min(x1, o.box[3]) - Math.max(x0, o.box[1]) > (x1 - x0) * 0.3)
        .map((o) => o.box[0]);
      const bottom = Math.min(1000, y1 + 6, below.length ? Math.min(...below) - 8 : 1000);
      png = await doc.crop(cardPage, [Math.max(0, y0 - 6), Math.max(0, x0 - 6), bottom, Math.min(1000, x1 + 6)], { grow: false }).catch(() => null);
    }
    if (png) cards.set(q.originalNumber, png);
  }

  return { figures, cards };
}
