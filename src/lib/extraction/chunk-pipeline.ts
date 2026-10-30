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
  type PrintedAnswer,
} from "./pdf-extractor";
import {
  cropQuestionFigures,
  cropFiguresOnDoc,
  attachFigures,
  matchFiguresToQuestions,
  pagesWithDrawings,
  FIGURE_PLACEHOLDER,
  type CroppedFigure,
} from "./figure-crops";
import { validateAndClassifyQuestions } from "./validator";
import { questionFingerprint } from "@/lib/pyq/fingerprint";
import { cropQuestionImages, hasFigure } from "./question-images";
import { classifyPeriodicTableQuestion } from "@/lib/academic/periodic-table-classifier";
import { ensureBatchSequenceAndCodes } from "./sequence-manager";

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
// Three pages per text request (still capped by MAX_CHUNK_CHARS): fewer, fuller AI calls.
const MAX_TEXT_PAGES_PER_CHUNK = 3;
// Pages are read from their images (exact formulas, structures, tables);
// one page per AI call keeps each answer quick and complete.
const IMAGE_PAGES_PER_CHUNK = 1;

const READ_PAGES_AS_IMAGES = true;

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
    // Every page goes through the page-image path; the text layer rides along
    // as a spelling hint (it breaks subscripts, Greek letters and drawings).
    if (READ_PAGES_AS_IMAGES || needsVision(p.text)) {
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
 * The job's PDF and its page text, kept for the next chunks. Every chunk
 * used to download the whole PDF again and re-read the text of every page
 * (for a 100-page paper: 50 chunks × 100 pages). Kept per server instance for
 * a while; a cold instance simply loads it once.
 */
const JOB_CACHE_MS = 20 * 60_000;
const jobFiles = new Map<string, { at: number; fileUrl: string; pdf: Buffer; pages?: { pageNumber: number; text: string }[] }>();

async function jobPdf(job: { id: string; fileUrl: string; fileName: string }): Promise<Buffer | null> {
  const hit = jobFiles.get(job.id);
  if (hit && hit.fileUrl === job.fileUrl && Date.now() - hit.at < JOB_CACHE_MS) return hit.pdf;
  const pdf = await getJobPdfBuffer(job);
  if (pdf) {
    // A few jobs at most; the oldest goes first.
    while (jobFiles.size >= 3) jobFiles.delete(jobFiles.keys().next().value as string);
    jobFiles.set(job.id, { at: Date.now(), fileUrl: job.fileUrl, pdf });
  }
  return pdf;
}

async function jobPages(jobId: string, pdf: Buffer): Promise<{ pageNumber: number; text: string }[]> {
  const hit = jobFiles.get(jobId);
  if (hit?.pdf === pdf && hit.pages) return hit.pages;
  const { pages } = await extractTextFromPdfBuffer(pdf);
  if (hit?.pdf === pdf) hit.pages = pages;
  return pages;
}

const sectionKey = (s: string | null | undefined) =>
  String(s ?? "").toLowerCase().replace(/exercise|ex\.?|section|part/g, " ").replace(/[^a-z0-9]+/g, " ").trim();

/**
 * The printed answer key wins over answers the AI deduced. Entries are
 * matched by section + question number (numbering restarts per exercise);
 * an entry without a section is used only when that number is unique.
 */
async function applyPrintedAnswers(jobId: string, entries: PrintedAnswer[]) {
  const rows = await prisma.extractedQuestion.findMany({
    where: { jobId },
    select: { id: true, originalNumber: true, questionType: true, imagesJson: true, reviewReasons: true, correctAnswer: true },
  });
  const toLetters = (a: string, numeric: boolean) => {
    if (numeric) return a.trim();
    const keys = a.toUpperCase().split(/[\s,;/&]+/).map((x) => ({ "1": "A", "2": "B", "3": "C", "4": "D" } as Record<string, string>)[x.replace(/[()]/g, "")] ?? x.replace(/[()]/g, ""));
    return Array.from(new Set(keys.filter((k) => /^[A-D]$/.test(k)))).join(",");
  };
  for (const row of rows) {
    const section = sectionKey((row.imagesJson as { section?: string } | null)?.section);
    const sameNumber = entries.filter((e) => e.question === row.originalNumber);
    const match =
      (section && sameNumber.find((e) => e.section && sectionKey(e.section) === section)) ||
      (sameNumber.length === 1 ? sameNumber[0] : undefined);
    if (!match) continue;
    const answer = toLetters(match.answer, /INTEGER|NUMERICAL/i.test(row.questionType));
    if (!answer || answer === row.correctAnswer) continue;
    const reasons = (Array.isArray(row.reviewReasons) ? row.reviewReasons : []) as string[];
    await prisma.extractedQuestion.update({
      where: { id: row.id },
      data: {
        correctAnswer: answer,
        answerKeySource: "ANSWER_KEY_SECTION",
        reviewReasons: reasons.filter((r) => !/Answer not found/i.test(String(r))),
      },
    });
  }
}

/** "Auto Detect" / empty: the source is taken from the PDF itself. */
export function isAutoSource(name: string | null | undefined) {
  return !name || /^\s*(auto(?:[\s-]*detect)?|exam document)\s*$/i.test(name);
}

/** An existing question with exactly this fingerprint: in the Question Bank, or extracted before. */
async function findDuplicate(
  fingerprint: string,
  jobId: string,
  sourceKey: string
): Promise<{ code: string; questionId: string | null; where: string } | null> {
  const inBank = await prisma.question.findFirst({
    where: { contentFingerprint: fingerprint },
    select: { id: true, questionCode: true },
  });
  if (inBank) return { code: inBank.questionCode ?? inBank.id.slice(0, 8), questionId: inBank.id, where: "in the Question Bank" };
  const extracted = await prisma.extractedQuestion.findFirst({
    where: {
      imagesJson: { path: ["fingerprint"], equals: fingerprint },
      NOT: { jobId, sourceKey },
      status: { not: "DUPLICATE" },
    },
    select: { jobId: true, originalNumber: true, draftQuestionId: true, job: { select: { sourceName: true } } },
  });
  if (extracted) {
    return {
      code: `${extracted.job?.sourceName ?? "PDF"} Q${extracted.originalNumber}`,
      questionId: extracted.draftQuestionId,
      where: extracted.jobId === jobId ? "earlier in this PDF" : "in another extracted PDF",
    };
  }
  return null;
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

  // PYQ imports have their own deterministic, idempotent path.
  if (job.isPyqImport) {
    const { processPyqChunk } = await import("@/lib/pyq/import-pipeline");
    return processPyqChunk(jobId, chunkIndex, async () => options.pdfBuffer ?? (await getJobPdfBuffer(job)));
  }

  const report = (job.reportJson as any) || {};
  let chunkPlan = (report.chunkPlan as JobChunkPlan) || null;

  let pdfBuf = options.pdfBuffer || null;
  if (!pdfBuf && job.fileUrl) {
    pdfBuf = await jobPdf(job);
  }

  // If no chunk plan exists, initialize one
  if (!chunkPlan) {
    let pages: { pageNumber: number; text: string }[] = [];
    if (pdfBuf) {
      pages = await jobPages(job.id, pdfBuf);
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
  let printedAnswers: PrintedAnswer[] = [];
  let visionCrops: CroppedFigure[] | null = null;
  // Reference image of each question (the whole printed question), by number.
  const cardCrops = new Map<number, Buffer>();

  // Pages of this chunk to look for figures on: where the model said a
  // question has one, plus pages whose PDF actually draws a figure (the model
  // misses some) — only pages that have a question on them.
  const figurePagesFor = async (qs: ExtractedAiQuestion[]) => {
    const inChunk = (p: number) => p >= chunkMeta.firstPage && p <= chunkMeta.lastPage;
    const flagged = qs.filter((q) => q.hasImage).map((q) => q.sourcePage).filter(inChunk);
    const withQuestions = Array.from(new Set(qs.map((q) => q.sourcePage).filter(inChunk)));
    const drawn = pdfBuf ? await pagesWithDrawings(pdfBuf, withQuestions.filter((p) => !flagged.includes(p))) : [];
    return Array.from(new Set([...flagged, ...drawn])).sort((a, b) => a - b);
  };

  try {
    if (!chunkMeta.isVision && pdfBuf) {
      // 1. Text-based chunk extraction
      const chunkPages = (await jobPages(job.id, pdfBuf)).filter(
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
        const hint = pdfBuf
          ? (await jobPages(job.id, pdfBuf))
              .filter((p) => p.pageNumber >= chunkMeta.firstPage && p.pageNumber <= chunkMeta.lastPage)
              .map((p) => `--- [Page ${p.pageNumber}] ---\n${cleanDocumentArtifacts(p.text)}`)
              .join("\n\n")
          : "";
        try {
          const visionResult = await extractQuestionsWithAiChunk({
            textChunk: hint,
            pageImages: images,
            firstPage: chunkMeta.firstPage,
            startNumber: job.startNumber,
            endNumber: job.endNumber,
            subjectContext,
            chapterContext: job.chapter || undefined,
            sourceName: job.sourceName,
          });
          extractedQuestions = visionResult;
          printedAnswers = visionResult.answerKey ?? [];
          // Figures and reference images, from the pages already rendered.
          const figurePages = await figurePagesFor(extractedQuestions.filter((q) => hasFigure(q) || q.figureBoxes?.length));
          const cropped = await cropQuestionImages({ doc, pdf: pdfBuf, questions: extractedQuestions, pages: nums, figurePages });
          visionCrops = cropped.figures;
          for (const [num, png] of cropped.cards) cardCrops.set(num, png);
        } finally {
          for (const n of nums) {
            await doc.release(n).catch(() => {});
          }
        }
      });
    }

    // 3. Diagram / Structure Cropping for questions on these pages
    if (pdfBuf) {
      const figurePages = visionCrops ? [] : await figurePagesFor(extractedQuestions);

      if (visionCrops || figurePages.length) {
        try {
          const located = visionCrops ?? (await cropQuestionFigures(pdfBuf, { pages: figurePages }));
          // A misread question number still reaches the right question.
          const crops = matchFiguresToQuestions(located, extractedQuestions);
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

    // 4b. Reference images: upload each question's printed card.
    const cardUrls = new Map<number, string>();
    for (const [num, png] of cardCrops) {
      try {
        cardUrls.set(num, await uploadFile({ key: `questions/extracted/${jobId}/q${num}-card.png`, body: png, contentType: "image/png" }));
      } catch (err) {
        console.warn(`[chunk-pipeline] reference image upload failed for Q${num}:`, err);
      }
    }

    // 4c. The source printed in the PDF (ALLEN, ExamGOAL, …) when none was given.
    const detectedSource = extractedQuestions.map((q) => q.documentSource).find(Boolean);
    if (detectedSource && isAutoSource(job.sourceName)) {
      await prisma.extractionJob.update({ where: { id: jobId }, data: { sourceName: detectedSource } });
      job.sourceName = detectedSource;
    }

    // 4d. A page without its exercise heading continues the section of the
    // page before (chunks run in page order) — needed to match the answer key.
    let runningSection: string | null = typeof report.currentSection === "string" ? report.currentSection : null;
    extractedQuestions = [...extractedQuestions]
      .sort((a, b) => (a.sourcePage || 0) - (b.sourcePage || 0))
      .map((q) => {
        if (q.section) runningSection = q.section;
        return q.section ? q : { ...q, section: runningSection };
      });
    report.currentSection = runningSection;

    // 5. Save/Upsert questions into the database
    let savedCount = 0;
    for (const q of extractedQuestions) {
      if (!Number.isFinite(q.originalNumber)) continue;
      if (q.originalNumber < job.startNumber || q.originalNumber > job.endNumber) continue;

      // Exact duplicate (same statement and option set, formatting ignored):
      // of a Question Bank question, or of another question already extracted.
      const fingerprint = questionFingerprint(q.statement || "", q.options || null);
      // A question is identified by its page and printed number: modules
      // restart numbering in every exercise, so the number alone made
      // Exercise-II Q1 overwrite Exercise-I Q1.
      const sourceKey = `p${q.sourcePage || chunkMeta.firstPage}-q${q.originalNumber}`;
      const duplicateOf = await findDuplicate(fingerprint, jobId, sourceKey);

      // Periodic Table Chemistry concept classification
      let pTopic = q.topic || null;
      let pSubTopic = q.subTopic || null;
      let pDiff = q.difficulty || "MEDIUM";
      const extraReviewReasons: string[] = [];

      const isChemistryPeriodic =
        Boolean(job.subject && /chemistry/i.test(job.subject)) ||
        Boolean(job.chapter && /classifi|period/i.test(job.chapter)) ||
        Boolean(q.chapter && /classifi|period/i.test(q.chapter));

      if (isChemistryPeriodic) {
        const classified = classifyPeriodicTableQuestion({
          statement: q.statement || "",
          options: q.options,
          solution: q.solution,
          sectionHeader: q.section,
        });
        pTopic = classified.topic;
        pSubTopic = classified.subTopic;
        pDiff = classified.difficulty;
        if (classified.needsReview) {
          extraReviewReasons.push(`⚠️ Needs Concept Review: ${classified.reasoning}`);
        }
      }

      const questionData = {
        jobId,
        sourceKey,
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
        imagesJson: {
          reference: cardUrls.get(q.originalNumber) ?? null,
          figure: q.imageUrl ?? null,
          page: q.sourcePage,
          fingerprint,
          duplicateOf: duplicateOf?.code ?? null,
          duplicateOfQuestionId: duplicateOf?.questionId ?? null,
          section: q.section ?? null,
          pyqExam: q.pyqExam ?? null,
          pyqYear: q.pyqYear ?? null,
        } as any,
        hasEquation: Boolean(q.hasEquation),
        sectionHeader: q.section ?? null,
        approvalStatus: "PENDING",
        subject: q.subject || job.subject || "Chemistry",
        chapter: isChemistryPeriodic
          ? "Classification of Elements and Periodicity in Properties"
          : q.chapter || job.chapter || null,
        topic: pTopic,
        subTopic: pSubTopic,
        questionType: q.questionType || "SINGLE_CORRECT",
        difficulty: pDiff,
        status: duplicateOf
          ? "DUPLICATE"
          : extraReviewReasons.length > 0
          ? "REVIEW_REQUIRED"
          : q.status || "VERIFIED",
        confidence: q.confidence || 95.0,
        confidenceBreakdown: q.confidenceBreakdown ? (q.confidenceBreakdown as any) : (Prisma.DbNull as any),
        reviewReasons: duplicateOf
          ? [...(q.reviewReasons || []), `🔁 Duplicate: the same question is already ${duplicateOf.where} (${duplicateOf.code}).`, ...extraReviewReasons]
          : [...(q.reviewReasons || []), ...extraReviewReasons],
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
        where: { jobId, OR: [{ sourceKey }, { sourceKey: null, originalNumber: q.originalNumber, sourcePage: q.sourcePage || chunkMeta.firstPage }] },
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

    // Printed answer-key entries seen on this chunk, applied when the job ends.
    if (printedAnswers.length) {
      report.answerKeys = [...(Array.isArray(report.answerKeys) ? report.answerKeys : []), ...printedAnswers];
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

  // Last chunk: the printed answer key replaces answers the AI worked out.
  if (isComplete && Array.isArray(report.answerKeys) && report.answerKeys.length) {
    await applyPrintedAnswers(jobId, report.answerKeys as PrintedAnswer[]).catch((err) =>
      console.warn("[chunk-pipeline] applying the printed answer key failed:", err)
    );
  }

  // Guarantee continuous 1..N sequence and pre-assign stable unique Question IDs
  if (isComplete) {
    await ensureBatchSequenceAndCodes(jobId).catch((err) =>
      console.warn("[chunk-pipeline] ensureBatchSequenceAndCodes failed:", err)
    );
  }

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
    const pdfBuf = await jobPdf(job);
    let pages: { pageNumber: number; text: string }[] = [];
    if (pdfBuf) {
      pages = await jobPages(job.id, pdfBuf);
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
