/**
 * OCR for scanned module pages, run in the team member's browser.
 *
 * The server cannot OCR: a serverless request has neither the time nor the
 * memory for Tesseract on a page image. So the browser renders the page with
 * pdf.js, recognises it with tesseract.js (English + Hindi), and posts the
 * recognised lines — text, box in PDF points, confidence — to
 * `POST /api/team/modules/[id]/process?action=ocr-page`, where they become
 * editable blocks marked `source: "OCR"`.
 *
 * OCR is a best effort: equations, chemical structures and diagrams are not
 * reconstructed; low-confidence lines are flagged for review on the server.
 */

export type OcrProgress = { pageNumber: number; index: number; total: number; phase: "loading" | "rendering" | "recognising" | "saving"; percent: number };

export type OcrPageOutcome = { pageNumber: number; ok: boolean; confidence?: number; lines?: number; error?: string };

type OcrLine = { text: string; bbox: { x: number; y: number; w: number; h: number }; confidence: number };

const RENDER_SCALE = 2; // ~144 dpi — enough for printed text, still fast
const MAX_RENDER_PX = 2600;

let workerPromise: Promise<any> | null = null;

async function getWorker(onLog?: (p: number) => void) {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import("tesseract.js");
      return createWorker("eng+hin", 1, {
        logger: (m: any) => {
          if (m?.status === "recognizing text" && typeof m.progress === "number") onLog?.(m.progress);
        },
      });
    })().catch((e) => {
      workerPromise = null;
      throw e;
    });
  }
  return workerPromise;
}

/** Frees the OCR engine (about 100 MB in the tab) when the team member is done. */
export async function releaseOcr() {
  const w = workerPromise;
  workerPromise = null;
  if (w) await (await w).terminate().catch(() => {});
}

function linesFrom(data: any): { text: string; bbox: { x0: number; y0: number; x1: number; y1: number }; confidence: number }[] {
  if (Array.isArray(data?.lines) && data.lines.length) return data.lines;
  const out: any[] = [];
  for (const b of data?.blocks ?? []) for (const p of b?.paragraphs ?? []) for (const l of p?.lines ?? []) out.push(l);
  return out;
}

export async function ocrModulePages(
  moduleId: string,
  pdfUrl: string,
  pageNumbers: number[],
  onProgress: (p: OcrProgress) => void,
  signal?: AbortSignal
): Promise<OcrPageOutcome[]> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const doc = await pdfjsLib.getDocument({ url: pdfUrl }).promise;
  const results: OcrPageOutcome[] = [];
  let current = { pageNumber: pageNumbers[0] ?? 1, index: 0 };
  try {
    onProgress({ ...current, total: pageNumbers.length, phase: "loading", percent: 0 });
    const worker = await getWorker((p) => onProgress({ ...current, total: pageNumbers.length, phase: "recognising", percent: Math.round(p * 100) }));
    for (let i = 0; i < pageNumbers.length; i++) {
      if (signal?.aborted) break;
      const pageNumber = pageNumbers[i]!;
      current = { pageNumber, index: i };
      try {
        onProgress({ ...current, total: pageNumbers.length, phase: "rendering", percent: 0 });
        const page = await doc.getPage(pageNumber);
        const base = page.getViewport({ scale: 1 });
        const scale = Math.min(RENDER_SCALE, MAX_RENDER_PX / Math.max(base.width, base.height));
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;
        page.cleanup();

        onProgress({ ...current, total: pageNumbers.length, phase: "recognising", percent: 0 });
        const { data } = await worker.recognize(canvas, {}, { blocks: true, text: true });
        canvas.width = canvas.height = 0;

        const lines: OcrLine[] = linesFrom(data)
          .map((l) => ({
            text: String(l.text ?? "").replace(/\s+/g, " ").trim().slice(0, 4000),
            bbox: { x: l.bbox.x0 / scale, y: l.bbox.y0 / scale, w: (l.bbox.x1 - l.bbox.x0) / scale, h: (l.bbox.y1 - l.bbox.y0) / scale },
            confidence: Math.max(0, Math.min(100, Number(l.confidence) || 0)),
          }))
          .filter((l) => l.text.length > 0)
          .slice(0, 3000);

        onProgress({ ...current, total: pageNumbers.length, phase: "saving", percent: 100 });
        const res = await fetch(`/api/team/modules/${moduleId}/process?action=ocr-page`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageNumber, confidence: Math.max(0, Math.min(100, Number(data?.confidence) || 0)), width: base.width, height: base.height, lines }),
          signal,
        });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.success) throw new Error(body?.error ?? `Saving the OCR result failed (HTTP ${res.status}).`);
        results.push({ pageNumber, ok: true, confidence: Math.round(Number(data?.confidence) || 0), lines: lines.length });
      } catch (err) {
        if (signal?.aborted) break;
        results.push({ pageNumber, ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }
  } finally {
    await doc.destroy().catch(() => {});
  }
  return results;
}
