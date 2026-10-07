import "server-only";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { uploadFile } from "@/lib/storage";
import { withRenderedPdf } from "@/lib/pdf/page-renderer";
import {
  cleanDocumentArtifacts,
  extractTextFromPdfBuffer,
  extractQuestionsWithAiChunk,
  type ExtractedAiQuestion,
} from "./pdf-extractor";
import { cropQuestionFigures, attachFigures, FIGURE_PLACEHOLDER } from "./figure-crops";
import { validateAndClassifyQuestions } from "./validator";

export interface ChunkMetadata {
  index: number;
  firstPage: number;
  lastPage: number;
  isVision: boolean;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  extractedQuestionsCount: number;
  error?: string;
  processedAt?: string;
}

export interface JobChunkPlan {
  totalPages: number;
  totalChunks: number;
  chunks: ChunkMetadata[];
  completedChunks: number;
  failedChunks: number;
  allProcessed: boolean;
}

const MAX_CHUNK_CHARS = 14_000;
const MAX_TEXT_PAGES_PER_CHUNK = 6;
const IMAGE_PAGES_PER_CHUNK = 2;

const STOPWORDS = new Set([
  "the", "of", "is", "and", "which", "following", "in", "to", "a", "an", "are",
  "for", "with", "be", "by", "on", "if", "that", "correct", "statement", "its", "from"
]);

function needsVision(text: string): boolean {
  const letters = (text.match(/[A-Za-zऀ-ॿ]/g) || []).length;
  if (letters < 80) return true;
  const devanagari = (text.match(/[ऀ-ॿ]/g) || []).length;
  if (devanagari > 20) {
    const broken =
      (text.match(/(^|[\s(])\u093F/g) || []).length +
      (text.match(/\u094D\s/g) || []).length;
    return broken >= 2;
  }
  const words = text.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  if (words.length < 40) return false;
  const common = words.filter((w) => STOPWORDS.has(w)).length / words.length;
  return common < 0.02;
}

/**
 * Plans chunk batches for a multi-page PDF document.
 */
export function buildChunkPlan(pages: { pageNumber: number; text: string }[]): JobChunkPlan {
  const chunks: { firstPage: number; lastPage: number; text?: string; isVision: boolean }[] = [];
  let cur: { pages: { pageNumber: number; text: string }[]; chars: number } | null = null;

  const flushText = () => {
    if (!cur || !cur.pages.length) return;
    chunks.push({
      firstPage: cur.pages[0]!.pageNumber,
      lastPage: cur.pages[cur.pages.length - 1]!.pageNumber,
      text: cur.pages.map((p) => `--- [Page ${p.pageNumber}] ---\n${p.text}`).join("\n\n"),
      isVision: false,
    });
    cur = null;
  };

  let visionRun: number[] = [];
  const flushVision = () => {
    for (let i = 0; i < visionRun.length; i += IMAGE_PAGES_PER_CHUNK) {
      const run = visionRun.slice(i, i + IMAGE_PAGES_PER_CHUNK);
      chunks.push({
        firstPage: run[0]!,
        lastPage: run[run.length - 1]!,
        isVision: true,
      });
    }
    visionRun = [];
  };

  for (const p of pages) {
    if (needsVision(p.text)) {
      flushText();
      visionRun.push(p.pageNumber);
      continue;
    }
    flushVision();
    const clean = cleanDocumentArtifacts(p.text);
    if (cur && (cur.chars + clean.length > MAX_CHUNK_CHARS || cur.pages.length >= MAX_TEXT_PAGES_PER_CHUNK)) {
      flushText();
    }
    cur ??= { pages: [], chars: 0 };
    cur.pages.push({ pageNumber: p.pageNumber, text: clean });
    cur.chars += clean.length;
  }
  flushText();
  flushVision();

  chunks.sort((a, b) => a.firstPage - b.firstPage);

  const chunkMetadataList: ChunkMetadata[] = chunks.map((c, idx) => ({
    index: idx,
    firstPage: c.firstPage,
    lastPage: c.lastPage,
    isVision: c.isVision,
    status: "PENDING",
    extractedQuestionsCount: 0,
  }));

  return {
    totalPages: pages.length,
    totalChunks: chunkMetadataList.length,
    chunks: chunkMetadataList,
    completedChunks: 0,
    failedChunks: 0,
    allProcessed: false,
  };
}

/**
 * Downloads or loads PDF buffer for a job.
 */
export async function getJobPdfBuffer(job: { fileUrl: string; fileName: string }): Promise<Buffer | null> {
  if (!job.fileUrl) return null;
  try {
    const res = await fetch(job.fileUrl);
    if (!res.ok) {
      console.warn(`[chunk-pipeline] Failed to fetch PDF from ${job.fileUrl}: HTTP ${res.status}`);
      return null;
    }
    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
  } catch (err) {
    console.error(`[chunk-pipeline] Error downloading PDF buffer for job:`, err);
    return null;
  }
}

/**
 * Processes a single chunk for an extraction job.
 * Updates ExtractedQuestion records incrementally so NO work is lost if later chunks fail.
 */
export async function processChunkForJob(
  jobId: string,
  chunkIndex: number,
  options: { pdfBuffer?: Buffer | null } = {}
): Promise<{
  success: boolean;
  chunkIndex: number;
  nextChunkIndex: number | null;
  isComplete: boolean;
  questionsExtracted: number;
  error?: string;
}> {
  const job = await prisma.extractionJob.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    throw new Error(`Job ${jobId} not found`);
  }

  const report = (job.reportJson as any) || {};
  let chunkPlan = (report.chunkPlan as JobChunkPlan) || null;

  let pdfBuf = options.pdfBuffer || null;
  if (!pdfBuf && job.fileUrl) {
    pdfBuf = await getJobPdfBuffer(job);
  }

  // If no chunk plan exists, initialize one
  if (!chunkPlan) {
    let pages: { pageNumber: number; text: string }[] = [];
    if (pdfBuf) {
      const res = await extractTextFromPdfBuffer(pdfBuf);
      pages = res.pages;
    }
    if (!pages.length) {
      pages = [{ pageNumber: 1, text: "" }];
    }
    chunkPlan = buildChunkPlan(pages);
    report.chunkPlan = chunkPlan;
  }

  if (chunkIndex < 0 || chunkIndex >= chunkPlan.chunks.length) {
    return {
      success: true,
      chunkIndex,
      nextChunkIndex: null,
      isComplete: true,
      questionsExtracted: 0,
    };
  }

  const chunkMeta = chunkPlan.chunks[chunkIndex]!;
  chunkMeta.status = "PROCESSING";

  const progressPercent = Math.min(
    95,
    Math.round(((chunkIndex + 1) / (chunkPlan.totalChunks || 1)) * 90)
  );

  await prisma.extractionJob.update({
    where: { id: jobId },
    data: {
      status: "PROCESSING",
      progress: progressPercent,
      currentStep: `Extracting pages ${chunkMeta.firstPage}–${chunkMeta.lastPage} (Chunk ${chunkIndex + 1}/${chunkPlan.totalChunks})...`,
      reportJson: report,
    },
  });

  const subjectContext = job.subject && job.subject !== "Auto Detect" ? job.subject : undefined;
  let extractedQuestions: ExtractedAiQuestion[] = [];

  try {
    if (!chunkMeta.isVision && pdfBuf) {
      // 1. Text-based chunk extraction
      const res = await extractTextFromPdfBuffer(pdfBuf);
      const chunkPages = res.pages.filter(
        (p) => p.pageNumber >= chunkMeta.firstPage && p.pageNumber <= chunkMeta.lastPage
      );
      const textChunk = chunkPages
        .map((p) => `--- [Page ${p.pageNumber}] ---\n${cleanDocumentArtifacts(p.text)}`)
        .join("\n\n");

      extractedQuestions = await extractQuestionsWithAiChunk({
        textChunk,
        firstPage: chunkMeta.firstPage,
        startNumber: job.startNumber,
        endNumber: job.endNumber,
        subjectContext,
        chapterContext: job.chapter || undefined,
        sourceName: job.sourceName,
      });
    } else if (pdfBuf) {
      // 2. High-res page image vision chunk extraction
      await withRenderedPdf(pdfBuf, async (doc) => {
        const nums = Array.from(
          { length: chunkMeta.lastPage - chunkMeta.firstPage + 1 },
          (_, i) => chunkMeta.firstPage + i
        );
        const images = await Promise.all(nums.map((n) => doc.jpeg(n, 1800)));
        try {
          extractedQuestions = await extractQuestionsWithAiChunk({
            textChunk: "",
            pageImages: images,
            firstPage: chunkMeta.firstPage,
            startNumber: job.startNumber,
            endNumber: job.endNumber,
            subjectContext,
            chapterContext: job.chapter || undefined,
            sourceName: job.sourceName,
          });
        } finally {
          for (const n of nums) {
            await doc.release(n).catch(() => {});
          }
        }
      });
    }

    // 3. Diagram / Structure Cropping for questions on these pages
    if (pdfBuf && extractedQuestions.some((q) => q.hasImage)) {
      const figurePages = Array.from(
        new Set(
          extractedQuestions
            .filter((q) => q.hasImage)
            .map((q) => q.sourcePage)
            .filter((p) => p >= chunkMeta.firstPage && p <= chunkMeta.lastPage)
        )
      );

      if (figurePages.length) {
        try {
          const crops = await cropQuestionFigures(pdfBuf, { pages: figurePages });
          const uploaded: { questionNumber: number; place: "STATEMENT" | "A" | "B" | "C" | "D"; url: string }[] = [];
          for (const [i, c] of crops.entries()) {
            const url = await uploadFile({
              key: `questions/extracted/${jobId}/q${c.questionNumber}-${c.place}-${i}.png`,
              body: c.png,
              contentType: "image/png",
            });
            uploaded.push({ questionNumber: c.questionNumber, place: c.place, url });
          }
          extractedQuestions = attachFigures(extractedQuestions, uploaded);
        } catch (figErr) {
          console.warn(`[chunk-pipeline] Figure cropping failed on chunk ${chunkIndex}:`, figErr);
        }
      }
    }

    // 4. Clean figure placeholders if any remain uncropped
    extractedQuestions = extractedQuestions.map((q) => {
      const texts = [
        q.statement,
        q.statementHi,
        ...Object.values(q.options || {}),
        ...Object.values(q.optionsHi || {}),
      ].map((t) => String(t ?? ""));

      if (!texts.some((t) => t.includes(FIGURE_PLACEHOLDER))) return q;
      const clean = (t: any) => (typeof t === "string" ? t.split(FIGURE_PLACEHOLDER).join("").trim() : t);

      return {
        ...q,
        statement: clean(q.statement),
        statementHi: clean(q.statementHi),
        options: Object.fromEntries(
          Object.entries(q.options || {}).map(([k, v]) => [k, clean(v)])
        ) as ExtractedAiQuestion["options"],
        optionsHi: q.optionsHi
          ? (Object.fromEntries(
              Object.entries(q.optionsHi).map(([k, v]) => [k, clean(v)])
            ) as ExtractedAiQuestion["optionsHi"])
          : q.optionsHi,
        hasImage: true,
        missingImage: true,
        status: "REVIEW_REQUIRED" as const,
        reviewReasons: [
          ...(q.reviewReasons || []),
          "⚠️ Diagram detected in document — verify cropped figure.",
        ],
      };
    });

    // 5. Save/Upsert questions into the database
    let savedCount = 0;
    for (const q of extractedQuestions) {
      if (!Number.isFinite(q.originalNumber)) continue;
      if (q.originalNumber < job.startNumber || q.originalNumber > job.endNumber) continue;

      const questionData = {
        jobId,
        questionIndex: q.originalNumber - job.startNumber + 1,
        originalNumber: q.originalNumber,
        pyqExam: job.pyqExam || null,
        pyqYear: job.pyqYear || null,
        pyqMonth: job.pyqMonth || null,
        pyqQuestionNumber: String(q.originalNumber),
        sourceName: job.sourceName,
        sourcePdfUrl: job.fileUrl || "",
        sourcePdfName: job.fileName,
        sourcePage: q.sourcePage || chunkMeta.firstPage,
        statement: q.statement || `Question ${q.originalNumber}`,
        statementHi: q.statementHi || null,
        options: (q.options || { A: "", B: "", C: "", D: "" }) as any,
        correctAnswer: q.correctAnswer || "A",
        answerKeySource: q.answerKeySource || "EXTRACTION_PIPELINE",
        solution: q.solution || null,
        solutionHi: q.solutionHi || null,
        hasTable: Boolean(q.hasTable),
        tablesJson: q.tableMarkdown ? { markdown: q.tableMarkdown } : (Prisma.DbNull as any),
        hasImage: Boolean(q.hasImage),
        imageUrl: q.imageUrl || null,
        imagesJson: q.imageUrl ? [{ url: q.imageUrl, page: q.sourcePage }] : (Prisma.DbNull as any),
        hasEquation: Boolean(q.hasEquation),
        subject: q.subject || job.subject || "General",
        chapter: q.chapter || job.chapter || null,
        topic: q.topic || null,
        subTopic: q.subTopic || null,
        questionType: q.questionType || "SINGLE_CORRECT",
        difficulty: q.difficulty || "MEDIUM",
        status: q.status || "VERIFIED",
        confidence: q.confidence || 95.0,
        confidenceBreakdown: q.confidenceBreakdown ? (q.confidenceBreakdown as any) : (Prisma.DbNull as any),
        reviewReasons: q.reviewReasons || [],
        originalSnapshot: {
          statement: q.statement,
          options: q.options,
          correctAnswer: q.correctAnswer,
          solution: q.solution,
          sourcePage: q.sourcePage,
        } as any,
      };

      // Find existing by jobId and originalNumber
      const existing = await prisma.extractedQuestion.findFirst({
        where: { jobId, originalNumber: q.originalNumber },
      });

      if (existing) {
        await prisma.extractedQuestion.update({
          where: { id: existing.id },
          data: questionData,
        });
      } else {
        await prisma.extractedQuestion.create({
          data: questionData,
        });
      }
      savedCount++;
    }

    chunkMeta.status = "COMPLETED";
    chunkMeta.extractedQuestionsCount = savedCount;
    chunkMeta.processedAt = new Date().toISOString();
    chunkPlan.completedChunks++;
  } catch (chunkErr) {
    console.error(`[chunk-pipeline] Chunk ${chunkIndex} failed:`, chunkErr);
    chunkMeta.status = "FAILED";
    chunkMeta.error = chunkErr instanceof Error ? chunkErr.message : String(chunkErr);
    chunkPlan.failedChunks++;
  }

  // Check if all chunks are processed
  const pendingChunk = chunkPlan.chunks.find((c) => c.status === "PENDING");
  const isComplete = !pendingChunk;
  chunkPlan.allProcessed = isComplete;
  report.chunkPlan = chunkPlan;

  // Reconcile overall counts
  const totalExtracted = await prisma.extractedQuestion.count({ where: { jobId } });
  const verifiedCount = await prisma.extractedQuestion.count({
    where: { jobId, status: "VERIFIED" },
  });
  const reviewCount = await prisma.extractedQuestion.count({
    where: { jobId, status: "REVIEW_REQUIRED" },
  });
  const errorCount = await prisma.extractedQuestion.count({
    where: { jobId, status: "EXTRACTION_ERROR" },
  });

  const finalStatus = isComplete
    ? totalExtracted === 0
      ? "FAILED"
      : reviewCount > 0 || errorCount > 0 || chunkPlan.failedChunks > 0
      ? "REVIEW_REQUIRED"
      : "VERIFIED"
    : "PROCESSING";

  const finalProgress = isComplete ? 100 : progressPercent;
  const finalStep = isComplete
    ? `Extraction Complete (${totalExtracted} questions processed across ${chunkPlan.totalPages} pages).`
    : `Processed Chunk ${chunkIndex + 1} of ${chunkPlan.totalChunks}.`;

  await prisma.extractionJob.update({
    where: { id: jobId },
    data: {
      status: finalStatus,
      progress: finalProgress,
      currentStep: finalStep,
      extractedCount: totalExtracted,
      verifiedCount,
      reviewCount,
      errorCount,
      reportJson: report,
    },
  });

  return {
    success: chunkMeta.status === "COMPLETED",
    chunkIndex,
    nextChunkIndex: pendingChunk ? pendingChunk.index : null,
    isComplete,
    questionsExtracted: chunkMeta.extractedQuestionsCount,
    error: chunkMeta.error,
  };
}

/**
 * Resumes extraction of an interrupted job from the first pending or failed chunk.
 */
export async function resumeExtractionJob(jobId: string) {
  const job = await prisma.extractionJob.findUnique({ where: { id: jobId } });
  if (!job) throw new Error("Job not found");

  const report = (job.reportJson as any) || {};
  let chunkPlan = (report.chunkPlan as JobChunkPlan) || null;

  if (!chunkPlan) {
    const pdfBuf = await getJobPdfBuffer(job);
    let pages: { pageNumber: number; text: string }[] = [];
    if (pdfBuf) {
      const res = await extractTextFromPdfBuffer(pdfBuf);
      pages = res.pages;
    }
    chunkPlan = buildChunkPlan(pages);
    report.chunkPlan = chunkPlan;
    await prisma.extractionJob.update({
      where: { id: jobId },
      data: { reportJson: report },
    });
  }

  const nextPending = chunkPlan.chunks.find((c) => c.status === "PENDING" || c.status === "FAILED");
  if (!nextPending) {
    return { isComplete: true, nextChunkIndex: null };
  }

  return {
    isComplete: false,
    nextChunkIndex: nextPending.index,
    totalChunks: chunkPlan.totalChunks,
  };
}
