import "server-only";
import { prisma } from "@/lib/db";
import { computePdfHash } from "./pdf-hash";
import { executeParallelPdfExtraction, type PageProcessingStatus } from "./parallel-extraction-engine";
import type { ModuleProcessInput } from "@/lib/validation/module";

// Active in-memory cancellation tokens
const activeCancellations = new Map<string, boolean>();

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
): Promise<{ jobId: string; status: string; totalPages: number; isCached: boolean }> {
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

  // 3. Create fresh processing job
  const job = await prisma.processingJob.create({
    data: {
      moduleId: moduleRow.id,
      stage: "ANALYZING",
      progress: 5,
      contentHash,
    },
  });

  await prisma.module.update({
    where: { id: moduleRow.id },
    data: { status: "PROCESSING", contentHash },
  });

  activeCancellations.set(job.id, false);

  // 4. Kick off Background Extraction Worker (Detached / Non-blocking)
  (async () => {
    try {
      await prisma.processingJob.update({
        where: { id: job.id },
        data: { stage: "EXTRACTING", progress: 10 },
      });

      let lastDbUpdate = Date.now();
      const extraction = await executeParallelPdfExtraction(buffer, {
        fromPage: options.fromPage,
        toPage: options.toPage,
        mode: options.mode || "FAST_EDITABLE",
        removeWords: options.removeWords,
        renames: options.renames,
        shouldCancel: () => activeCancellations.get(job.id) === true,
        onPageProgress: async (status, completed, total) => {
          const pct = Math.min(92, 10 + Math.round((completed / total) * 80));
          // Throttle DB writes to at most once every 600ms
          if (Date.now() - lastDbUpdate > 600 || completed === total) {
            lastDbUpdate = Date.now();
            await prisma.processingJob
              .update({
                where: { id: job.id },
                data: {
                  progress: pct,
                  completedPages: completed,
                  totalPages: total,
                  stage: "OCR_PROCESSING",
                },
              })
              .catch(() => undefined);
          }
        },
      });

      if (activeCancellations.get(job.id)) {
        await prisma.processingJob.update({
          where: { id: job.id },
          data: { stage: "FAILED", errorMessage: "Job cancelled by user", finishedAt: new Date() },
        });
        await prisma.module.update({ where: { id: moduleRow.id }, data: { status: "DRAFT" } });
        activeCancellations.delete(job.id);
        return;
      }

      await prisma.processingJob.update({
        where: { id: job.id },
        data: { stage: "RECONSTRUCTING_LAYOUT", progress: 95 },
      });

      // 5. Persist extracted pages to DB in chunks
      const anyReview = extraction.pages.some((p) => p.needsReview);
      await prisma.$transaction([
        ...extraction.pages.map((r) =>
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
        ),
        prisma.module.update({
          where: { id: moduleRow.id },
          data: {
            pageCount: extraction.totalPages,
            pdfType: extraction.pdfType,
            status: anyReview ? "REVIEW_REQUIRED" : "READY",
            contentHash,
          },
        }),
      ]);

      await prisma.processingJob.update({
        where: { id: job.id },
        data: {
          stage: "READY_FOR_REVIEW",
          progress: 100,
          totalPages: extraction.totalPages,
          completedPages: extraction.completedPages,
          failedPages: extraction.failedPages,
          pageStatuses: extraction.pageStatuses as any,
          finishedAt: new Date(),
        },
      });

      await prisma.auditLog.create({
        data: {
          userId,
          action: "MODULE_PROCESSED_PARALLEL",
          entityType: "Module",
          entityId: moduleRow.id,
          metadata: {
            totalPages: extraction.totalPages,
            completed: extraction.completedPages,
            failed: extraction.failedPages,
            durationMs: extraction.totalDurationMs,
          },
        },
      });
    } catch (err: any) {
      console.error("[extraction_job_worker_error]", err);
      const errMsg = err instanceof Error ? err.message : "Extraction failed.";
      await prisma.processingJob
        .update({
          where: { id: job.id },
          data: { stage: "FAILED", errorMessage: errMsg, finishedAt: new Date() },
        })
        .catch(() => undefined);
      await prisma.module.update({ where: { id: moduleRow.id }, data: { status: "FAILED" } }).catch(() => undefined);
    } finally {
      activeCancellations.delete(job.id);
    }
  })();

  return { jobId: job.id, status: "PROCESSING", totalPages: moduleRow.pageCount || 0, isCached: false };
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

  activeCancellations.set(job.id, true);
  await prisma.processingJob.update({
    where: { id: job.id },
    data: { stage: "FAILED", errorMessage: "Cancelled by user", finishedAt: new Date() },
  });
  await prisma.module.update({ where: { id: moduleId }, data: { status: "DRAFT" } });
  return true;
}
