/**
 * Safe PDF.js loader for Node.js / Next.js Serverless environments (e.g. Vercel Lambda).
 *
 * In serverless environments, Next.js bundles server code into webpack chunks.
 * If pdfjs-dist runs without a pre-registered worker, it tries to dynamically import
 * 'pdf.worker.mjs' from the chunk directory (`/var/task/.next/server/chunks/pdf.worker.mjs`),
 * which fails with:
 *   "Setting up fake worker failed: Cannot find module '/var/task/.next/server/chunks/pdf.worker.mjs'"
 *
 * Pre-importing `pdfjs-dist/legacy/build/pdf.worker.mjs` and assigning it to
 * `(globalThis as any).pdfjsWorker` satisfies PDF.js's native `#mainThreadWorkerMessageHandler`
 * check, so fake worker setup completes in-memory without any disk file imports.
 */
export async function loadServerPdfJs() {
  if (typeof globalThis !== "undefined" && !(globalThis as any).pdfjsWorker) {
    try {
      // @ts-ignore - dynamic worker import for serverless environment
      const worker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
      (globalThis as any).pdfjsWorker = worker;
    } catch (workerErr) {
      console.warn("[loadServerPdfJs] Warning importing pdf.worker.mjs:", workerErr);
    }
  }

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return pdfjs;
}
