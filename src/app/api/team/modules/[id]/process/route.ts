import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { extractPdfPages, looksScanned } from "@/lib/module-studio/pdf-text";
import { structurePageText } from "@/lib/module-studio/ai-extract";
import type { ModuleElementInput } from "@/lib/validation/module";

// Bounded concurrency for the per-page Gemini calls — fast enough for a
// typical module without hammering the API, and keeps this synchronous
// request (see the note below on why it's synchronous at all) from being
// serialized page-by-page.
const AI_CONCURRENCY = 3;

/**
 * Runs the OCR/extraction/AI-structuring pipeline for a module, entirely
 * within this one request — there is no background job queue in this app
 * (see the Chapter Management Phase D auto-end comment for the same
 * constraint), so ProcessingJob's stage/progress columns are updated as
 * real checkpoints during this single call rather than genuinely polled
 * async progress. For a very large module (dozens of pages) this can run
 * long enough to risk a serverless function timeout — a real limitation of
 * doing this without a queue, not swept under the rug.
 */
export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.MODULE_UPDATE);

    const moduleRow = await prisma.module.findUnique({ where: { id: params.id } });
    if (!moduleRow) return apiError("Module not found", 404);
    if (moduleRow.status === "PUBLISHED" || moduleRow.status === "ARCHIVED") {
      return apiError(`Cannot reprocess a module that is ${moduleRow.status.toLowerCase()}.`, 409);
    }

    const job = await prisma.processingJob.create({
      data: { moduleId: moduleRow.id, stage: "ANALYZING", progress: 5 },
    });
    await prisma.module.update({ where: { id: moduleRow.id }, data: { status: "PROCESSING" } });

    try {
      const fileRes = await fetch(moduleRow.originalFileUrl);
      if (!fileRes.ok) throw new Error(`Could not download the source PDF (HTTP ${fileRes.status}).`);
      const buffer = Buffer.from(await fileRes.arrayBuffer());

      await prisma.processingJob.update({ where: { id: job.id }, data: { stage: "EXTRACTING", progress: 15 } });
      const { pages, pageCount } = await extractPdfPages(buffer);

      const scannedCount = pages.filter(looksScanned).length;
      const pdfType = scannedCount === 0 ? "DIGITAL" : scannedCount === pages.length ? "SCANNED" : "HYBRID";

      await prisma.processingJob.update({ where: { id: job.id }, data: { stage: "OCR_PROCESSING", progress: 30 } });

      let anyNeedsReview = false;
      const results: {
        pageNumber: number;
        width: number;
        height: number;
        elements: ModuleElementInput[];
        needsReview: boolean;
        warnings: string[];
        ocrConfidence: number | null;
      }[] = [];

      for (let i = 0; i < pages.length; i += AI_CONCURRENCY) {
        const batch = pages.slice(i, i + AI_CONCURRENCY);
        const batchResults = await Promise.all(
          batch.map(async (page) => {
            if (looksScanned(page)) {
              anyNeedsReview = true;
              return {
                pageNumber: page.pageNumber,
                width: page.width,
                height: page.height,
                elements: [] as ModuleElementInput[],
                needsReview: true,
                warnings: ["No extractable text — likely a scanned/image page. Add content manually."],
                ocrConfidence: null,
              };
            }
            const extraction = await structurePageText(page.text);
            const needsReview = extraction.elements.length === 0 || extraction.error !== null;
            if (needsReview) anyNeedsReview = true;
            return {
              pageNumber: page.pageNumber,
              width: page.width,
              height: page.height,
              elements: extraction.elements,
              needsReview,
              warnings: extraction.error ? [extraction.error] : [],
              ocrConfidence: extraction.error ? null : extraction.usedFallback ? 0.6 : 0.85,
            };
          })
        );
        results.push(...batchResults);
        await prisma.processingJob.update({
          where: { id: job.id },
          data: { progress: Math.min(90, 30 + Math.round(((i + batch.length) / pages.length) * 60)) },
        });
      }

      await prisma.processingJob.update({ where: { id: job.id }, data: { stage: "RECONSTRUCTING_LAYOUT", progress: 92 } });

      await prisma.$transaction([
        ...results.map((r) =>
          prisma.modulePage.upsert({
            where: { moduleId_pageNumber: { moduleId: moduleRow.id, pageNumber: r.pageNumber } },
            create: {
              moduleId: moduleRow.id,
              pageNumber: r.pageNumber,
              width: r.width,
              height: r.height,
              pdfType,
              elements: r.elements,
              ocrConfidence: r.ocrConfidence,
              needsReview: r.needsReview,
              warnings: r.warnings,
            },
            update: {
              width: r.width,
              height: r.height,
              pdfType,
              elements: r.elements,
              ocrConfidence: r.ocrConfidence,
              needsReview: r.needsReview,
              warnings: r.warnings,
            },
          })
        ),
        prisma.module.update({
          where: { id: moduleRow.id },
          data: { pageCount, pdfType, status: anyNeedsReview ? "REVIEW_REQUIRED" : "READY" },
        }),
      ]);

      await prisma.processingJob.update({
        where: { id: job.id },
        data: { stage: "READY_FOR_REVIEW", progress: 100, finishedAt: new Date() },
      });

      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: "MODULE_PROCESSED",
          entityType: "Module",
          entityId: moduleRow.id,
          metadata: { pageCount, pdfType, anyNeedsReview },
        },
      });

      const finalModule = await prisma.module.findUnique({
        where: { id: moduleRow.id },
        include: { pages: { orderBy: { pageNumber: "asc" } } },
      });
      return apiSuccess({ module: finalModule });
    } catch (processingError) {
      const message = processingError instanceof Error ? processingError.message : "Processing failed.";
      await prisma.processingJob.update({
        where: { id: job.id },
        data: { stage: "FAILED", errorMessage: message, finishedAt: new Date() },
      });
      await prisma.module.update({ where: { id: moduleRow.id }, data: { status: "FAILED" } });
      return apiError(`Processing failed: ${message}`, 500);
    }
  } catch (error) {
    return handleApiError(error);
  }
}
