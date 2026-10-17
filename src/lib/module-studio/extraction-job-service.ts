import "server-only";
import { prisma } from "@/lib/db";
import { computePdfHash } from "./pdf-hash";
import { executeParallelPdfExtraction, type PageProcessingStatus } from "./parallel-extraction-engine";
import { inspectPdf, PdfInputError, type PdfInspection } from "./pdf-inspect";
import { layoutToBlocks, type LayoutLine, type PageLayout } from "./pdf-layout";
import type { ModuleProcessInput } from "@/lib/validation/module";

/**
 * PDF import jobs.
 *
 * Extraction runs INSIDE requests, in slices, never after the response: on
 * Vercel a function is frozen as soon as it has answered, which is how jobs
 * used to stop half-way. Each request (start, then "continue") processes
 * pages for at most sliceBudgetMs() — 45 s by default, always at least one
 * batch — saves every finished page at once and records where to carry on.
 * The editor keeps asking until the job is finished.
 *
 * Status (metadata.status), the truth shown to people:
 *   queued → processing → completed | completed_with_errors | failed | cancelled
 * Every page has its own status (see PageProcessingStatus): text pages are
 * read directly; scanned pages are marked NEEDS_OCR and recognised in the
 * browser (submitOcrPage); a page that fails keeps its error and can be
 * retried without redoing the rest.
 */

const sliceBudgetMs = () => Number(process.env.MODULE_SLICE_BUDGET_MS) || 45_000;
const batchPages = (mode: SliceMeta["mode"]) =>
  Math.max(1, Number(mode === "AI_ENHANCE" ? process.env.MODULE_BATCH_PAGES_AI : process.env.MODULE_BATCH_PAGES) || (mode === "AI_ENHANCE" ? 10 : 25));

export type JobState = "queued" | "processing" | "completed" | "completed_with_errors" | "failed" | "cancelled";

type SliceMeta = {
  status: JobState;
  nextPage: number;
  fromPage: number;
  toPage: number | null;
  documentPages: number | null;
  mode: "FAST_EDITABLE" | "AI_ENHANCE";
  removeWords?: string[];
  renames?: Record<string, string>;
  retryQueue: number[];
  attempts: Record<string, number>;
  errorCode?: string;
  inspection?: Pick<PdfInspection, "pages" | "bytes" | "encrypted" | "metadata">;
  /** Tests only (never set by the API): pages forced to fail. */
  testFailPages?: number[];
};

export type SliceResult = {
  jobId: string;
  done: boolean;
  status: JobState;
  completedPages: number;
  totalPages: number;
  nextPage: number | null;
};

export interface JobStatusResponse {
  jobId: string;
  moduleId: string;
  stage: string;
  status: JobState;
  progress: number;
  totalPages: number;
  completedPages: number;
  failedPages: number;
  ocrPendingPages: number;
  ocrDonePages: number;
  textPages: number;
  currentPage: number | null;
  pageStatuses: Record<number, PageProcessingStatus>;
  errorMessage: string | null;
  errorCode: string | null;
  startedAt: string;
  finishedAt: string | null;
  pdfType: string;
  isCached: boolean;
}

export class ExtractionConflictError extends Error {
  constructor(public readonly jobId: string) {
    super("An extraction is already running for this module — resume it or cancel it first.");
    this.name = "ExtractionConflictError";
  }
}

function readMeta(raw: unknown): SliceMeta {
  const m = (raw ?? {}) as Partial<SliceMeta> & { nextPage?: number };
  return {
    status: m.status ?? "processing",
    // A job from the old background worker has no slice data: start it over.
    nextPage: m.nextPage ?? m.fromPage ?? 1,
    fromPage: m.fromPage ?? 1,
    toPage: m.toPage ?? null,
    documentPages: m.documentPages ?? null,
    mode: m.mode ?? "FAST_EDITABLE",
    removeWords: m.removeWords,
    renames: m.renames,
    retryQueue: Array.isArray(m.retryQueue) ? m.retryQueue : [],
    attempts: m.attempts ?? {},
    errorCode: m.errorCode,
    inspection: m.inspection,
    testFailPages: m.testFailPages,
  };
}

function counts(statuses: Record<string, PageProcessingStatus>) {
  const list = Object.values(statuses);
  return {
    text: list.filter((s) => s.status === "COMPLETED").length,
    ocrPending: list.filter((s) => s.status === "NEEDS_OCR").length,
    ocrDone: list.filter((s) => s.status === "OCR_DONE").length,
    failed: list.filter((s) => s.status === "FAILED").length,
    done: list.filter((s) => s.status !== "QUEUED" && s.status !== "PROCESSING").length,
  };
}

async function downloadSource(url: string): Promise<Buffer> {
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  } catch (err) {
    throw new Error(`Could not download the source PDF from storage (${err instanceof Error ? err.message : String(err)}). Try again in a moment.`);
  }
  if (!res.ok) throw new Error(`Could not download the source PDF from storage (HTTP ${res.status}). Try again in a moment; if it keeps failing, upload the PDF again.`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Starts a new import job and runs its first slice in this request.
 * Refuses (ExtractionConflictError) while another job of this module is unfinished.
 */
export async function startExtractionJob(
  moduleId: string,
  userId: string,
  options: ModuleProcessInput & { testFailPages?: number[] } = {}
): Promise<{ jobId: string; status: string; totalPages: number; isCached: boolean; slice?: SliceResult }> {
  const moduleRow = await prisma.module.findUnique({ where: { id: moduleId } });
  if (!moduleRow) throw new Error("Module not found");
  if (moduleRow.status === "PUBLISHED" || moduleRow.status === "ARCHIVED") {
    throw new Error(`Cannot reprocess a module that is ${moduleRow.status.toLowerCase()}.`);
  }
  const running = await prisma.processingJob.findFirst({ where: { moduleId, finishedAt: null }, orderBy: { startedAt: "desc" } });
  if (running) throw new ExtractionConflictError(running.id);

  const buffer = await downloadSource(moduleRow.originalFileUrl);
  const contentHash = computePdfHash(buffer);

  // Same PDF already imported elsewhere (whole document only): reuse its pages.
  if (!options.fromPage && !options.toPage && !options.testFailPages) {
    const cachedMatch = await prisma.module.findFirst({
      where: { contentHash, status: { in: ["READY", "PUBLISHED"] }, id: { not: moduleRow.id }, pages: { some: {} } },
      include: { pages: { orderBy: { pageNumber: "asc" } } },
    });
    if (cachedMatch && cachedMatch.pages.length > 0) {
      const job = await prisma.processingJob.create({
        data: {
          moduleId: moduleRow.id,
          stage: "READY_FOR_REVIEW",
          progress: 100,
          totalPages: cachedMatch.pages.length,
          completedPages: cachedMatch.pages.length,
          failedPages: 0,
          contentHash,
          metadata: { cachedFromModuleId: cachedMatch.id, status: "completed" },
          finishedAt: new Date(),
        },
      });
      await prisma.$transaction([
        ...cachedMatch.pages.map((p) =>
          prisma.modulePage.upsert({
            where: { moduleId_pageNumber: { moduleId: moduleRow.id, pageNumber: p.pageNumber } },
            create: { moduleId: moduleRow.id, pageNumber: p.pageNumber, width: p.width, height: p.height, pdfType: p.pdfType, elements: p.elements as any, ocrConfidence: p.ocrConfidence, needsReview: p.needsReview, warnings: p.warnings as any },
            update: { width: p.width, height: p.height, pdfType: p.pdfType, elements: p.elements as any, ocrConfidence: p.ocrConfidence, needsReview: p.needsReview, warnings: p.warnings as any },
          })
        ),
        prisma.module.update({ where: { id: moduleRow.id }, data: { pageCount: cachedMatch.pageCount, pdfType: cachedMatch.pdfType, status: "READY", contentHash } }),
      ]);
      await prisma.auditLog
        .create({ data: { userId, action: "MODULE_PROCESSED_CACHED", entityType: "Module", entityId: moduleRow.id, metadata: { cachedFrom: cachedMatch.id, pageCount: cachedMatch.pageCount } } })
        .catch(() => undefined);
      return { jobId: job.id, status: "completed", totalPages: cachedMatch.pages.length, isCached: true };
    }
  }

  const meta: SliceMeta = {
    status: "queued",
    nextPage: Math.max(1, options.fromPage ?? 1),
    fromPage: Math.max(1, options.fromPage ?? 1),
    toPage: options.toPage ?? null,
    documentPages: null,
    mode: options.mode || "FAST_EDITABLE",
    removeWords: options.removeWords,
    renames: options.renames,
    retryQueue: [],
    attempts: {},
    testFailPages: options.testFailPages,
  };
  const job = await prisma.processingJob.create({
    data: { moduleId: moduleRow.id, stage: "ANALYZING", progress: 1, contentHash, metadata: meta as any },
  });
  await prisma.module.update({ where: { id: moduleRow.id }, data: { status: "PROCESSING", contentHash } });

  const slice = await runExtractionSlice(job.id, { buffer, userId });
  return { jobId: job.id, status: slice.status, totalPages: slice.totalPages, isCached: false, slice };
}

/** One more slice of the module's unfinished job (also resumes jobs left by the old worker). */
export async function continueExtractionJob(moduleId: string, userId: string): Promise<SliceResult | null> {
  const job = await prisma.processingJob.findFirst({ where: { moduleId, finishedAt: null }, orderBy: { startedAt: "desc" } });
  if (!job) return null;
  return runExtractionSlice(job.id, { userId });
}

/** Queues the failed pages of the latest job again (and re-opens the job). */
export async function retryFailedPages(moduleId: string, userId: string): Promise<SliceResult | null> {
  const job = await prisma.processingJob.findFirst({ where: { moduleId }, orderBy: { startedAt: "desc" } });
  if (!job) return null;
  const meta = readMeta(job.metadata);
  if (meta.status === "processing" || meta.status === "queued") throw new ExtractionConflictError(job.id);
  const statuses = (job.pageStatuses ?? {}) as unknown as Record<string, PageProcessingStatus>;
  const failed = Object.values(statuses).filter((s) => s.status === "FAILED").map((s) => s.pageNumber);
  if (!failed.length) return { jobId: job.id, done: true, status: meta.status, completedPages: job.completedPages, totalPages: job.totalPages, nextPage: null };
  meta.retryQueue = [...new Set([...meta.retryQueue, ...failed])].sort((a, b) => a - b);
  meta.status = "processing";
  meta.testFailPages = undefined; // a test's forced failure applies to the first attempt only
  await prisma.processingJob.update({ where: { id: job.id }, data: { metadata: meta as any, finishedAt: null, errorMessage: null, stage: "OCR_PROCESSING" } });
  await prisma.module.update({ where: { id: moduleId }, data: { status: "PROCESSING" } });
  return runExtractionSlice(job.id, { userId });
}

async function savePages(moduleId: string, pages: Awaited<ReturnType<typeof executeParallelPdfExtraction>>["pages"]) {
  if (!pages.length) return;
  await prisma.$transaction(
    pages.map((r) =>
      prisma.modulePage.upsert({
        where: { moduleId_pageNumber: { moduleId, pageNumber: r.pageNumber } },
        create: { moduleId, pageNumber: r.pageNumber, width: r.width, height: r.height, pdfType: r.pdfType, elements: r.elements as any, ocrConfidence: r.ocrConfidence, needsReview: r.needsReview, warnings: r.warnings as any },
        update: { width: r.width, height: r.height, pdfType: r.pdfType, elements: r.elements as any, ocrConfidence: r.ocrConfidence, needsReview: r.needsReview, warnings: r.warnings as any },
      })
    )
  );
}

async function finishJob(jobId: string, moduleId: string, meta: SliceMeta, statuses: Record<string, PageProcessingStatus>, userId: string, startedAt: Date) {
  const c = counts(statuses);
  meta.status = c.failed > 0 || c.ocrPending > 0 ? "completed_with_errors" : "completed";
  const lastPage = Math.min(meta.toPage ?? meta.documentPages ?? 0, meta.documentPages ?? 0);
  const total = Math.max(0, lastPage - meta.fromPage + 1);
  const pdfType = c.ocrPending + c.ocrDone === 0 ? "DIGITAL" : c.text === 0 ? "SCANNED" : "HYBRID";
  const needsReview = await prisma.modulePage.count({ where: { moduleId, needsReview: true, pageNumber: { gte: meta.fromPage, lte: lastPage } } });
  await prisma.$transaction([
    prisma.module.update({ where: { id: moduleId }, data: { pageCount: meta.documentPages, pdfType, status: needsReview > 0 || c.failed > 0 ? "REVIEW_REQUIRED" : "READY" } }),
    prisma.processingJob.update({
      where: { id: jobId },
      data: {
        stage: "READY_FOR_REVIEW",
        progress: 100,
        totalPages: total,
        completedPages: total - c.failed,
        failedPages: c.failed,
        pageStatuses: statuses as any,
        metadata: meta as any,
        finishedAt: new Date(),
        errorMessage: c.failed ? `${c.failed} page(s) could not be read — use “Retry failed pages”.` : c.ocrPending ? `${c.ocrPending} scanned page(s) still need OCR.` : null,
      },
    }),
  ]);
  await prisma.auditLog
    .create({ data: { userId, action: "MODULE_PROCESSED_PARALLEL", entityType: "Module", entityId: moduleId, metadata: { status: meta.status, totalPages: total, ...c, durationMs: Date.now() - startedAt.getTime() } } })
    .catch(() => undefined);
}

async function runExtractionSlice(jobId: string, ctx: { buffer?: Buffer; userId: string }): Promise<SliceResult> {
  const sliceStart = Date.now();
  const job = await prisma.processingJob.findUniqueOrThrow({ where: { id: jobId } });
  const moduleRow = await prisma.module.findUniqueOrThrow({ where: { id: job.moduleId } });
  const meta = readMeta(job.metadata);
  const statuses = { ...((job.pageStatuses ?? {}) as unknown as Record<string, PageProcessingStatus>) };
  const result = (done: boolean, nextPage: number | null): SliceResult => {
    const lastPage = meta.documentPages ? Math.min(meta.toPage ?? meta.documentPages, meta.documentPages) : null;
    const total = lastPage ? lastPage - meta.fromPage + 1 : 0;
    return { jobId, done, status: meta.status, completedPages: counts(statuses).done, totalPages: total, nextPage };
  };

  try {
    const buffer = ctx.buffer ?? (await downloadSource(moduleRow.originalFileUrl));

    // First slice: check the file itself before spending work on it.
    if (!meta.inspection) {
      const insp = await inspectPdf(buffer);
      meta.inspection = { pages: insp.pages, bytes: insp.bytes, encrypted: insp.encrypted, metadata: insp.metadata };
      meta.documentPages = insp.pages;
      if (meta.fromPage > insp.pages) throw new PdfInputError("TOO_MANY_PAGES", `This PDF has ${insp.pages} pages; page ${meta.fromPage} does not exist.`);
    }
    meta.status = "processing";
    const lastPage = Math.min(meta.toPage ?? meta.documentPages!, meta.documentPages!);
    const total = lastPage - meta.fromPage + 1;

    let batches = 0;
    for (;;) {
      if (batches > 0 && Date.now() - sliceStart > sliceBudgetMs()) break;
      const fresh = await prisma.processingJob.findUnique({ where: { id: jobId }, select: { finishedAt: true } });
      if (!fresh || fresh.finishedAt) {
        // Cancelled from the editor while this slice was running.
        return { ...result(true, null), status: "cancelled" };
      }

      const size = batchPages(meta.mode);
      let pageNumbers: number[];
      if (meta.retryQueue.length) {
        pageNumbers = meta.retryQueue.splice(0, size);
      } else if (meta.nextPage <= lastPage) {
        const to = Math.min(lastPage, meta.nextPage + size - 1);
        pageNumbers = Array.from({ length: to - meta.nextPage + 1 }, (_, i) => meta.nextPage + i);
        meta.nextPage = to + 1;
      } else {
        break;
      }

      const failSet = new Set(meta.testFailPages ?? []);
      const extraction = await executeParallelPdfExtraction(buffer, {
        pageNumbers,
        mode: meta.mode,
        removeWords: meta.removeWords,
        renames: meta.renames,
        previousAttempts: Object.fromEntries(pageNumbers.map((p) => [p, meta.attempts[p] ?? 0])),
        ...(failSet.size && { simulatePageFailure: (p: number) => failSet.has(p) }),
      });
      // Failed pages keep their last good content (if any) — only real results are saved.
      await savePages(moduleRow.id, extraction.pages.filter((p) => p.status !== "FAILED"));
      for (const failedPage of extraction.pages.filter((p) => p.status === "FAILED")) {
        const exists = await prisma.modulePage.findUnique({ where: { moduleId_pageNumber: { moduleId: moduleRow.id, pageNumber: failedPage.pageNumber } }, select: { id: true } });
        if (!exists) await savePages(moduleRow.id, [failedPage]);
      }
      for (const [k, v] of Object.entries(extraction.pageStatuses)) {
        statuses[k] = v;
        meta.attempts[k] = v.attempts;
      }
      batches++;

      const c = counts(statuses);
      // updateMany + finishedAt: null — a cancel that arrived meanwhile is never overwritten.
      await prisma.processingJob.updateMany({
        where: { id: jobId, finishedAt: null },
        data: {
          stage: "OCR_PROCESSING",
          totalPages: total,
          completedPages: c.done - c.failed,
          failedPages: c.failed,
          // 100 % only when the job really finishes (finishJob).
          progress: Math.min(99, Math.max(1, Math.round((c.done / Math.max(1, total)) * 99))),
          pageStatuses: statuses as any,
          metadata: meta as any,
        },
      });
    }

    if (meta.nextPage <= lastPage || meta.retryQueue.length) return result(false, meta.retryQueue[0] ?? meta.nextPage);
    await finishJob(jobId, moduleRow.id, meta, statuses, ctx.userId, job.startedAt);
    return result(true, null);
  } catch (err) {
    console.error("[extraction_job_slice_error]", err);
    const errMsg = err instanceof Error ? err.message : "Extraction failed.";
    meta.status = "failed";
    meta.errorCode = err instanceof PdfInputError ? err.code : "PROCESSING_ERROR";
    await prisma.processingJob
      .update({ where: { id: jobId }, data: { stage: "FAILED", errorMessage: errMsg, finishedAt: new Date(), metadata: meta as any, pageStatuses: statuses as any } })
      .catch(() => undefined);
    await prisma.module.update({ where: { id: moduleRow.id }, data: { status: "FAILED" } }).catch(() => undefined);
    return result(true, null);
  }
}

/**
 * OCR results for one scanned page, recognised in the browser (Tesseract,
 * Hindi + English). Lines carry their boxes in PDF points (top-left origin).
 */
export async function submitOcrPage(
  moduleId: string,
  userId: string,
  input: { pageNumber: number; confidence: number; lines: { text: string; bbox: { x: number; y: number; w: number; h: number }; confidence: number }[]; width: number; height: number }
): Promise<{ status: JobState; ocrPendingPages: number }> {
  const job = await prisma.processingJob.findFirst({ where: { moduleId }, orderBy: { startedAt: "desc" } });
  if (!job) throw new Error("No import job for this module — run the extraction first.");
  const meta = readMeta(job.metadata);
  const statuses = { ...((job.pageStatuses ?? {}) as unknown as Record<string, PageProcessingStatus>) };
  const prev = statuses[input.pageNumber];
  if (!prev || (prev.status !== "NEEDS_OCR" && prev.status !== "OCR_DONE")) {
    throw new Error(`Page ${input.pageNumber} is not waiting for OCR.`);
  }

  const lines: LayoutLine[] = input.lines
    .filter((l) => l.text.trim())
    .map((l) => ({ text: l.text.trim(), bbox: l.bbox, fontName: null, fontSize: l.bbox.h, column: "FULL" as const }));
  const layout: PageLayout = { width: input.width, height: input.height, lines, images: [], tinyImages: 0, links: [], columns: 1, textChars: lines.reduce((n, l) => n + l.text.length, 0), brokenGlyphs: 0 };
  const { elements, warnings } = layoutToBlocks(layout, input.pageNumber, { removeWords: meta.removeWords, renames: meta.renames });
  const conf = Math.round(input.confidence);
  // Each block gets the OCR confidence of the lines it was built from.
  const withConf = elements.map((el) => {
    const mine = input.lines.filter((l) => el.bbox && l.bbox.y >= el.bbox.y - 1 && l.bbox.y <= el.bbox.y + el.bbox.h + 1);
    const c = mine.length ? Math.round(mine.reduce((n, l) => n + l.confidence, 0) / mine.length) : conf;
    return { ...el, source: "OCR" as const, confidence: Math.max(0, Math.min(100, c)) };
  });
  const lowConfidence = withConf.filter((e) => (e.confidence ?? 100) < 75).length;

  // Pictures found on the page earlier stay (OCR only replaces the text). A picture that
  // covers (almost) the whole page is the scan itself — its text is what OCR just read.
  const existing = await prisma.modulePage.findUnique({ where: { moduleId_pageNumber: { moduleId, pageNumber: input.pageNumber } }, select: { elements: true } });
  const pageArea = input.width * input.height;
  const oldPictures = ((existing?.elements as any[]) ?? []).filter((e) => e?.type === "IMAGE");
  const keptPictures = oldPictures.filter((e) => !e.bbox || e.bbox.w * e.bbox.h < pageArea * 0.8);
  const merged = [...withConf, ...keptPictures]
    .map((el, i) => ({ el, i, y: el.bbox?.y ?? Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => (a.el.type === "HEADER" ? -1 : b.el.type === "HEADER" ? 1 : a.el.type === "FOOTER" ? 1 : b.el.type === "FOOTER" ? -1 : a.y - b.y || a.i - b.i))
    .map(({ el }, order) => ({ ...el, order }));
  const allWarnings = [
    ...warnings,
    ...(oldPictures.length > keptPictures.length ? ["The full-page scan picture was replaced by its OCR text (the original stays in the source PDF)."] : []),
    ...(keptPictures.length ? [`${keptPictures.length} picture(s) from the page kept next to the OCR text.`] : []),
    `Text recognised by OCR (average confidence ${conf}%). Check equations, symbols and diagrams — OCR cannot rebuild them reliably.`,
    ...(lowConfidence ? [`${lowConfidence} block(s) have low OCR confidence (under 75%).`] : []),
  ];
  // A text page sent to OCR because its letters could not be decoded is still a digital page.
  const pdfType = prev.isScanned ? "SCANNED" : "DIGITAL";
  await prisma.modulePage.upsert({
    where: { moduleId_pageNumber: { moduleId, pageNumber: input.pageNumber } },
    create: { moduleId, pageNumber: input.pageNumber, width: input.width, height: input.height, pdfType, elements: merged as any, ocrConfidence: conf / 100, needsReview: true, warnings: allWarnings as any },
    update: { elements: merged as any, ocrConfidence: conf / 100, needsReview: true, warnings: allWarnings as any, pdfType },
  });
  statuses[input.pageNumber] = { ...prev, status: "OCR_DONE", source: "OCR", ocrConfidence: conf, elementsCount: merged.length, warnings: allWarnings, error: null };
  const c = counts(statuses);
  if (job.finishedAt && c.ocrPending === 0) {
    meta.status = c.failed > 0 ? "completed_with_errors" : "completed";
  }
  await prisma.processingJob.update({
    where: { id: job.id },
    data: { pageStatuses: statuses as any, metadata: meta as any, ...(job.finishedAt && c.ocrPending === 0 && { errorMessage: c.failed ? job.errorMessage : null }) },
  });
  await prisma.auditLog
    .create({ data: { userId, action: "MODULE_PAGE_OCR", entityType: "Module", entityId: moduleId, metadata: { page: input.pageNumber, confidence: conf, blocks: withConf.length } } })
    .catch(() => undefined);
  return { status: meta.status, ocrPendingPages: c.ocrPending };
}

export async function getJobStatus(moduleId: string): Promise<JobStatusResponse | null> {
  const job = await prisma.processingJob.findFirst({ where: { moduleId }, orderBy: { startedAt: "desc" } });
  if (!job) return null;
  const moduleRow = await prisma.module.findUnique({ where: { id: moduleId }, select: { pdfType: true } });
  const meta = readMeta(job.metadata);
  const statuses = (job.pageStatuses as unknown as Record<number, PageProcessingStatus>) || {};
  const c = counts(statuses as any);
  const legacyDone = job.finishedAt && !(job.metadata as any)?.status;
  const status: JobState = legacyDone ? (job.stage === "FAILED" ? (/cancel/i.test(job.errorMessage ?? "") ? "cancelled" : "failed") : "completed") : meta.status;
  return {
    jobId: job.id,
    moduleId: job.moduleId,
    stage: job.stage,
    status,
    progress: job.progress,
    totalPages: job.totalPages,
    completedPages: job.completedPages,
    failedPages: c.failed,
    ocrPendingPages: c.ocrPending,
    ocrDonePages: c.ocrDone,
    textPages: c.text,
    currentPage: job.finishedAt ? null : meta.retryQueue[0] ?? meta.nextPage,
    pageStatuses: statuses,
    errorMessage: job.errorMessage,
    errorCode: meta.errorCode ?? null,
    startedAt: job.startedAt.toISOString(),
    finishedAt: job.finishedAt ? job.finishedAt.toISOString() : null,
    pdfType: moduleRow?.pdfType || "UNKNOWN",
    isCached: !!(job.metadata as any)?.cachedFromModuleId,
  };
}

/** A full, downloadable account of the latest import of this module. */
export async function getJobReport(moduleId: string) {
  const status = await getJobStatus(moduleId);
  if (!status) return null;
  const moduleRow = await prisma.module.findUnique({ where: { id: moduleId }, select: { title: true, originalFileName: true, originalFileSize: true, pageCount: true } });
  const job = await prisma.processingJob.findUnique({ where: { id: status.jobId }, select: { metadata: true } });
  const meta = readMeta(job?.metadata);
  const pages = Object.values(status.pageStatuses).sort((a, b) => a.pageNumber - b.pageNumber);
  return {
    generatedAt: new Date().toISOString(),
    module: { id: moduleId, title: moduleRow?.title, file: moduleRow?.originalFileName, fileBytes: moduleRow?.originalFileSize, pages: moduleRow?.pageCount },
    pdf: meta.inspection ?? null,
    job: {
      id: status.jobId,
      status: status.status,
      mode: meta.mode,
      range: { from: meta.fromPage, to: meta.toPage ?? meta.documentPages },
      startedAt: status.startedAt,
      finishedAt: status.finishedAt,
      error: status.errorMessage,
      errorCode: status.errorCode,
    },
    totals: { pages: pages.length, text: status.textPages, ocrDone: status.ocrDonePages, ocrPending: status.ocrPendingPages, failed: status.failedPages },
    pages: pages.map((p) => ({
      page: p.pageNumber,
      status: p.status,
      source: p.source ?? null,
      attempts: p.attempts,
      blocks: p.elementsCount,
      columns: p.columns ?? null,
      pictures: p.images ?? 0,
      links: p.links ?? [],
      ocrConfidence: p.ocrConfidence ?? null,
      durationMs: p.durationMs ?? null,
      error: p.error ?? null,
      warnings: p.warnings ?? [],
    })),
  };
}

export async function cancelJob(moduleId: string): Promise<boolean> {
  const job = await prisma.processingJob.findFirst({ where: { moduleId, finishedAt: null }, orderBy: { startedAt: "desc" } });
  if (!job) return false;
  const meta = readMeta(job.metadata);
  meta.status = "cancelled";
  await prisma.processingJob.update({
    where: { id: job.id },
    data: { stage: "FAILED", errorMessage: "Cancelled by user", finishedAt: new Date(), metadata: meta as any },
  });
  await prisma.module.update({ where: { id: moduleId }, data: { status: "DRAFT" } });
  return true;
}
