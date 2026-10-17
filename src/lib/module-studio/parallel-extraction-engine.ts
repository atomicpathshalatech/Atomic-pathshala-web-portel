import "server-only";
import { loadServerPdfJs } from "@/lib/pdf/server-pdf";
import { extractPageLayout, layoutToBlocks } from "@/lib/module-studio/pdf-layout";
import { convertKrutiDevToUnicode, isKrutiDevEncoded } from "@/lib/module-studio/krutidev-converter";
import { executeGeminiWithFailover } from "@/lib/questions/gemini-engine";
import { parseAiJson } from "@/lib/ai/latex-json";
import { lightThinking } from "@/lib/ai/gemini-models";
import type { ModuleElementInput } from "@/lib/validation/module";

/**
 * QUEUED → PROCESSING → one of:
 *   COMPLETED  text read from the PDF's own text layer
 *   NEEDS_OCR  the page has (almost) no text layer — a scanned page; OCR runs
 *              in the editor, page by page, and then marks it OCR_DONE
 *   OCR_DONE   text recognised by OCR (confidence recorded per block)
 *   FAILED     this page could not be read (error kept); retried on request
 */
export type PageStatusType = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | "NEEDS_OCR" | "OCR_DONE";

export interface PageProcessingStatus {
  pageNumber: number;
  status: PageStatusType;
  attempts: number;
  error?: string | null;
  elementsCount: number;
  durationMs?: number;
  isScanned: boolean;
  source?: "TEXT" | "OCR" | "NONE";
  columns?: 1 | 2;
  images?: number;
  links?: string[];
  ocrConfidence?: number | null;
  warnings?: string[];
}

export interface ParallelExtractOptions {
  fromPage?: number;
  toPage?: number;
  /** Exact pages to process (retries); overrides fromPage/toPage. */
  pageNumbers?: number[];
  mode?: "FAST_EDITABLE" | "AI_ENHANCE";
  concurrency?: number;
  removeWords?: string[];
  renames?: Record<string, string>;
  uploadImage?: (png: Buffer, name: string) => Promise<string>;
  onPageProgress?: (status: PageProcessingStatus, completedTotal: number, totalPages: number) => Promise<void> | void;
  shouldCancel?: () => boolean;
  /** One page may not take longer than this (ms); it is then marked FAILED. */
  perPageTimeoutMs?: number;
  /** Tests only: make chosen pages fail. */
  simulatePageFailure?: (pageNumber: number) => boolean;
  /** Previous attempt counts, so retries are numbered. */
  previousAttempts?: Record<number, number>;
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
  status: PageStatusType;
  error?: string;
}

export interface ParallelExtractionSummary {
  /** Pages in the whole PDF (not just the range processed). */
  documentPages: number;
  totalPages: number;
  completedPages: number;
  failedPages: number;
  pdfType: "DIGITAL" | "SCANNED" | "HYBRID";
  pages: ExtractedPageResult[];
  pageStatuses: Record<number, PageProcessingStatus>;
  totalDurationMs: number;
}

const AI_STRUCTURING_PROMPT = `You are the Master Academic Document Structuring & OCR Decoder for Indian NEET/JEE modules (Atomic Pathshala).
The input text contains educational content extracted from a coaching module that uses DevLys 010 / Kruti Dev legacy font for Hindi mixed with English chemistry formulas, question labels, and mathematical equations.

CRITICAL INSTRUCTIONS:
1. HINDI DECODING TO STANDARD UNICODE (NOTO SANS DEVANAGARI):
   - Decode all DevLys 010 / Kruti Dev encoded Hindi characters into 100% accurate standard Unicode Devanagari Hindi.
   - Examples:
     * "jlk;u foKku" -> "रसायन विज्ञान"
     * "d qN vk/kkjHkwr fl)kar rFkk rduhdsa : oxhZdj.k ,oa ukedj.k" -> "कुछ आधारभूत सिद्धांत तथा तकनीकें : वर्गीकरण एवं नामकरण"
     * "[Vk syqbZu]" -> "[टोलुईन]"
     * "letkrh; Js.kh" -> "समजातीय श्रेणी"
     * "fØ;kRed lewg" -> "क्रियात्मक समूह"

2. PRESERVE ENGLISH, CHEMISTRY FORMULAS & MATH NOTATION EXACTLY:
   - "HC ≡ C – CH = CH – CH3" -> $\\text{HC}\\equiv\\text{C}-\\text{CH}=\\text{CH}-\\text{CH}_3$
   - "sp, sp2, sp3, dsp2" -> "sp, sp^2, sp^3, dsp^2"
   - "1°, 2°, 3°, 4°" -> "1°, 2°, 3°, 4°"
   - "Q.1", "Q.2", "Que. 1", "(1)", "(2)", "(3)", "(4)" -> maintain exact question & option tags.

3. STRUCTURE INTO OUTPUT JSON BLOCKS:
Return JSON:
{
  "blocks": [
    {
      "type": "HEADING | SUBHEADING | PARAGRAPH | QUESTION | OPTION | TABLE | CALLOUT | EQUATION | SOLUTION",
      "text": "Exact decoded Hindi/English content with math/formulas in LaTeX $...$",
      "label": "Optional label like 'Note', 'Example', 'Rule', 'Subrule (i)'",
      "variant": "NOTE | CONCEPT | FORMULA | EXAMPLE | TIP"
    }
  ]
}`;

async function aiStructurePage(text: string): Promise<any[]> {
  const raw = await executeGeminiWithFailover(async (client, modelName) => {
    const model = client.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.1,
        maxOutputTokens: 8192,
        ...lightThinking(modelName, "low"),
      } as Record<string, unknown>,
    });
    const res = await model.generateContent([
      AI_STRUCTURING_PROMPT,
      `RAW PAGE TEXT TO DECODE AND STRUCTURE:\n${text.slice(0, 12000)}`,
    ]);
    return res.response?.text() || "";
  });

  const parsed = parseAiJson<{ blocks?: any[] } | any[]>(raw.replace(/```json|```/gi, "").trim());
  const list = Array.isArray(parsed) ? parsed : parsed?.blocks;
  return Array.isArray(list) ? list : [];
}

/** Below this many characters a page is treated as scanned (OCR needed). */
const MIN_TEXT_CHARS = 20;

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${what} took longer than ${Math.round(ms / 1000)} s`)), ms);
    p.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e))
    );
  });
}

/**
 * Extracts a range (or a list) of pages: layout + blocks per page, without
 * AI unless AI_ENHANCE is chosen. Every page gets its own status; one bad
 * page never takes the others down.
 */
export async function executeParallelPdfExtraction(
  pdfBuffer: Buffer,
  options: ParallelExtractOptions = {}
): Promise<ParallelExtractionSummary> {
  const startTime = Date.now();
  const pdfjs: any = await loadServerPdfJs();
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
    verbosity: 0,
  }).promise;

  try {
    const totalDocPages = doc.numPages as number;
    const pageNumbers = (
      options.pageNumbers?.length
        ? options.pageNumbers
        : (() => {
            const from = Math.max(1, options.fromPage ?? 1);
            const to = Math.min(totalDocPages, options.toPage ?? totalDocPages);
            return Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);
          })()
    ).filter((n) => n >= 1 && n <= totalDocPages);

    const mode = options.mode || "FAST_EDITABLE";
    const perPageTimeout = options.perPageTimeoutMs ?? (mode === "AI_ENHANCE" ? 40_000 : 20_000);
    const pageStatuses: Record<number, PageProcessingStatus> = {};
    const results: ExtractedPageResult[] = [];
    let completedCount = 0;

    const processSinglePage = async (pageNumber: number): Promise<ExtractedPageResult> => {
      const pStart = Date.now();
      const status: PageProcessingStatus = {
        pageNumber,
        status: "PROCESSING",
        attempts: (options.previousAttempts?.[pageNumber] ?? 0) + 1,
        elementsCount: 0,
        isScanned: false,
      };
      pageStatuses[pageNumber] = status;
      let width = 595;
      let height = 842;
      try {
        const work = async () => {
          if (options.simulatePageFailure?.(pageNumber)) throw new Error("Simulated failure (test)");
          const page = await doc.getPage(pageNumber);
          try {
            const layout = await extractPageLayout(page, pdfjs.OPS);
            width = layout.width;
            height = layout.height;
            const parse = { removeWords: options.removeWords, renames: options.renames };
            if (layout.textChars < MIN_TEXT_CHARS) {
              // Scanned page: keep whatever little text and the pictures; OCR fills it in.
              const { elements, warnings } = layoutToBlocks(layout, pageNumber, parse);
              return { elements, warnings: [...warnings, "No text layer on this page (scanned) — run OCR."], status: "NEEDS_OCR" as const, layout };
            }
            let structure: ((text: string) => ModuleElementInput[]) | undefined;
            if (mode === "AI_ENHANCE") {
              const text = layout.lines.map((l) => l.text).join("\n");
              const normalized = isKrutiDevEncoded(text) ? convertKrutiDevToUnicode(text) : text;
              const blocks = await aiStructurePage(normalized).catch((e) => {
                console.warn(`[AI structuring fallback on page ${pageNumber}]`, e);
                return [] as any[];
              });
              if (blocks.length) {
                const aiEls: ModuleElementInput[] = blocks.map((b, idx) => ({
                  id: `p${pageNumber}-${idx}-${Math.random().toString(36).slice(2, 7)}`,
                  order: idx,
                  type: (b.type || "PARAGRAPH") as any,
                  content: b.text || b.content || "",
                  label: b.label,
                  variant: b.variant,
                }));
                structure = () => aiEls;
              }
            }
            const { elements, warnings } = layoutToBlocks(layout, pageNumber, { ...parse, structure });
            if (layout.brokenGlyphs > 0) {
              // The text layer is there but some letters cannot be decoded — keep it, ask for OCR.
              warnings.push(`${layout.brokenGlyphs} character(s) on this page cannot be decoded from the PDF (often Hindi conjuncts) — words may have letters missing. Run OCR on this page or check the text.`);
              return { elements, warnings, status: "NEEDS_OCR" as const, layout };
            }
            return { elements, warnings, status: "COMPLETED" as const, layout };
          } finally {
            page.cleanup?.();
          }
        };
        const out = await withTimeout(work(), perPageTimeout, `Page ${pageNumber}`);
        Object.assign(status, {
          status: out.status,
          isScanned: out.status === "NEEDS_OCR" && out.layout.brokenGlyphs === 0,
          source: out.status === "NEEDS_OCR" && out.layout.brokenGlyphs === 0 ? "NONE" : "TEXT",
          elementsCount: out.elements.length,
          columns: out.layout.columns,
          images: out.layout.images.length,
          links: out.layout.links.map((l) => l.url).slice(0, 20),
          warnings: out.warnings,
          error: null,
        });
        return {
          pageNumber,
          width,
          height,
          pdfType: out.status === "NEEDS_OCR" && out.layout.brokenGlyphs === 0 ? "SCANNED" : "DIGITAL",
          elements: out.elements,
          warnings: out.warnings,
          needsReview: out.status === "NEEDS_OCR" || out.elements.length === 0 || out.warnings.some((w) => w.includes("removed by the cleanup")),
          ocrConfidence: null,
          durationMs: Date.now() - pStart,
          status: out.status,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[extraction] page ${pageNumber} failed:`, message);
        Object.assign(status, { status: "FAILED", error: message.slice(0, 300), elementsCount: 0 });
        return {
          pageNumber,
          width,
          height,
          pdfType: "DIGITAL",
          elements: [],
          warnings: [`This page could not be read: ${message.slice(0, 200)}`],
          needsReview: true,
          ocrConfidence: null,
          durationMs: Date.now() - pStart,
          status: "FAILED",
          error: message,
        };
      } finally {
        status.durationMs = Date.now() - pStart;
        completedCount++;
        await options.onPageProgress?.(status, completedCount, pageNumbers.length);
      }
    };

    const concurrency = Math.max(1, Math.min(12, options.concurrency ?? (mode === "AI_ENHANCE" ? 6 : 4)));
    for (let i = 0; i < pageNumbers.length; i += concurrency) {
      if (options.shouldCancel?.()) break;
      const chunk = pageNumbers.slice(i, i + concurrency);
      results.push(...(await Promise.all(chunk.map((pn) => processSinglePage(pn)))));
    }

    const scanned = results.filter((r) => r.status === "NEEDS_OCR").length;
    return {
      documentPages: totalDocPages,
      totalPages: pageNumbers.length,
      completedPages: results.filter((r) => r.status !== "FAILED").length,
      failedPages: results.filter((r) => r.status === "FAILED").length,
      pdfType: scanned === 0 ? "DIGITAL" : scanned === results.length ? "SCANNED" : "HYBRID",
      pages: results.sort((x, y) => x.pageNumber - y.pageNumber),
      pageStatuses,
      totalDurationMs: Date.now() - startTime,
    };
  } finally {
    await doc.destroy?.();
  }
}
