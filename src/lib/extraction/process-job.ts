import "server-only";
import { prisma } from "@/lib/db";
import {
  buildChunkPlan,
  processChunkForJob,
  getJobPdfBuffer,
  type JobChunkPlan,
} from "./chunk-pipeline";
import { extractTextFromPdfBuffer } from "./pdf-extractor";

export type ExtractionInput = {
  jobId: string;
  pdfBuffer: Buffer | null;
  rawText?: string | null;
  startNumber: number;
  endNumber: number;
  subject: string;
  chapter: string | null;
  sourceName: string;
  fileName: string;
  fileUrl: string;
};

const REQUEST_BUDGET_MS = 220_000; // 220 seconds safe budget inside 300s maxDuration

/**
 * Starts execution of an extraction job across chunks.
 * Saves questions incrementally so no work is lost on large PDFs.
 */
export async function processExtractionJob(input: ExtractionInput): Promise<void> {
  const startedAt = Date.now();
  const { jobId, startNumber, endNumber } = input;
  const expectedCount = Math.max(1, endNumber - startNumber + 1);

  try {
    await prisma.extractionJob.update({
      where: { id: jobId },
      data: {
        status: "PROCESSING",
        progress: 5,
        currentStep: "Analyzing PDF structure and planning chunks...",
      },
    });

    let pages: { pageNumber: number; text: string }[] = [];
    if (input.pdfBuffer) {
      const res = await extractTextFromPdfBuffer(input.pdfBuffer);
      pages = res.pages;
    } else if (input.rawText?.trim()) {
      pages = [{ pageNumber: 1, text: input.rawText.trim() }];
    }

    const chunkPlan = buildChunkPlan(pages);

    await prisma.extractionJob.update({
      where: { id: jobId },
      data: {
        progress: 10,
        currentStep: `Initialized extraction plan: ${chunkPlan.totalPages} pages across ${chunkPlan.totalChunks} chunks.`,
        reportJson: {
          sourceName: input.sourceName,
          fileName: input.fileName,
          expectedRange: `${startNumber}–${endNumber}`,
          expectedCount,
          chunkPlan,
          status: "PROCESSING",
        } as any,
      },
    });

    // Process chunks in sequence while within execution budget
    for (let i = 0; i < chunkPlan.totalChunks; i++) {
      if (Date.now() - startedAt > REQUEST_BUDGET_MS) {
        console.log(
          `[processExtractionJob] Approaching time limit on job ${jobId}. Checkpointed at chunk ${i}/${chunkPlan.totalChunks}. Client runner will continue.`
        );
        break;
      }

      await processChunkForJob(jobId, i, { pdfBuffer: input.pdfBuffer });
    }
  } catch (err) {
    console.error(`[process-job] extraction job ${jobId} encountered an error:`, err);
    await prisma.extractionJob
      .update({
        where: { id: jobId },
        data: {
          status: "REVIEW_REQUIRED",
          progress: 100,
          currentStep: `Partial extraction: ${err instanceof Error ? err.message.slice(0, 180) : String(err)}`,
        },
      })
      .catch(() => {});
  }
}

/**
 * Recovers stale extraction jobs by checking checkpointed progress.
 */
export async function recoverStaleExtractionJob(job: {
  id: string;
  status: string;
  updatedAt: Date;
}): Promise<boolean> {
  if (job.status !== "PROCESSING" || Date.now() - job.updatedAt.getTime() < 10 * 60 * 1000) {
    return false;
  }

  const saved = await prisma.extractedQuestion.count({ where: { jobId: job.id } });
  await prisma.extractionJob.update({
    where: { id: job.id },
    data: {
      status: saved > 0 ? "REVIEW_REQUIRED" : "FAILED",
      progress: 100,
      currentStep:
        saved > 0
          ? "Interrupted extraction — saved questions are available for review. Click 'Resume' to continue pending pages."
          : "Extraction timed out before completing any questions. Click 'Resume' to retry.",
    },
  });
  return true;
}
