import "server-only";

// Server-side PDF text extraction via pdfjs-dist's legacy Node build.
// Deliberately text-only (no page-image rendering): rendering a PDF page to
// an image server-side needs a native canvas binding (@napi-rs/canvas),
// which pdfjs-dist tries and falls back gracefully without — confirmed
// working for pure text extraction in this exact environment. That's why
// this pipeline handles ModulePdfType.DIGITAL (real embedded text) well
// and flags SCANNED/image-only PDFs for manual review instead of
// pretending to OCR them.
export type ExtractedPage = {
  pageNumber: number;
  width: number;
  height: number;
  text: string;
};

export async function extractPdfPages(fileBuffer: Buffer): Promise<{ pages: ExtractedPage[]; pageCount: number }> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(fileBuffer);
  const doc = await pdfjs.getDocument({ data, useWorkerFetch: false, isEvalSupported: false, disableFontFace: true }).promise;

  const pages: ExtractedPage[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    pages.push({ pageNumber, width: viewport.width, height: viewport.height, text });
  }

  return { pages, pageCount: doc.numPages };
}

/** A page with next to no extractable text is almost certainly a scanned
 * image, not real embedded text — flagged for manual review rather than
 * run through the AI structuring pass on an empty string. */
export function looksScanned(page: ExtractedPage): boolean {
  return page.text.length < 20;
}
