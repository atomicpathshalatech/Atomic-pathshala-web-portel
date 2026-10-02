import "server-only";
import { cropFigure, decodeImage, type Box } from "@/lib/images/figure-crop";
import { uploadFile } from "@/lib/storage";
import type { ExtractedQuestionData } from "@/lib/questions/gemini-engine";

export const FIGURE_MARKER = "[FIGURE]";

/**
 * A pasted question image may contain drawings (chemical structures,
 * diagrams, graphs). The extractor marks where each one sits with [FIGURE]
 * and gives its box; here every drawing is cropped from the pasted image
 * itself and put back in its place — statement or option, both languages —
 * so the structure is exactly the printed one, never a guessed formula.
 */
export async function attachPastedFigures(
  result: ExtractedQuestionData,
  image: { base64: string; mimeType: string },
  keyPrefix: string
): Promise<ExtractedQuestionData> {
  const figures = (result.figures ?? []).filter((f) => Array.isArray(f.box) && f.box.length === 4);
  const next: ExtractedQuestionData = {
    ...result,
    optionsEn: { ...result.optionsEn },
    optionsHi: { ...result.optionsHi },
  };

  if (figures.length) {
    try {
      const buf = Buffer.from(image.base64.replace(/^data:[^,]+,/, ""), "base64");
      // Plain JS crop (milliseconds) — no headless browser for a pasted image.
      const raster = decodeImage(buf, image.mimeType);
      const crops: { place: string; png: Buffer }[] = [];
      for (const f of figures) {
        const box = f.box.map((n) => Math.max(0, Math.min(1000, n))) as Box;
        if (box[2] - box[0] < 8 || box[3] - box[1] < 8) continue;
        const png = cropFigure(raster, box, { grow: true });
        if (png) crops.push({ place: String(f.place || "STATEMENT").toUpperCase(), png });
      }
      // Uploads in parallel.
      const urls = await Promise.all(
        crops.map((c, i) => uploadFile({ key: `questions/pasted/${keyPrefix}-${i}.png`, body: c.png, contentType: "image/png" }))
      );

      for (const [i, c] of crops.entries()) {
        const url = urls[i]!;
        const isOption = ["A", "B", "C", "D"].includes(c.place);
        const md = `![${isOption ? "70%" : "45%"}](${url})`;
        const put = (text: string) =>
          text.includes(FIGURE_MARKER) ? text.replace(FIGURE_MARKER, md) : `${text}${text.trim() ? "\n" : ""}${md}`;
        if (isOption) {
          const k = c.place as "A" | "B" | "C" | "D";
          next.optionsEn[k] = put(next.optionsEn[k] ?? "");
          next.optionsHi[k] = put(next.optionsHi[k] ?? "");
        } else {
          next.statementEn = put(next.statementEn);
          next.statementHi = put(next.statementHi);
        }
      }
    } catch (err) {
      console.warn("[paste-figures] cropping skipped:", err);
    }
  }

  // Any marker left without a cropped drawing is taken out of the text.
  const strip = (t: string) => (t ? t.split(FIGURE_MARKER).join("").replace(/[ \t]{2,}/g, " ").trim() : t);
  next.statementEn = strip(next.statementEn);
  next.statementHi = strip(next.statementHi);
  for (const k of ["A", "B", "C", "D"] as const) {
    next.optionsEn[k] = strip(next.optionsEn[k]);
    next.optionsHi[k] = strip(next.optionsHi[k]);
  }
  delete next.figures;
  return next;
}
