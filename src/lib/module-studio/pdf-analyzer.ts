import "server-only";
import { loadServerPdfJs } from "@/lib/pdf/server-pdf";

export interface PdfAnalysisReport {
  totalPages: number;
  textPagesCount: number;
  scannedPagesCount: number;
  imagesEstimateCount: number;
  totalCharacters: number;
  recommendedMode: "FAST_EDITABLE" | "AI_ENHANCE";
  pdfType: "DIGITAL" | "SCANNED" | "HYBRID";
  pageProfiles: {
    pageNumber: number;
    charCount: number;
    isScanned: boolean;
    hasMathOrFormulas: boolean;
  }[];
}

/**
 * Pre-flight PDF analyzer that classifies the PDF in milliseconds,
 * reporting total pages, text pages, scanned pages, and recommending
 * the fastest extraction mode without blocking execution.
 */
export async function analyzePdfDocument(fileBuffer: Buffer): Promise<PdfAnalysisReport> {
  const pdfjs = await loadServerPdfJs();
  const data = new Uint8Array(fileBuffer);
  const doc = await pdfjs.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
    verbosity: 0,
  }).promise;

  const totalPages = doc.numPages;
  let textPagesCount = 0;
  let scannedPagesCount = 0;
  let totalCharacters = 0;
  const pageProfiles: PdfAnalysisReport["pageProfiles"] = [];

  for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item: any) => ("str" in item ? item.str : ""))
      .join(" ")
      .trim();

    const charCount = text.length;
    totalCharacters += charCount;
    const isScanned = charCount < 25;
    const hasMathOrFormulas = /[\+\-\*\/\^=_\{\}\(\)\[\]\\α-ωΑ-Ω→Δ]|(?:[A-Z][a-z]?\d+)+/.test(text);

    if (isScanned) {
      scannedPagesCount++;
    } else {
      textPagesCount++;
    }

    pageProfiles.push({
      pageNumber,
      charCount,
      isScanned,
      hasMathOrFormulas,
    });
  }

  const pdfType: "DIGITAL" | "SCANNED" | "HYBRID" =
    scannedPagesCount === 0 ? "DIGITAL" : scannedPagesCount === totalPages ? "SCANNED" : "HYBRID";

  // Recommend FAST_EDITABLE by default for instant extraction
  const recommendedMode: "FAST_EDITABLE" | "AI_ENHANCE" =
    pdfType === "DIGITAL" ? "FAST_EDITABLE" : "AI_ENHANCE";

  return {
    totalPages,
    textPagesCount,
    scannedPagesCount,
    imagesEstimateCount: scannedPagesCount * 2,
    totalCharacters,
    recommendedMode,
    pdfType,
    pageProfiles,
  };
}
