import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { buildChunkPlan, getJobPdfBuffer } from "@/lib/extraction/chunk-pipeline";
import { extractTextFromPdfBuffer } from "@/lib/extraction/pdf-extractor";
import { processPyqChunk, pagesNeedingOcr, type PyqChunkPlan, type PyqReport } from "./import-pipeline";

export type PyqImportInput = {
  userId: string;
  examId: string;
  yearMode: "SINGLE" | "MULTI";
  year: number | null;
  session?: string | null;
  shift?: string | null;
  paper?: string | null;
  subject?: string | null;
  chapter?: string | null;
  language?: string | null;
  hasAnswerKey?: boolean | null;
  hasSolutions?: boolean | null;
  sourceTitle: string;
  sourceReference?: string | null;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  pdf: Buffer;
};

/** Creates the import record (original PDF already stored) and its page plan. */
export async function createPyqImportJob(input: PyqImportInput) {
  if (input.yearMode === "SINGLE" && !input.year) {
    throw new Error("A single-sitting paper needs its year. Choose 'Several years in one PDF' if it combines years.");
  }
  const exam = await prisma.pyqExam.findUniqueOrThrow({ where: { id: input.examId } });
  const { pages } = await extractTextFromPdfBuffer(input.pdf);
  const plan = buildChunkPlan(pages) as unknown as PyqChunkPlan;
  const report: PyqReport = { chunkPlan: plan, ocrPages: {}, warnings: [] };

  return prisma.extractionJob.create({
    data: {
      isPyqImport: true,
      sourceName: input.sourceTitle,
      fileName: input.fileName,
      fileUrl: input.fileUrl,
      fileSize: input.fileSize,
      startNumber: 1,
      endNumber: 999,
      expectedCount: 0,
      status: "PROCESSING",
      progress: 0,
      currentStep: `Planned ${plan.totalPages} page(s) in ${plan.totalChunks} group(s).`,
      examName: exam.name,
      year: input.year ? String(input.year) : null,
      pyqExam: exam.legacyCode ?? exam.name,
      pyqExamId: exam.id,
      pyqYear: input.yearMode === "SINGLE" ? input.year : null,
      pyqMonth: input.session ?? null,
      yearMode: input.yearMode,
      session: input.session ?? null,
      shift: input.shift ?? null,
      paper: input.paper ?? null,
      subject: input.subject || null,
      chapter: input.chapter || null,
      language: input.language ?? null,
      hasAnswerKey: input.hasAnswerKey ?? null,
      hasSolutions: input.hasSolutions ?? null,
      sourceReference: input.sourceReference ?? null,
      reportJson: report as unknown as Prisma.InputJsonValue,
      createdById: input.userId,
    },
  });
}

/**
 * Processes pending page groups until the time budget runs out. Safe to call
 * from several places (the upload request's background, the job page's
 * runner): the job lock lets only one of them work at a time.
 */
export async function runPyqImport(jobId: string, opts: { pdf?: Buffer | null; budgetMs?: number } = {}) {
  const started = Date.now();
  const budget = opts.budgetMs ?? 200_000;
  let pdf = opts.pdf ?? null;
  const getPdf = async () => {
    if (!pdf) {
      const job = await prisma.extractionJob.findUniqueOrThrow({ where: { id: jobId } });
      pdf = await getJobPdfBuffer(job);
    }
    return pdf;
  };
  for (let guard = 0; guard < 500 && Date.now() - started < budget; guard++) {
    const job = await prisma.extractionJob.findUniqueOrThrow({ where: { id: jobId } });
    const plan = (job.reportJson as PyqReport | null)?.chunkPlan;
    const next = plan?.chunks.find((c) => c.status === "PENDING");
    if (!next) break;
    const res = await processPyqChunk(jobId, next.index, getPdf);
    if (res.busy || res.cancelled) break;
  }
}

/** Puts failed (and OCR-waiting) page groups back in the queue. */
export async function requeueChunks(jobId: string, which: "FAILED" | "NEEDS_OCR" | "ALL_UNFINISHED") {
  const job = await prisma.extractionJob.findUniqueOrThrow({ where: { id: jobId } });
  const report = ((job.reportJson as PyqReport | null) ?? {}) as PyqReport;
  const plan = report.chunkPlan;
  if (!plan) throw new Error("Import has no page plan.");
  let n = 0;
  for (const c of plan.chunks) {
    const hit = which === "ALL_UNFINISHED" ? c.status !== "COMPLETED" : c.status === which;
    if (hit) {
      c.status = "PENDING";
      c.error = undefined;
      n++;
    }
  }
  await prisma.extractionJob.update({
    where: { id: jobId },
    data: { reportJson: report as unknown as Prisma.InputJsonValue, cancelRequested: false, status: n ? "PROCESSING" : job.status },
  });
  return n;
}

/** Stores browser OCR text for one scanned page; re-queues its group once all its pages are read. */
export async function saveOcrPage(jobId: string, pageNumber: number, text: string, confidence: number) {
  // A small retry loop: concurrent OCR posts edit the same JSON report.
  for (let attempt = 0; attempt < 5; attempt++) {
    const job = await prisma.extractionJob.findUniqueOrThrow({ where: { id: jobId } });
    const report = ((job.reportJson as PyqReport | null) ?? {}) as PyqReport;
    report.ocrPages = { ...(report.ocrPages ?? {}), [String(pageNumber)]: { text: text.slice(0, 60_000), confidence } };
    for (const c of report.chunkPlan?.chunks ?? []) {
      if (c.status !== "NEEDS_OCR" && c.status !== "FAILED") continue;
      const all = Array.from({ length: c.lastPage - c.firstPage + 1 }, (_, i) => c.firstPage + i).every((p) => report.ocrPages![String(p)]);
      if (all) c.status = "PENDING";
    }
    const res = await prisma.extractionJob.updateMany({
      where: { id: jobId, updatedAt: job.updatedAt },
      data: { reportJson: report as unknown as Prisma.InputJsonValue, status: "PROCESSING" },
    });
    if (res.count === 1) return { remaining: pagesNeedingOcr(report) };
  }
  throw new Error("Could not save the OCR text (busy). Please retry.");
}
