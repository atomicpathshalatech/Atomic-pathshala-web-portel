export interface ExtractedNcertElement {
  type: "heading" | "paragraph" | "list" | "table" | "diagram_caption" | "formula";
  content: string;
}

export interface ExtractedNcertPage {
  pageNumber: number;
  width: number;
  height: number;
  extractedText: string;
  extractedElements: ExtractedNcertElement[];
}

export interface PdfProcessingResult {
  totalPages: number;
  pages: ExtractedNcertPage[];
}

/**
 * Extracts NCERT PDF content with strict page boundary preservation.
 * Uses pdfjs-dist's legacy Node build.
 * Extracts:
 * - Exact 1-based page numbers
 * - Full page text with spacing preserved
 * - Structured elements: headings (uppercase or short bold-like lines), paragraphs, lists, diagram captions, formulas
 */
import { loadServerPdfJs } from "@/lib/pdf/server-pdf";

export async function extractNcertPagesFromPdf(fileBuffer: Buffer): Promise<PdfProcessingResult> {
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
  const pages: ExtractedNcertPage[] = [];

  for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();

    // Group items by line based on vertical coordinate Y
    const lineMap = new Map<number, string[]>();
    for (const item of textContent.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const transform = (item as any).transform;
      // Approximate line y coordinate (round to 4 points to group same-line text)
      const y = Math.round(transform[5] / 4) * 4;
      if (!lineMap.has(y)) {
        lineMap.set(y, []);
      }
      lineMap.get(y)!.push(item.str);
    }

    // Sort descending by Y (top of page down to bottom)
    const sortedY = Array.from(lineMap.keys()).sort((a, b) => b - a);
    const lines: string[] = [];
    for (const y of sortedY) {
      const lineText = lineMap.get(y)!.join(" ").trim();
      if (lineText) {
        lines.push(lineText);
      }
    }

    const fullPageText = lines.join("\n").trim();

    // Detect structural elements
    const extractedElements: ExtractedNcertElement[] = [];
    let currentParagraphLines: string[] = [];

    const flushParagraph = () => {
      if (currentParagraphLines.length > 0) {
        const pText = currentParagraphLines.join(" ").trim();
        if (pText) {
          extractedElements.push({ type: "paragraph", content: pText });
        }
        currentParagraphLines = [];
      }
    };

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Check for Diagram / Figure / Table caption (NCERT style: "Figure 1.1 ...", "चित्र 1.1 ...", "Table 1.2 ...", "सारणी 1.2 ...")
      if (
        /^(figure|fig\.|चित्र|table|सारणी|diagram)\s+[\d\.]+/i.test(trimmed) ||
        /^चित्र\s*[\d\.]+/i.test(trimmed)
      ) {
        flushParagraph();
        extractedElements.push({ type: "diagram_caption", content: trimmed });
        continue;
      }

      // Check for formulas / equations (e.g. "E = mc^2", "v = u + at", "ΔG = ΔH - TΔS", equation numbers like "(1.1)")
      if (/\([0-9]+\.[0-9]+\)$/.test(trimmed) || /^(\[?[A-Za-zα-ωΑ-ΩΔ]\]?\s*=\s*)/.test(trimmed)) {
        flushParagraph();
        extractedElements.push({ type: "formula", content: trimmed });
        continue;
      }

      // Check for list item ("1.", "2.", "•", "-", "(i)", "(a)")
      if (/^(\d+\.|\•|\-|\([a-z0-9ivx]+\))\s+/i.test(trimmed)) {
        flushParagraph();
        extractedElements.push({ type: "list", content: trimmed });
        continue;
      }

      // Check for section heading (e.g., "1.1 WHAT IS LIVING?", "1.2 DIVERSITY IN THE LIVING WORLD", or short title)
      const isHeadingPattern =
        /^\d+\.\d+(\.\d+)?\s+[A-Z\u0900-\u097F\s\?\!]+$/.test(trimmed) ||
        (trimmed.length < 60 && trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) ||
        (/^\d+\.\d+\s+/.test(trimmed) && trimmed.length < 80);

      if (isHeadingPattern) {
        flushParagraph();
        extractedElements.push({ type: "heading", content: trimmed });
        continue;
      }

      // Otherwise normal prose
      currentParagraphLines.push(trimmed);
    }

    flushParagraph();

    pages.push({
      pageNumber: pageNum,
      width: Math.round(viewport.width),
      height: Math.round(viewport.height),
      extractedText: fullPageText,
      extractedElements,
    });
  }

  return { totalPages, pages };
}
