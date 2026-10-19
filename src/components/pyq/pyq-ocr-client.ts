/**
 * OCR for scanned PYQ pages, run in the reviewer's browser — the same
 * approach as Module Studio (src/lib/module-studio/ocr-client.ts): a
 * serverless request has neither the time nor the memory for Tesseract.
 * The page is rendered with pdf.js, read with tesseract.js (English +
 * Hindi) and the recognised text is posted to the import, where the same
 * deterministic parser reads it. Diagrams and equations are not rebuilt —
 * those questions are flagged for review.
 */

export type PyqOcrProgress = { pageNumber: number; index: number; total: number; phase: string; percent: number };

const RENDER_SCALE = 2;
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

export async function releasePyqOcr() {
  const w = workerPromise;
  workerPromise = null;
  if (w) await (await w).terminate().catch(() => {});
}

export async function ocrPyqPages(
  jobId: string,
  pdfUrl: string,
  pageNumbers: number[],
  onProgress: (p: PyqOcrProgress) => void,
  signal?: AbortSignal
): Promise<{ pageNumber: number; ok: boolean; error?: string }[]> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const doc = await pdfjsLib.getDocument({ url: pdfUrl }).promise;
  const out: { pageNumber: number; ok: boolean; error?: string }[] = [];
  let cur = { pageNumber: pageNumbers[0] ?? 1, index: 0 };
  try {
    const worker = await getWorker((p) => onProgress({ ...cur, total: pageNumbers.length, phase: "Reading text", percent: Math.round(p * 100) }));
    for (let i = 0; i < pageNumbers.length; i++) {
      if (signal?.aborted) break;
      const pageNumber = pageNumbers[i]!;
      cur = { pageNumber, index: i };
      try {
        onProgress({ ...cur, total: pageNumbers.length, phase: "Rendering page", percent: 0 });
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
        const { data } = await worker.recognize(canvas);
        canvas.width = canvas.height = 0;
        onProgress({ ...cur, total: pageNumbers.length, phase: "Saving", percent: 100 });
        const res = await fetch(`/api/team/pyq/imports/${jobId}/ocr-page`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pageNumber, text: String(data?.text ?? "").slice(0, 60_000), confidence: Math.max(0, Math.min(100, Number(data?.confidence) || 0)) }),
          signal,
        });
        const body = await res.json().catch(() => null);
        if (!res.ok || !body?.success) throw new Error(body?.error ?? `Saving OCR text failed (HTTP ${res.status}).`);
        out.push({ pageNumber, ok: true });
      } catch (err) {
        if (signal?.aborted) break;
        out.push({ pageNumber, ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }
  } finally {
    await doc.destroy().catch(() => {});
  }
  return out;
}
