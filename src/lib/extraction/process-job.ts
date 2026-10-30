import "server-only";
import { prisma } from "@/lib/db";
import {
  buildChunkPlan,
  processChunkForJob,
  resumeExtractionJob,
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

  // No usable source (no buffer, no raw text, and an unfetchable URL) → fail
  // clearly instead of running a whole plan that can only produce nothing.
  if (!input.pdfBuffer && !input.rawText?.trim() && !isFetchableUrl(input.fileUrl)) {
    await prisma.extractionJob
      .update({
        where: { id: jobId },
        data: {
          status: "FAILED",
          progress: 100,
          currentStep: `Source PDF is unavailable (${input.fileName}). Re-upload the file to run extraction.`,
        },
      })
      .catch(() => {});
    return;
  }

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

// A PROCESSING job untouched this long is abandoned (the browser runner or the
// invocation that started it is gone).
const RECLAIM_IDLE_MS = 3 * 60 * 1000;
// How long a reclaim holds a job so two runners never process it at once.
const RECLAIM_LOCK_MS = 4 * 60 * 1000;
// Shorter than REQUEST_BUDGET_MS: a reclaim runs inside a polled endpoint's
// background work, which has a tighter max duration than the upload route.
const RECLAIM_BUDGET_MS = 45_000;
// A chunk that keeps failing must not loop forever across reclaims.
const MAX_CHUNK_FAILURES = 2;

/**
 * Only an absolute http(s) URL can be downloaded server-side. Legacy jobs stored
 * a relative local path ("/uploads/extraction/…"); that file is long gone on
 * serverless, so the PDF can never be fetched and extraction yields nothing.
 */
function isFetchableUrl(url: string | null | undefined): boolean {
  return !!url && /^https?:\/\//i.test(url.trim());
}

/**
 * If a job has no pending chunk work and is still PROCESSING, finalize it
 * honestly instead of leaving it stuck: either its saved questions are ready,
 * or the PDF was unreadable (scanned / unsupported layout) and nothing came out.
 */
async function finalizeIfStillProcessing(jobId: string): Promise<void> {
  const job = await prisma.extractionJob.findUnique({ where: { id: jobId }, select: { status: true } });
  if (job?.status !== "PROCESSING") return; // processChunkForJob already set a terminal status
  const saved = await prisma.extractedQuestion.count({ where: { jobId } });
  await finalizeStuckJob(
    jobId,
    saved > 0
      ? "Extraction finished — saved questions are available for review."
      : "No questions could be detected in the PDF (it may be scanned or an unsupported layout). Try re-uploading."
  );
}

/**
 * Takes a stuck job out of PROCESSING (cancelled, or unrecoverable) so it can
 * never be reclaimed again, and clears its lock. Saved questions are kept.
 */
async function finalizeStuckJob(jobId: string, reason: string): Promise<void> {
  const saved = await prisma.extractedQuestion.count({ where: { jobId } });
  await prisma.extractionJob.update({
    where: { id: jobId },
    data: {
      status: saved > 0 ? "REVIEW_REQUIRED" : "FAILED",
      progress: 100,
      currentStep: reason,
      lockedUntil: null,
      cancelRequested: false,
    },
  });
}

/**
 * Drives a CLAIMED job's remaining chunks to completion server-side (no browser
 * runner needed), within a time budget. Holds the lock between chunks and
 * releases it at the end. A chunk that fails repeatedly finalizes the job
 * instead of looping. The caller must have already claimed the job's lock.
 */
async function advanceClaimedJob(jobId: string): Promise<void> {
  const startedAt = Date.now();
  const job = await prisma.extractionJob.findUnique({
    where: { id: jobId },
    select: { cancelRequested: true, fileUrl: true, fileName: true },
  });
  if (!job) return;
  if (job.cancelRequested) {
    await finalizeStuckJob(jobId, "Extraction cancelled — saved questions are available for review.");
    return;
  }
  // The source PDF can never be fetched (legacy relative URL / gone), so this
  // job would extract nothing and sit in PROCESSING forever. Fail it honestly.
  if (!isFetchableUrl(job.fileUrl)) {
    await finalizeStuckJob(jobId, `Source PDF is unavailable (legacy upload "${job.fileName}"). Re-upload the file to run extraction.`);
    return;
  }

  const failures = new Map<number, number>();
  try {
    while (Date.now() - startedAt < RECLAIM_BUDGET_MS) {
      const next = await resumeExtractionJob(jobId);
      if (next.isComplete || next.nextChunkIndex == null) {
        // No pending chunk work: either processChunkForJob already set a
        // terminal status, or the plan is empty (unreadable PDF) and the job
        // is still PROCESSING — finalize it rather than leave it stuck.
        await finalizeIfStillProcessing(jobId);
        return;
      }
      const idx = next.nextChunkIndex;
      const res = await processChunkForJob(jobId, idx);
      if (res.isComplete) return;
      if (!res.success) {
        const n = (failures.get(idx) ?? 0) + 1;
        failures.set(idx, n);
        if (n >= MAX_CHUNK_FAILURES) {
          await finalizeStuckJob(
            jobId,
            `Auto-resume stopped after repeated failures on chunk ${idx + 1}. Saved questions are available; click 'Resume' to retry the rest.`
          );
          return;
        }
      }
      // Keep the claim alive for the next chunk.
      await prisma.extractionJob
        .update({ where: { id: jobId }, data: { lockedUntil: new Date(Date.now() + RECLAIM_LOCK_MS) } })
        .catch(() => {});
    }
    // Budget hit mid-job: release the lock so a later reclaim continues it.
    await prisma.extractionJob.update({ where: { id: jobId }, data: { lockedUntil: null } }).catch(() => {});
  } catch (err) {
    await finalizeStuckJob(
      jobId,
      `Auto-resume error: ${err instanceof Error ? err.message.slice(0, 160) : String(err)}`
    ).catch(() => {});
  }
}

/**
 * Finds abandoned PROCESSING jobs (idle and not locked) and continues them
 * server-side. Safe to call from any polled endpoint via waitUntil: each job
 * is claimed atomically with lockedUntil, so two runners never process one job
 * and repeated polls don't pile up. Returns how many jobs it claimed.
 */
export async function reclaimStaleExtractionJobs(opts: { idleMs?: number; maxJobs?: number } = {}): Promise<number> {
  const idleMs = opts.idleMs ?? RECLAIM_IDLE_MS;
  const cutoff = new Date(Date.now() - idleMs);
  const now = new Date();

  const stale = await prisma.extractionJob.findMany({
    where: {
      status: "PROCESSING",
      updatedAt: { lt: cutoff },
      OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }],
    },
    select: { id: true },
    orderBy: { updatedAt: "asc" },
    take: opts.maxJobs ?? 2,
  });

  let claimed = 0;
  for (const { id } of stale) {
    // Atomic claim: only one caller wins when several poll at once.
    const claim = await prisma.extractionJob.updateMany({
      where: { id, status: "PROCESSING", OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] },
      data: { lockedUntil: new Date(Date.now() + RECLAIM_LOCK_MS) },
    });
    if (claim.count === 0) continue; // another runner claimed it first
    claimed++;
    await advanceClaimedJob(id);
  }
  return claimed;
}
