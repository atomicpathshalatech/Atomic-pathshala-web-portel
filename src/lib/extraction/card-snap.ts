import { loadServerPdfJs } from "@/lib/pdf/server-pdf";

type Box = [number, number, number, number];

/** A printed question number (num > 0), a heading (0) or any text piece (-1): where it starts, 0–1000 from the top-left. */
export type QuestionMarker = { num: number; x: number; y: number };

/**
 * The printed question numbers on each page, from the text layer: digits in
 * body-size type (not subscripts) that start a line and are followed by a
 * gap ("9      CH₃CONH₂ …"). Two-digit numbers split into pieces are joined.
 */
export async function questionMarkers(pdf: Buffer, pages: number[]): Promise<Map<number, QuestionMarker[]>> {
  const out = new Map<number, QuestionMarker[]>();
  const pdfjs = await loadServerPdfJs();
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(pdf),
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
    verbosity: 0,
  }).promise;
  try {
    for (const n of pages) {
      if (n < 1 || n > doc.numPages) continue;
      const page = await doc.getPage(n);
      const vp = page.getViewport({ scale: 1 });
      const tc = await page.getTextContent();
      const items = (tc.items as any[])
        .filter((it) => typeof it.str === "string" && it.str.trim())
        .map((it) => ({
          str: String(it.str),
          x: Number(it.transform[4]),
          y: Number(it.transform[5]),
          w: Number(it.width) || 0,
          size: Math.abs(Number(it.transform[0])) || Math.abs(Number(it.transform[3])) || 10,
        }));
      // Body type size: the size most characters are printed in.
      const bySize = new Map<number, number>();
      for (const it of items) bySize.set(Math.round(it.size), (bySize.get(Math.round(it.size)) || 0) + it.str.length);
      const body = [...bySize.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 10;
      const sameLine = (a: { y: number }, b: { y: number }) => Math.abs(a.y - b.y) < 2;

      // Join pieces printed side by side ("1" "0" "." → "10.").
      const digits = items.filter((it) => it.size >= body * 0.85 && /^\s*[\d.)]{1,4}\s*$/.test(it.str)).sort((a, b) => b.y - a.y || a.x - b.x);
      const joined: typeof items = [];
      for (const d of digits) {
        const prev = joined[joined.length - 1];
        if (prev && sameLine(prev, d) && Math.abs(prev.x + prev.w - d.x) < 1.5 && !/[.)]$/.test(prev.str.trim())) {
          prev.str = prev.str.trim() + d.str.trim();
          prev.w = d.x + d.w - prev.x;
        } else joined.push({ ...d });
      }

      const markers: QuestionMarker[] = [];
      for (const d of joined) {
        const glued = items.some((o) => o !== d && sameLine(o, d) && o.x < d.x && o.x + o.w > d.x - 4);
        const next = items.filter((o) => sameLine(o, d) && o.x > d.x + d.w - 0.5).sort((a, b) => a.x - b.x)[0];
        const token = d.str.trim();
        // "12." / "12)" starts a question; a bare "12" only when a gap follows.
        if (glued || !/^\d{1,3}[.)]?$/.test(token) || (!/[.)]$/.test(token) && next && next.x - (d.x + d.w) < 6)) continue;
        const num = Number(token.replace(/[^\d]/g, ""));
        if (!num) continue;
        markers.push({
          num,
          x: Math.round((d.x / vp.width) * 1000),
          y: Math.round(((vp.height - (d.y + d.size * 0.9)) / vp.height) * 1000),
        });
      }
      // Three or more on one line is a table (an answer key), not question starts.
      const starts = markers.filter((m) => markers.filter((o) => Math.abs(o.y - m.y) <= 3).length < 3);
      const toMarker = (it: { x: number; y: number; size: number }, num: number) => ({
        num,
        x: Math.round((it.x / vp.width) * 1000),
        y: Math.round(((vp.height - (it.y + it.size * 0.9)) / vp.height) * 1000),
      });
      // Headings in large type ("EXERCISE-III") end the question above them (num 0).
      const headings = items.filter((it) => it.size >= body * 1.3 && /[A-Za-z]{3}/.test(it.str)).map((it) => toMarker(it, 0));
      // Every printed piece of text (num -1): where a question's text runs out.
      const text = items.filter((it) => it.size >= body * 0.6).map((it) => toMarker(it, -1));
      out.set(n, [...starts, ...headings, ...text]);
    }
  } finally {
    await doc.destroy();
  }
  return out;
}

/**
 * Where question `m`'s printed text ends: the last text in its column before
 * the next question / heading (or the footer band), stopping at a large empty gap (the end of a
 * page section, a banner or the footer).
 */
function textEnd(markers: QuestionMarker[], m: QuestionMarker, left: number, right: number, stop: number) {
  const lines = markers
    .filter((o) => o.num === -1 && o.x >= left - 10 && o.x <= right && o.y > m.y && o.y < Math.min(stop, 925))
    .map((o) => o.y)
    .sort((a, b) => a - b);
  let last = m.y;
  for (const y of lines) {
    if (y - last > 70) break;
    last = y;
  }
  return last + 28;
}

/**
 * The reference-image box of question `num`, snapped to the printed text:
 * from its own number down to the next question number in the same column.
 * The AI's box says which column and roughly where; when the number is not
 * found the AI box is kept.
 */
export function snapCardBox(markers: QuestionMarker[] | undefined, num: number, box: Box): { box: Box; snapped: boolean } {
  const [y0, x0, , x1] = box;
  if (!markers?.length) return { box, snapped: false };
  const inColumn = markers.filter((m) => m.num >= 0 && m.x >= x0 - 40 && m.x <= x0 + Math.max(60, (x1 - x0) * 0.15));
  const own = inColumn.filter((m) => m.num === num).sort((a, b) => Math.abs(a.y - y0) - Math.abs(b.y - y0))[0];
  if (!own || Math.abs(own.y - y0) > 250) return { box, snapped: false };
  const next = inColumn.filter((m) => m.y > own.y + 10).sort((a, b) => a.y - b.y)[0];
  const limit = Math.min(next ? next.y - 6 : 935, textEnd(markers, own, x0, x1, next?.y ?? 1000));
  // From just above the number (the crop moves it up when a drawing rises
  // above) to where the printed text ends — never the AI's own edges, which
  // can sit a line off.
  const top = Math.max(0, own.y - 3);
  const bottom = limit;
  return { box: [top, Math.max(0, x0 - 6), Math.min(1000, bottom), Math.min(1000, x1 + 6)], snapped: true };
}

/**
 * A reference-image box from the printed text alone (no AI box): from
 * question `num` to where its text ends, across its column. Only when the
 * number appears once on the page.
 */
export function cardBoxFromMarkers(markers: QuestionMarker[] | undefined, num: number): [number, number, number, number] | null {
  const own = (markers ?? []).filter((m) => m.num === num);
  if (own.length !== 1) return null;
  const m = own[0]!;
  const starts = markers!.filter((o) => o.num > 0);
  const next = markers!.filter((o) => o.num >= 0 && Math.abs(o.x - m.x) < 30 && o.y > m.y + 10).sort((a, b) => a.y - b.y)[0];
  const rightColumn = starts.filter((o) => o.x > m.x + 100).map((o) => o.x);
  const right = rightColumn.length ? Math.min(...rightColumn) - 12 : 975;
  const bottom = Math.min(next ? next.y - 6 : 935, textEnd(markers!, m, m.x, right, next?.y ?? 1000));
  return [Math.max(0, m.y - 3), Math.max(0, m.x - 10), bottom, right];
}
