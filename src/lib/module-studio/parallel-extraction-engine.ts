import "server-only";
import { loadServerPdfJs } from "@/lib/pdf/server-pdf";
import { parsePageTextNatively } from "@/lib/module-studio/native-parser";
import { executeGeminiWithFailover } from "@/lib/questions/gemini-engine";
import { parseAiJson } from "@/lib/ai/latex-json";
import { lightThinking } from "@/lib/ai/gemini-models";
import type { ModuleElementInput } from "@/lib/validation/module";

export type PageStatusType = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface PageProcessingStatus {
  pageNumber: number;
  status: PageStatusType;
  attempts: number;
  error?: string | null;
  elementsCount: number;
  durationMs?: number;
  isScanned: boolean;
}

export interface ParallelExtractOptions {
  fromPage?: number;
  toPage?: number;
  mode?: "FAST_EDITABLE" | "AI_ENHANCE";
  concurrency?: number;
  removeWords?: string[];
  renames?: Record<string, string>;
  uploadImage?: (png: Buffer, name: string) => Promise<string>;
  onPageProgress?: (status: PageProcessingStatus, completedTotal: number, totalPages: number) => Promise<void> | void;
  shouldCancel?: () => boolean;
}

export interface ExtractedPageResult {
  pageNumber: number;
  width: number;
  height: number;
  pdfType: "DIGITAL" | "SCANNED" | "HYBRID";
  elements: ModuleElementInput[];
  warnings: string[];
  needsReview: boolean;
  ocrConfidence: number | null;
  durationMs: number;
}

export interface ParallelExtractionSummary {
  totalPages: number;
  completedPages: number;
  failedPages: number;
  pdfType: "DIGITAL" | "SCANNED" | "HYBRID";
  pages: ExtractedPageResult[];
  pageStatuses: Record<number, PageProcessingStatus>;
  totalDurationMs: number;
}

const AI_STRUCTURING_PROMPT = `You structure raw text extracted from an educational study module page into learning blocks.
Return JSON: {"blocks":[{"type":"HEADING|SUBHEADING|PARAGRAPH|BULLETS|CALLOUT|TABLE|EQUATION|QUESTION|OPTION|SOLUTION","text":"...","variant":"NOTE|CONCEPT|FORMULA|EXAMPLE|TIP","label":"..."}]}
Keep Hindi as Hindi and English as English verbatim.`;

async function aiStructurePage(text: string): Promise<any[]> {
  const raw = await executeGeminiWithFailover(async (client, modelName) => {
    const model = client.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
        maxOutputTokens: 16384,
        ...lightThinking(modelName, "low"),
      } as Record<string, unknown>,
    });
    const res = await model.generateContent([
      AI_STRUCTURING_PROMPT,
      `PAGE TEXT:\n${text.slice(0, 15000)}`,
    ]);
    return res.response?.text() || "";
  });

  const parsed = parseAiJson<{ blocks?: any[] } | any[]>(raw.replace(/```json|```/gi, "").trim());
  const list = Array.isArray(parsed) ? parsed : parsed?.blocks;
  return Array.isArray(list) ? list : [];
}

/**
 * Executes high-speed parallel extraction on a PDF:
 * 1. Uses Native Rule-Based Parser in FAST_EDITABLE mode (<1ms per page, zero AI API cost/timeout).
 * 2. Isolates failures per-page with automatic retry.
 * 3. Supports controlled concurrency and non-blocking background status reporting.
 */
export async function executeParallelPdfExtraction(
  pdfBuffer: Buffer,
  options: ParallelExtractOptions = {}
): Promise<ParallelExtractionSummary> {
  const startTime = Date.now();
  const pdfjs = await loadServerPdfJs();
  const data = new Uint8Array(pdfBuffer);
  const doc = await pdfjs.getDocument({
    data,
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
    verbosity: 0,
  }).promise;

  const totalDocPages = doc.numPages;
  const fromPage = Math.max(1, options.fromPage ?? 1);
  const toPage = Math.min(totalDocPages, options.toPage ?? totalDocPages);
  const pageNumbers = Array.from({ length: Math.max(0, toPage - fromPage + 1) }, (_, i) => fromPage + i);

  const mode = options.mode || "FAST_EDITABLE";

  // 1. Inspect text layers
  const textLayers: Record<number, { text: string; width: number; height: number; isScanned: boolean }> = {};
  for (const pNum of pageNumbers) {
    const page = await doc.getPage(pNum);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const text = content.items
      .map((item: any) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    const isScanned = text.length < 20;
    textLayers[pNum] = { text, width: viewport.width, height: viewport.height, isScanned };
  }

  const scannedCount = Object.values(textLayers).filter((t) => t.isScanned).length;
  const overallPdfType: "DIGITAL" | "SCANNED" | "HYBRID" =
    scannedCount === 0 ? "DIGITAL" : scannedCount === pageNumbers.length ? "SCANNED" : "HYBRID";

  const pageStatuses: Record<number, PageProcessingStatus> = {};
  for (const pNum of pageNumbers) {
    pageStatuses[pNum] = {
      pageNumber: pNum,
      status: "QUEUED",
      attempts: 0,
      elementsCount: 0,
      isScanned: textLayers[pNum]!.isScanned,
    };
  }

  const results: ExtractedPageResult[] = [];
  const concurrency = Math.max(1, Math.min(10, options.concurrency ?? 8));
  let completedCount = 0;

  // 2. Process Single Page with Native Parser or AI fallback
  const processSinglePage = async (pageNumber: number): Promise<ExtractedPageResult> => {
    const pStart = Date.now();
    const layer = textLayers[pageNumber]!;
    const statusObj = pageStatuses[pageNumber]!;
    statusObj.status = "PROCESSING";

    let attempts = 0;
    const MAX_RETRIES = 3;
    let lastError: Error | null = null;
    let elements: ModuleElementInput[] = [];
    const warnings: string[] = [];

    while (attempts < MAX_RETRIES) {
      attempts++;
      statusObj.attempts = attempts;
      try {
        if (!layer.isScanned && layer.text.length >= 20) {
          if (mode === "FAST_EDITABLE") {
            // FAST PATH: Pure Deterministic Native Rule-Based Parser (< 1ms per page)
            elements = parsePageTextNatively(layer.text, pageNumber, {
              removeWords: options.removeWords,
              renames: options.renames,
            });
          } else {
            // AI ENHANCE: Gemini Structuring
            const rawBlocks = await aiStructurePage(layer.text);
            elements = rawBlocks.map((b, idx) => ({
              id: `p${pageNumber}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
              order: idx,
              type: (b.type || "PARAGRAPH") as any,
              content: b.text || b.content || "",
              label: b.label,
              variant: b.variant,
            }));
          }
          break;
        } else {
          // Scanned page fallback
          if (layer.text.length > 0) {
            elements = parsePageTextNatively(layer.text, pageNumber, {
              removeWords: options.removeWords,
              renames: options.renames,
            });
          }
          warnings.push("Scanned page processed via fallback text layer.");
          break;
        }
      } catch (err: any) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempts < MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, 200 * attempts));
        }
      }
    }

    const duration = Date.now() - pStart;
    statusObj.durationMs = duration;

    if (lastError && elements.length === 0) {
      statusObj.status = "FAILED";
      statusObj.error = lastError.message.slice(0, 160);
      warnings.push(`Page issue: ${lastError.message.slice(0, 120)}`);
    } else {
      statusObj.status = "COMPLETED";
      statusObj.elementsCount = elements.length;
    }

    completedCount++;
    await options.onPageProgress?.(statusObj, completedCount, pageNumbers.length);

    return {
      pageNumber,
      width: layer.width,
      height: layer.height,
      pdfType: layer.isScanned ? "SCANNED" : "DIGITAL",
      elements,
      warnings,
      needsReview: warnings.length > 0 || elements.length === 0,
      ocrConfidence: layer.isScanned ? null : 0.98,
      durationMs: duration,
    };
  };

  // Run chunks in controlled concurrency
  for (let i = 0; i < pageNumbers.length; i += concurrency) {
    if (options.shouldCancel?.()) {
      break;
    }
    const chunk = pageNumbers.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map((pNum) => processSinglePage(pNum)));
    results.push(...chunkResults);
  }

  const failedCount = results.filter((r) => r.elements.length === 0 && r.warnings.length > 0).length;

  return {
    totalPages: pageNumbers.length,
    completedPages: results.length - failedCount,
    failedPages: failedCount,
    pdfType: overallPdfType,
    pages: results.sort((a, b) => a.pageNumber - b.pageNumber),
    pageStatuses,
    totalDurationMs: Date.now() - startTime,
  };
}
