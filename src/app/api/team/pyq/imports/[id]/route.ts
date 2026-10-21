import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { requireTeam } from "@/lib/pyq/api";
import { processPyqChunk, pagesNeedingOcr, aiFallbackAvailable, type PyqReport } from "@/lib/pyq/import-pipeline";
import { requeueChunks, requeueSingleChunk } from "@/lib/pyq/import-service";
import { getJobPdfBuffer } from "@/lib/extraction/chunk-pipeline";

export const maxDuration = 300;

async function loadJob(id: string) {
  const job = await prisma.extractionJob.findFirst({ where: { id, isPyqImport: true }, include: { pyqExamRef: { select: { id: true, name: true } } } });
  return job;
}

/** GET — status, real progress, page groups, pages waiting for OCR, review counts. */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireTeam(PERMISSIONS.QUESTION_IMPORT);
    const job = await loadJob(params.id);
    if (!job) return apiError("Import not found", 404);
    const report = (job.reportJson as PyqReport | null) ?? {};
    const [decisions, needsChapter, duplicates, noYear] = await Promise.all([
      prisma.extractedQuestion.groupBy({ by: ["reviewDecision"], where: { jobId: job.id }, _count: { _all: true } }),
      prisma.extractedQuestion.count({ where: { jobId: job.id, needsChapterReview: true, reviewDecision: "PENDING" } }),
      prisma.extractedQuestion.count({ where: { jobId: job.id, duplicateOfQuestionId: { not: null }, duplicateDecision: "PENDING" } }),
      prisma.extractedQuestion.count({ where: { jobId: job.id, pyqYear: null, reviewDecision: "PENDING" } }),
    ]);
    const plan = report.chunkPlan;
    return apiSuccess({
      job: { ...job, reportJson: undefined },
      plan: plan
        ? {
            totalPages: plan.totalPages,
            totalChunks: plan.totalChunks,
            chunks: plan.chunks,
            processedPages: plan.chunks.filter((c) => c.status === "COMPLETED").reduce((n, c) => n + (c.lastPage - c.firstPage + 1), 0),
            failedPages: plan.chunks.filter((c) => c.status === "FAILED").reduce((n, c) => n + (c.lastPage - c.firstPage + 1), 0),
          }
        : null,
      ocrPagesNeeded: pagesNeedingOcr(report),
      ocrPagesDone: Object.keys(report.ocrPages ?? {}).length,
      aiFallback: aiFallbackAvailable(),
      counts: {
        decisions: Object.fromEntries(decisions.map((d) => [d.reviewDecision, d._count._all])),
        needsChapterReview: needsChapter,
        duplicatesToResolve: duplicates,
        missingYear: noYear,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

const actionSchema = z.object({ action: z.enum(["run", "cancel", "resume", "retry-failed", "retry-chunk"]), chunkIndex: z.number().optional() });

/**
 * POST { action }
 *  run          — process the next pending page group (the import page calls this in a loop)
 *  cancel       — stop after the current group; saved questions stay
 *  resume       — re-queue unfinished groups after a cancel
 *  retry-failed — re-queue failed groups (rows are upserted, never duplicated)
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const userId = await requireTeam(PERMISSIONS.QUESTION_IMPORT);
    const { action, chunkIndex } = actionSchema.parse(await request.json());
    const job = await loadJob(params.id);
    if (!job) return apiError("Import not found", 404);

    if (action === "cancel") {
      await prisma.extractionJob.update({ where: { id: job.id }, data: { cancelRequested: true, currentStep: "Cancelling after the current page group…" } });
      return apiSuccess({ cancelRequested: true });
    }
    if (action === "retry-chunk" && typeof chunkIndex === "number") {
      const n = await requeueSingleChunk(job.id, chunkIndex);
      return apiSuccess({ requeued: n });
    }
    if (action === "resume" || action === "retry-failed") {
      const n = await requeueChunks(job.id, action === "resume" ? "ALL_UNFINISHED" : "FAILED");
      await prisma.auditLog.create({ data: { userId, action: action === "resume" ? "PYQ_IMPORT_RESUME" : "PYQ_IMPORT_RETRY", entityType: "ExtractionJob", entityId: job.id, metadata: { requeued: n } } });
      return apiSuccess({ requeued: n });
    }

    if (job.cancelRequested) return apiSuccess({ isComplete: true, cancelled: true });
    const plan = (job.reportJson as PyqReport | null)?.chunkPlan;
    const next = plan?.chunks.find((c) => c.status === "PENDING");
    if (!next) return apiSuccess({ isComplete: true, nextChunkIndex: null });
    let pdf: Buffer | null = null;
    const result = await processPyqChunk(job.id, next.index, async () => (pdf ??= await getJobPdfBuffer(job)));
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}
