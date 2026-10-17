import "server-only";
import { prisma } from "@/lib/db";
import { computePdfHash } from "./pdf-hash";
import { executeParallelPdfExtraction, type PageProcessingStatus } from "./parallel-extraction-engine";
import type { ModuleProcessInput } from "@/lib/validation/module";

/**
 * Extraction runs INSIDE requests, in slices, never after the response.
 *
 * It used to be started as a detached promise after the API had answered.
 * On Vercel a function is frozen as soon as its response is sent, so the
 * work stopped at a random point: jobs sat for hours at "EXTRACTING 10%",
 * "OCR_PROCESSING 28%" or even "95%" until someone cancelled them, and only
 * a small PDF that finished within the first moments ever came out.
 *
 * Now each request processes pages for at most sliceBudgetMs() (45 s), saves every
 * finished page straight away, and records where to carry on
 * (metadata.nextPage). The editor keeps calling "continue" until the job is
 * done, so any size of PDF is finished piece by piece, a crash or a closed
 * tab loses at most one batch, and a job left behind can be resumed.
 */
const sliceBudgetMs = () => Number(process.env.MODULE_SLICE_BUDGET_MS) || 45_000;
const BATCH_PAGES = { FAST_EDITABLE: 25, AI_ENHANCE: 10 } as const;

type SliceMeta = {
  nextPage: number;
  fromPage: number;
  toPage: number | null;
  documentPages: number | null;
  mode: "FAST_EDITABLE" | "AI_ENHANCE";
  removeWords?: string[];
  renames?: Record<string, string>;
  scannedPages: number;
  digitalPages: number;
};

export type SliceResult = {
  jobId: string;
  done: boolean;
  status: string;
  completedPages: number;
  totalPages: number;
  nextPage: number | null;
};

export interface JobStatusResponse {
  jobId: string;
  moduleId: string;
  stage: string;
  progress: number;
  totalPages: number;
  completedPages: number;
  failedPages: number;
  pageStatuses: Record<number, PageProcessingStatus>;
  errorMessage: string | null;
  startedAt: string;
  finishedAt: string | null;
  pdfType: string;
  isCached: boolean;
}

/**
 * Starts or resumes an asynchronous PDF extraction job.
 * Runs non-blocking in the background, updating DB state and memory progress.
 */
export async function startExtractionJob(
  moduleId: string,
  userId: string,
  options: ModuleProcessInput = {}
): Promise<{ jobId: string; status: string; totalPages: number; isCached: boolean; slice?: SliceResult }> {
  const moduleRow = await prisma.module.findUnique({
    where: { id: moduleId },
    include: { pages: true },
  });
  if (!moduleRow) throw new Error("Module not found");
  if (moduleRow.status === "PUBLISHED" || moduleRow.status === "ARCHIVED") {
    throw new Error(`Cannot reprocess a module that is ${moduleRow.status.toLowerCase()}.`);
  }

  // 1. Fetch source PDF buffer
  const fileRes = await fetch(moduleRow.originalFileUrl);
  if (!fileRes.ok) throw new Error(`Could not download the source PDF (HTTP ${fileRes.status}).`);
  const buffer = Buffer.from(await fileRes.arrayBuffer());

  // 2. Compute deterministic SHA-256 Hash for instant extraction reuse
  const contentHash = computePdfHash(buffer);

  // Check if identical PDF was already successfully extracted anywhere in the system
  const cachedMatch = await prisma.module.findFirst({
    where: {
      contentHash,
      status: { in: ["READY", "PUBLISHED"] },
      id: { not: moduleRow.id },
      pages: { some: {} },
    },
    include: { pages: { orderBy: { pageNumber: "asc" } } },
  });

  if (cachedMatch && cachedMatch.pages.length > 0) {
    // INSTANT CACHE HIT! Clone extracted pages in sub-second
    const job = await prisma.processingJob.create({
      data: {
        moduleId: moduleRow.id,
        stage: "READY_FOR_REVIEW",
        progress: 100,
        totalPages: cachedMatch.pages.length,
        completedPages: cachedMatch.pages.length,
        failedPages: 0,
        contentHash,
        metadata: { cachedFromModuleId: cachedMatch.id },
        finishedAt: new Date(),
      },
    });

    await prisma.$transaction([
      ...cachedMatch.pages.map((p) =>
        prisma.modulePage.upsert({
          where: { moduleId_pageNumber: { moduleId: moduleRow.id, pageNumber: p.pageNumber } },
          create: {
            moduleId: moduleRow.id,
            pageNumber: p.pageNumber,
            width: p.width,
            height: p.height,
            pdfType: p.pdfType,
            elements: p.elements as any,
            ocrConfidence: p.ocrConfidence,
            needsReview: p.needsReview,
            warnings: p.warnings as any,
          },
          update: {
            width: p.width,
            height: p.height,
            pdfType: p.pdfType,
            elements: p.elements as any,
            ocrConfidence: p.ocrConfidence,
            needsReview: p.needsReview,
            warnings: p.warnings as any,
          },
        })
      ),
      prisma.module.update({
        where: { id: moduleRow.id },
        data: {
          pageCount: cachedMatch.pageCount,
          pdfType: cachedMatch.pdfType,
          status: "READY",
          contentHash,
        },
      }),
    ]);

    await prisma.auditLog.create({
      data: {
        userId,
        action: "MODULE_PROCESSED_CACHED",
        entityType: "Module",
        entityId: moduleRow.id,
        metadata: { cachedFrom: cachedMatch.id, pageCount: cachedMatch.pageCount },
      },
    });

    return { jobId: job.id, status: "READY", totalPages: cachedMatch.pages.length, isCached: true };
  }

  // 3. Create the job and process its first slice right here.
  const meta: SliceMeta = {
    nextPage: Math.max(1, options.fromPage ?? 1),
    fromPage: Math.max(1, options.fromPage ?? 1),
    toPage: options.toPage ?? null,
    documentPages: null,
    mode: options.mode || "FAST_EDITABLE",
    removeWords: options.removeWords,
    renames: options.renames,
    scannedPages: 0,
    digitalPages: 0,
  };
  const job = await prisma.processingJob.create({
    data: { moduleId: moduleRow.id, stage: "EXTRACTING", progress: 5, contentHash, metadata: meta as any },
  });
  await prisma.module.update({ where: { id: moduleRow.id }, data: { status: "PROCESSING", contentHash } });

  const slice = await runExtractionSlice(job.id, { buffer, userId });
  return { jobId: job.id, status: slice.status, totalPages: slice.totalPages, isCached: false, slice };
}

/**
 * Carries on with the module's latest unfinished extraction job (one more
 * slice). Also picks up jobs left half-way by the old background worker.
 */
export async function continueExtractionJob(moduleId: string, userId: string): Promise<SliceResult | null> {
  const job = await prisma.processingJob.findFirst({
    where: { moduleId, finishedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (!job) return null;
  return runExtractionSlice(job.id, { userId });
}

async function runExtractionSlice(jobId: string, ctx: { buffer?: Buffer; userId: string }): Promise<SliceResult> {
  const startedAt = Date.now();
  const job = await prisma.processingJob.findUniqueOrThrow({ where: { id: jobId } });
  const moduleRow = await prisma.module.findUniqueOrThrow({ where: { id: job.moduleId } });
  const stored = (job.metadata ?? {}) as unknown as Partial<SliceMeta>;
  const meta: SliceMeta = {
    // A job from the old background worker has no slice data: start it over.
    nextPage: stored.nextPage ?? stored.fromPage ?? 1,
    fromPage: stored.fromPage ?? 1,
    toPage: stored.toPage ?? null,
    documentPages: stored.documentPages ?? null,
    mode: stored.mode ?? "FAST_EDITABLE",
    removeWords: stored.removeWords,
    renames: stored.renames,
    scannedPages: stored.scannedPages ?? 0,
    digitalPages: stored.digitalPages ?? 0,
  };
  const pageStatuses = { ...((job.pageStatuses ?? {}) as unknown as Record<string, PageProcessingStatus>) };

  try {
    let buffer = ctx.buffer;
    if (!buffer) {
      const fileRes = await fetch(moduleRow.originalFileUrl);
      if (!fileRes.ok) throw new Error(`Could not download the source PDF (HTTP ${fileRes.status}).`);
      buffer = Buffer.from(await fileRes.arrayBuffer());
    }

    const batchSize = BATCH_PAGES[meta.mode];
    let batches = 0;
    for (;;) {
      const lastPage = meta.documentPages ? Math.min(meta.toPage ?? meta.documentPages, meta.documentPages) : null;
      if (lastPage !== null && meta.nextPage > lastPage) break;
      // Always at least one batch per request, so every call makes progress.
      if (batches > 0 && Date.now() - startedAt > sliceBudgetMs()) break;

      // Cancelled from the editor (another request) since this slice began?
      const current = await prisma.processingJob.findUnique({ where: { id: jobId }, select: { finishedAt: true } });
      if (!current || current.finishedAt) {
        return { jobId, done: true, status: "CANCELLED", completedPages: job.completedPages, totalPages: job.totalPages, nextPage: null };
      }

      const batchTo = meta.nextPage + batchSize - 1;
      const extraction = await executeParallelPdfExtraction(buffer, {
        fromPage: meta.nextPage,
        toPage: lastPage !== null ? Math.min(batchTo, lastPage) : (meta.toPage ? Math.min(batchTo, meta.toPage) : batchTo),
        mode: meta.mode,
        removeWords: meta.removeWords,
        renames: meta.renames,
      });
      meta.documentPages = extraction.documentPages;
      const rangeEnd = Math.min(meta.toPage ?? extraction.documentPages, extraction.documentPages);
      if (meta.fromPage > rangeEnd) throw new Error(`This PDF has ${extraction.documentPages} pages; page ${meta.fromPage} does not exist.`);

      // Every finished page is saved now — a later failure never loses it.
      if (extraction.pages.length > 0) {
        await prisma.$transaction(
          extraction.pages.map((r) =>
            prisma.modulePage.upsert({
              where: { moduleId_pageNumber: { moduleId: moduleRow.id, pageNumber: r.pageNumber } },
              create: {
                moduleId: moduleRow.id,
                pageNumber: r.pageNumber,
                width: r.width,
                height: r.height,
                pdfType: r.pdfType,
                elements: r.elements as any,
                ocrConfidence: r.ocrConfidence,
                needsReview: r.needsReview,
                warnings: r.warnings as any,
              },
              update: {
                width: r.width,
                height: r.height,
                pdfType: r.pdfType,
                elements: r.elements as any,
                ocrConfidence: r.ocrConfidence,
                needsReview: r.needsReview,
                warnings: r.warnings as any,
              },
            })
          )
        );
      }
      for (const r of extraction.pages) {
        if (r.pdfType === "SCANNED") meta.scannedPages++;
        else meta.digitalPages++;
      }
      for (const [k, v] of Object.entries(extraction.pageStatuses)) pageStatuses[k] = v;
      const lastDone = extraction.pages.length ? Math.max(...extraction.pages.map((r) => r.pageNumber)) : meta.nextPage + batchSize - 1;
      meta.nextPage = lastDone + 1;
      batches++;

      const total = rangeEnd - meta.fromPage + 1;
      const completed = Math.min(total, meta.nextPage - meta.fromPage);
      await prisma.processingJob.update({
        where: { id: jobId },
        data: {
          stage: "OCR_PROCESSING",
          totalPages: total,
          completedPages: completed,
          progress: Math.min(95, 5 + Math.round((completed / Math.max(1, total)) * 90)),
          pageStatuses: pageStatuses as any,
          metadata: meta as any,
        },
      });
    }

    const lastPage = Math.min(meta.toPage ?? meta.documentPages ?? 0, meta.documentPages ?? 0);
    const total = Math.max(0, lastPage - meta.fromPage + 1);
    const completed = Math.min(total, meta.nextPage - meta.fromPage);
    if (meta.documentPages === null || meta.nextPage <= lastPage) {
      return { jobId, done: false, status: "PROCESSING", completedPages: completed, totalPages: total, nextPage: meta.nextPage };
    }

    // Finished: the module is ready for review.
    const needsReview = await prisma.modulePage.count({
      where: { moduleId: moduleRow.id, needsReview: true, pageNumber: { gte: meta.fromPage, lte: lastPage } },
    });
    const pdfType = meta.scannedPages === 0 ? "DIGITAL" : meta.digitalPages === 0 ? "SCANNED" : "HYBRID";
    await prisma.$transaction([
      prisma.module.update({
        where: { id: moduleRow.id },
        data: { pageCount: meta.documentPages, pdfType, status: needsReview > 0 ? "REVIEW_REQUIRED" : "READY" },
      }),
      prisma.processingJob.update({
        where: { id: jobId },
        data: {
          stage: "READY_FOR_REVIEW",
          progress: 100,
          totalPages: total,
          completedPages: completed,
          failedPages: 0,
          pageStatuses: pageStatuses as any,
          metadata: meta as any,
          finishedAt: new Date(),
        },
      }),
    ]);
    await prisma.auditLog
      .create({
        data: {
          userId: ctx.userId,
          action: "MODULE_PROCESSED_PARALLEL",
          entityType: "Module",
          entityId: moduleRow.id,
          metadata: { totalPages: total, scanned: meta.scannedPages, needsReview, durationMs: Date.now() - job.startedAt.getTime() },
        },
      })
      .catch(() => undefined);
    return { jobId, done: true, status: "READY", completedPages: completed, totalPages: total, nextPage: null };
  } catch (err) {
    console.error("[extraction_job_slice_error]", err);
    const errMsg = err instanceof Error ? err.message : "Extraction failed.";
    await prisma.processingJob
      .update({ where: { id: jobId }, data: { stage: "FAILED", errorMessage: errMsg, finishedAt: new Date(), metadata: meta as any } })
      .catch(() => undefined);
    await prisma.module.update({ where: { id: moduleRow.id }, data: { status: "FAILED" } }).catch(() => undefined);
    return { jobId, done: true, status: "FAILED", completedPages: job.completedPages, totalPages: job.totalPages, nextPage: null };
  }
}

/**
 * Gets live status of an extraction job.
 */
export async function getJobStatus(moduleId: string): Promise<JobStatusResponse | null> {
  const job = await prisma.processingJob.findFirst({
    where: { moduleId },
    orderBy: { startedAt: "desc" },
  });
  if (!job) return null;

  const moduleRow = await prisma.module.findUnique({
    where: { id: moduleId },
    select: { pdfType: true, contentHash: true },
  });

  return {
    jobId: job.id,
    moduleId: job.moduleId,
    stage: job.stage,
    progress: job.progress,
    totalPages: job.totalPages,
    completedPages: job.completedPages,
    failedPages: job.failedPages,
    pageStatuses: (job.pageStatuses as unknown as Record<number, PageProcessingStatus>) || {},
    errorMessage: job.errorMessage,
    startedAt: job.startedAt.toISOString(),
    finishedAt: job.finishedAt ? job.finishedAt.toISOString() : null,
    pdfType: moduleRow?.pdfType || "UNKNOWN",
    isCached: !!(job.metadata as any)?.cachedFromModuleId,
  };
}

/**
 * Cancels an active extraction job.
 */
export async function cancelJob(moduleId: string): Promise<boolean> {
  const job = await prisma.processingJob.findFirst({
    where: { moduleId, finishedAt: null },
    orderBy: { startedAt: "desc" },
  });
  if (!job) return false;

  await prisma.processingJob.update({
    where: { id: job.id },
    data: { stage: "FAILED", errorMessage: "Cancelled by user", finishedAt: new Date() },
  });
  await prisma.module.update({ where: { id: moduleId }, data: { status: "DRAFT" } });
  return true;
}
