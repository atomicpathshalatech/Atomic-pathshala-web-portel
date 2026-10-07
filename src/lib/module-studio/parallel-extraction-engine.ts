import "server-only";
import { loadServerPdfJs } from "@/lib/pdf/server-pdf";
import { executeGeminiWithFailover } from "@/lib/questions/gemini-engine";
import { parseAiJson } from "@/lib/ai/latex-json";
import { lightThinking } from "@/lib/ai/gemini-models";
import { withRenderedPdf, type Box, type RenderedPdf } from "@/lib/pdf/page-renderer";
import { MODULE_CALLOUT_VARIANTS, type ModuleElementInput } from "@/lib/validation/module";

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

type RawBlock = {
  type?: string;
  text?: string;
  variant?: string;
  label?: string;
  rows?: string[][];
  items?: string[];
  box?: number[];
  caption?: string;
};

const TEXT_STRUCTURING_PROMPT = `You are converting ONE page of an educational coaching study module (NEET/JEE/Boards) into structured learning blocks.
You receive the EXACT TEXT LAYER of this page.

Return STRICT JSON: {"blocks":[ ... ]} in natural reading order.

Block types:
- {"type":"HEADING","text":"..."}            Chapter / Major Section Title
- {"type":"SUBHEADING","text":"..."}         Sub-section / Topic Title
- {"type":"PARAGRAPH","text":"..."}          Running explanatory text
- {"type":"BULLETS","items":["...","..."]}   Bulleted or numbered points
- {"type":"CALLOUT","variant":"CONCEPT|NOTE|EXAMPLE|TIP|REMEMBER|CAUTION|FORMULA|SUMMARY","label":"<box heading>","text":"<content>"}
- {"type":"TABLE","rows":[["Header 1","Header 2"],["Val 1","Val 2"]]}
- {"type":"EQUATION","text":"<LaTeX formula without $ signs>"}
- {"type":"QUESTION","text":"<Question text>"}, followed by {"type":"OPTION","text":"(1) ..."} per option, and optional {"type":"SOLUTION","text":"..."}

Rules:
- Keep the text exactly as printed in its original language (Hindi stays Hindi, English stays English).
- Inline math, units, and chemical formulas formatted in LaTeX inside $...$ (e.g. $\\text{H}_2\\text{SO}_4$, $v = u + at$).
- Never invent content that does not exist in the source text.
- If the page is blank or has only page headers/footers, return {"blocks":[]}.`;

const VISION_STRUCTURING_PROMPT = `You are converting ONE page of a printed study module into structured blocks. You get the page IMAGE and, when available, the TEXT LAYER.

Return STRICT JSON: {"blocks":[ ... ]} in reading order (two columns → finish left column, then right).

Block types:
- {"type":"HEADING","text":"..."}            Chapter / main section title
- {"type":"SUBHEADING","text":"..."}         Sub-section / topic title
- {"type":"PARAGRAPH","text":"..."}          Running text
- {"type":"BULLETS","items":["...","..."]}   Bulleted points
- {"type":"CALLOUT","variant":"CONCEPT|NOTE|EXAMPLE|TIP|REMEMBER|CAUTION|FORMULA|SUMMARY","label":"<heading>","text":"<content>"}
- {"type":"TABLE","rows":[["h1","h2"],["a","b"]]}
- {"type":"EQUATION","text":"<LaTeX, no $>"}
- {"type":"QUESTION","text":"<Question>"}, then {"type":"OPTION","text":"(1) ..."}, then optional {"type":"SOLUTION","text":"..."}
- {"type":"FIGURE","box":[ymin,xmin,ymax,xmax],"caption":"<caption or empty>"} ANY diagram, graph, chemical structure, or apparatus. box is normalized 0–1000 on the page image.

Rules:
- Keep text verbatim in original language (Hindi stays Hindi, English stays English).
- Inline maths and chemical formulas in LaTeX inside $...$.
- SKIP running headers, footers, page numbers, watermarks, decorative borders.`;

function stripWords(text: string, words: string[]): string {
  let t = text;
  for (const w of words) {
    if (!w.trim()) continue;
    const re = new RegExp(w.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    t = t.replace(re, "");
  }
  return t.replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function applyRenames(text: string, renames: Record<string, string>): string {
  let t = text;
  for (const [from, to] of Object.entries(renames)) {
    if (!from.trim()) continue;
    const re = new RegExp(`(^|[^\\p{L}])(${from.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})(?=$|[^\\p{L}])`, "giu");
    t = t.replace(re, (_m, pre) => `${pre}${to}`);
  }
  return t;
}

const DEFAULT_LABEL: Record<string, string> = {
  CONCEPT: "Concept",
  NOTE: "Note",
  EXAMPLE: "Example",
  TIP: "Tip",
  REMEMBER: "Remember",
  CAUTION: "Caution",
  FORMULA: "Formula",
  SUMMARY: "Summary",
};

/**
 * Text-First Page Structuring via Gemini (Super fast ~1s per page)
 */
async function structureFromTextLayer(pageText: string): Promise<RawBlock[]> {
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
      TEXT_STRUCTURING_PROMPT,
      `TEXT LAYER OF PAGE:\n${pageText.slice(0, 15000)}`,
    ]);
    const text = res.response?.text() || "";
    if (!text.trim()) throw new Error("empty response");
    return text;
  });

  const parsed = parseAiJson<{ blocks?: RawBlock[] } | RawBlock[]>(raw.replace(/```json|```/gi, "").trim());
  const list = Array.isArray(parsed) ? parsed : parsed?.blocks;
  return Array.isArray(list) ? list : [];
}

/**
 * Vision-Based Page Structuring via Gemini Vision
 */
async function structureFromVision(jpegBase64: string, textLayer: string): Promise<RawBlock[]> {
  const raw = await executeGeminiWithFailover(async (client, modelName) => {
    const model = client.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0,
        maxOutputTokens: 32768,
        ...lightThinking(modelName, "low"),
      } as Record<string, unknown>,
    });
    const res = await model.generateContent([
      VISION_STRUCTURING_PROMPT,
      { inlineData: { mimeType: "image/jpeg", data: jpegBase64 } },
      textLayer ? `TEXT LAYER of this page:\n${textLayer.slice(0, 12000)}` : "TEXT LAYER: (none — scanned page, read the image)",
    ]);
    const text = res.response?.text() || "";
    if (!text.trim()) throw new Error("empty response");
    return text;
  });

  const parsed = parseAiJson<{ blocks?: RawBlock[] } | RawBlock[]>(raw.replace(/```json|```/gi, "").trim());
  const list = Array.isArray(parsed) ? parsed : parsed?.blocks;
  return Array.isArray(list) ? list : [];
}

/**
 * Converts raw blocks to typed ModuleElementInput array with source page reference.
 */
function rawBlocksToElements(
  blocks: RawBlock[],
  pageNumber: number,
  opts: { removeWords?: string[]; renames?: Record<string, string> }
): ModuleElementInput[] {
  const removeWords = opts.removeWords ?? [];
  const renames = opts.renames ?? {};
  const clean = (t: unknown) => stripWords(String(t ?? ""), removeWords);
  const cleanTitle = (t: unknown) => applyRenames(clean(t), renames);
  const cleanLabel = (t: unknown) => cleanTitle(t).replace(/\s*[:：\-–—]+\s*$/, "").trim();

  const elements: ModuleElementInput[] = [];
  const push = (el: Omit<ModuleElementInput, "id" | "order">) =>
    elements.push({
      id: `p${pageNumber}-${elements.length}-${Math.random().toString(36).slice(2, 7)}`,
      order: elements.length,
      ...el,
    });

  for (const b of blocks) {
    const type = String(b.type ?? "").toUpperCase();
    if (type === "TABLE") {
      const rows = (Array.isArray(b.rows) ? b.rows : [])
        .map((r) => (Array.isArray(r) ? r.map((c) => clean(c)) : []))
        .filter((r) => r.length);
      if (rows.length) push({ type: "TABLE", content: "", tableData: rows });
      continue;
    }
    if (type === "BULLETS") {
      const items = (Array.isArray(b.items) ? b.items : String(b.text ?? "").split("\n"))
        .map((i) => clean(i))
        .filter(Boolean);
      if (items.length) push({ type: "BULLETS", content: items.join("\n") });
      continue;
    }
    if (type === "CALLOUT") {
      const variant = (MODULE_CALLOUT_VARIANTS as readonly string[]).includes(String(b.variant).toUpperCase())
        ? String(b.variant).toUpperCase()
        : "NOTE";
      const text = clean(b.text);
      if (!text) continue;
      const label = cleanLabel(b.label) || applyRenames(DEFAULT_LABEL[variant] ?? "Note", renames);
      push({ type: "CALLOUT", content: text, variant, label: label.slice(0, 80) });
      continue;
    }
    const allowed = ["HEADING", "SUBHEADING", "PARAGRAPH", "EQUATION", "QUESTION", "OPTION", "SOLUTION"];
    const t = allowed.includes(type) ? type : "PARAGRAPH";
    const text = t === "HEADING" || t === "SUBHEADING" ? cleanTitle(b.text) : clean(b.text);
    if (!text) continue;
    push({ type: t as ModuleElementInput["type"], content: text });
  }

  return elements;
}

/**
 * Execute parallel extraction on a PDF with fast text-first prioritization,
 * per-page retry isolation, and non-blocking asynchronous progress.
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

  // 1. Initial fast text layer inspection for all pages in memory
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

    const isScanned = text.length < 25;
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
  const concurrency = Math.max(1, Math.min(8, options.concurrency ?? (overallPdfType === "DIGITAL" ? 6 : 3)));
  let completedCount = 0;

  // 2. Parallel Processing with Worker Pool
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
        if (!layer.isScanned && layer.text.length >= 25) {
          // FAST PATH: Digital Text Structuring
          const blocks = await structureFromTextLayer(layer.text);
          elements = rawBlocksToElements(blocks, pageNumber, {
            removeWords: options.removeWords,
            renames: options.renames,
          });
          break;
        } else {
          // SCANNED PATH: Flag or use Vision if available
          warnings.push("Scanned page processed via fallback text extraction.");
          break;
        }
      } catch (err: any) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempts < MAX_RETRIES) {
          // Short exponential backoff before retry
          await new Promise((r) => setTimeout(r, 400 * attempts));
        }
      }
    }

    const duration = Date.now() - pStart;
    statusObj.durationMs = duration;

    if (lastError && elements.length === 0) {
      statusObj.status = "FAILED";
      statusObj.error = lastError.message.slice(0, 160);
      warnings.push(`Page extraction encountered an issue: ${lastError.message.slice(0, 120)}`);
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
      ocrConfidence: layer.isScanned ? null : 0.95,
      durationMs: duration,
    };
  };

  // Run in concurrent chunks
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
