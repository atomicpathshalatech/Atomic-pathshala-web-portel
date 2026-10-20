import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { uploadFile } from "@/lib/storage";
import { geminiKeyManager } from "@/lib/ai/gemini-key-manager";
import { extractTextFromPdfBuffer, extractQuestionsWithAiChunk, type ExtractedAiQuestion } from "@/lib/extraction/pdf-extractor";
import { cropQuestionFigures, cropQuestionCards } from "@/lib/extraction/figure-crops";
import { examPatterns } from "./exams-service";
import { findExamTags, headingTagForLine, resolveQuestionMeta, stripQuestionTag, type DetectedTag, type ExamPattern } from "./metadata-detect";
import { parsePyqText, type ParsedPage } from "./text-parser";
import { classifyQuestion } from "./classify";
import { compareQuestions, questionFingerprint, DUPLICATE_WARNING_SCORE } from "./fingerprint";

/**
 * PYQ import, one chunk (a few pages) per call so a large PDF never has to
 * fit in one request. Called by processChunkForJob for jobs with
 * isPyqImport = true; the ordinary extraction path is untouched.
 *
 *   text pages      -> deterministic parser (src/lib/pyq/text-parser.ts)
 *   scanned pages   -> the browser OCRs them (POST .../ocr-page stores the
 *                      text in reportJson.ocrPages), then the same parser
 *   unreadable text -> AI extraction, only when a Gemini key is configured
 *
 * Every saved row is keyed by (jobId, sourceKey), so retries and resumed
 * runs update rather than duplicate, and a reviewer's edits are never
 * overwritten by a re-run.
 */

const LOCK_MS = 4 * 60_000;

export type PyqChunkStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "NEEDS_OCR";
export type PyqChunk = {
  index: number;
  firstPage: number;
  lastPage: number;
  isVision: boolean;
  status: PyqChunkStatus;
  extractedQuestionsCount: number;
  method?: string;
  error?: string;
  processedAt?: string;
};
export type PyqChunkPlan = { totalPages: number; totalChunks: number; chunks: PyqChunk[]; completedChunks: number; failedChunks: number; allProcessed: boolean };

export type PyqReport = {
  chunkPlan?: PyqChunkPlan;
  ocrPages?: Record<string, { text: string; confidence: number }>;
  warnings?: string[];
  [k: string]: unknown;
};

export function aiFallbackAvailable(): boolean {
  const s = geminiKeyManager.getAvailableKeysSummary();
  return s.totalFree + s.totalPaid > 0;
}

/** Pages that need OCR text before their chunk can be parsed. */
export function pagesNeedingOcr(report: PyqReport): number[] {
  const plan = report.chunkPlan;
  if (!plan) return [];
  const done = report.ocrPages ?? {};
  const pages: number[] = [];
  for (const c of plan.chunks) {
    if (!c.isVision || c.status === "COMPLETED") continue;
    for (let p = c.firstPage; p <= c.lastPage; p++) if (!done[String(p)]) pages.push(p);
  }
  return pages;
}

function countsFrom(plan: PyqChunkPlan) {
  plan.completedChunks = plan.chunks.filter((c) => c.status === "COMPLETED").length;
  plan.failedChunks = plan.chunks.filter((c) => c.status === "FAILED").length;
  plan.allProcessed = plan.chunks.every((c) => c.status === "COMPLETED" || c.status === "FAILED");
  return plan;
}

/** All parseable page texts of the document (text layer + stored OCR), in page order. */
function documentPages(textPages: { pageNumber: number; text: string }[], plan: PyqChunkPlan, report: PyqReport): ParsedPage[] {
  const visionPages = new Set<number>();
  for (const c of plan.chunks) if (c.isVision) for (let p = c.firstPage; p <= c.lastPage; p++) visionPages.add(p);
  const ocr = report.ocrPages ?? {};
  const out: ParsedPage[] = [];
  for (const p of textPages) {
    if (visionPages.has(p.pageNumber)) {
      const o = ocr[String(p.pageNumber)];
      if (o?.text) out.push({ pageNumber: p.pageNumber, text: o.text });
    } else out.push(p);
  }
  return out.sort((a, b) => a.pageNumber - b.pageNumber);
}

/** The last section heading on or before a page (for AI-extracted questions). */
function headingBeforePage(pages: ParsedPage[], page: number, patterns: ExamPattern[]): DetectedTag | null {
  let last: DetectedTag | null = null;
  for (const p of pages) {
    if (p.pageNumber > page) break;
    for (const line of p.text.split("\n")) {
      const h = headingTagForLine(line, patterns);
      if (h) last = h;
    }
  }
  return last;
}

type Draft = {
  sourceKey: string;
  number: number;
  sourcePage: number;
  statement: string;
  options: { A: string; B: string; C: string; D: string };
  answer: string | null;
  answerSource: string | null;
  solution: string | null;
  hasImageHint: boolean;
  questionTag: DetectedTag | null;
  sectionTag: DetectedTag | null;
  issues: string[];
  method: "TEXT_PARSER" | "OCR_PARSER" | "AI_TEXT" | "AI_VISION";
  imageUrl?: string | null;
};

function fromAi(q: ExtractedAiQuestion, method: "AI_TEXT" | "AI_VISION", sectionTag: DetectedTag | null, patterns: ExamPattern[]): Draft {
  let statement = q.statement || "";
  const tags = findExamTags(statement, patterns);
  const questionTag = tags.length ? tags[tags.length - 1]! : null;
  if (questionTag) statement = stripQuestionTag(statement, questionTag);
  const answer = /^[A-D](,[A-D])*$/.test(String(q.correctAnswer || "").toUpperCase()) && q.answerKeySource && q.answerKeySource !== "INFERRED_REVIEW" ? String(q.correctAnswer).toUpperCase() : null;
  return {
    sourceKey: `ai:p${q.sourcePage}#${q.originalNumber}`,
    number: q.originalNumber,
    sourcePage: q.sourcePage,
    statement,
    options: { A: q.options?.A ?? "", B: q.options?.B ?? "", C: q.options?.C ?? "", D: q.options?.D ?? "" },
    answer,
    answerSource: answer ? q.answerKeySource ?? "AI" : null,
    solution: q.solution ?? null,
    hasImageHint: Boolean(q.hasImage),
    questionTag,
    sectionTag,
    issues: [
      "Extracted with AI — compare with the source page before approving.",
      ...(answer ? [] : ["No trustworthy answer found in the PDF."]),
    ],
    method,
    imageUrl: q.imageUrl ?? null,
  };
}

/** Claims the job for one runner; false when another runner holds it. */
async function claim(jobId: string): Promise<boolean> {
  const now = new Date();
  const res = await prisma.extractionJob.updateMany({
    where: { id: jobId, OR: [{ lockedUntil: null }, { lockedUntil: { lt: now } }] },
    data: { lockedUntil: new Date(now.getTime() + LOCK_MS) },
  });
  return res.count === 1;
}

async function release(jobId: string) {
  await prisma.extractionJob.update({ where: { id: jobId }, data: { lockedUntil: null } }).catch(() => {});
}

export type PyqChunkResult = {
  success: boolean;
  chunkIndex: number;
  nextChunkIndex: number | null;
  isComplete: boolean;
  questionsExtracted: number;
  needsOcrPages?: number[];
  busy?: boolean;
  cancelled?: boolean;
  error?: string;
};

export async function processPyqChunk(
  jobId: string,
  chunkIndex: number,
  getPdf: () => Promise<Buffer | null>
): Promise<PyqChunkResult> {
  if (!(await claim(jobId))) {
    return { success: false, chunkIndex, nextChunkIndex: chunkIndex, isComplete: false, questionsExtracted: 0, busy: true, error: "Another run is processing this import." };
  }
  try {
    const job = await prisma.extractionJob.findUniqueOrThrow({ where: { id: jobId }, include: { pyqExamRef: true } });
    const report = ((job.reportJson as PyqReport | null) ?? {}) as PyqReport;
    const plan = report.chunkPlan;
    if (!plan) throw new Error("Import has no page plan yet.");

    if (job.cancelRequested) {
      await prisma.extractionJob.update({
        where: { id: jobId },
        data: { status: "CANCELLED", currentStep: "Import cancelled. Saved questions stay available; Resume continues from the next pages." },
      });
      return { success: false, chunkIndex, nextChunkIndex: null, isComplete: true, questionsExtracted: 0, cancelled: true };
    }

    const chunk = plan.chunks[chunkIndex];
    if (!chunk) {
      return { success: true, chunkIndex, nextChunkIndex: null, isComplete: true, questionsExtracted: 0 };
    }

    const pdf = await getPdf();
    const textPages = pdf ? (await extractTextFromPdfBuffer(pdf)).pages : [];
    const patterns = await examPatterns();
    const pages = documentPages(textPages, plan, report);

    let drafts: Draft[] = [];
    let chunkStatus: PyqChunkStatus = "COMPLETED";
    let chunkError: string | undefined;
    let method: Draft["method"] = chunk.isVision ? "OCR_PARSER" : "TEXT_PARSER";

    const inChunk = (p: number) => p >= chunk.firstPage && p <= chunk.lastPage;
    const ocrMissing = chunk.isVision && Array.from({ length: chunk.lastPage - chunk.firstPage + 1 }, (_, i) => chunk.firstPage + i).some((p) => !report.ocrPages?.[String(p)]);

    if (ocrMissing) {
      let aiError: string | null = null;
      if (pdf && aiFallbackAvailable()) {
        try {
          const { withRenderedPdf } = await import("@/lib/pdf/page-renderer");
          const nums = Array.from({ length: chunk.lastPage - chunk.firstPage + 1 }, (_, i) => chunk.firstPage + i);
          let ai: ExtractedAiQuestion[] = [];
          await withRenderedPdf(pdf, async (doc) => {
            const images = await Promise.all(nums.map((n) => doc.jpeg(n, 1800)));
            try {
              ai = await extractQuestionsWithAiChunk({ textChunk: "", pageImages: images, firstPage: chunk.firstPage, startNumber: 1, endNumber: 999, subjectContext: job.subject ?? undefined, chapterContext: job.chapter ?? undefined, sourceName: job.sourceName });
            } finally {
              for (const n of nums) await doc.release(n).catch(() => {});
            }
          });
          method = "AI_VISION";
          drafts = ai.map((q) => fromAi(q, "AI_VISION", headingBeforePage(pages, q.sourcePage, patterns), patterns));
        } catch (err) {
          // AI unavailable (quota, outage): the page is still readable by OCR.
          aiError = err instanceof Error ? err.message.slice(0, 160) : String(err);
        }
      }
      if (method !== "AI_VISION") {
        chunkStatus = "NEEDS_OCR";
        chunkError = `Pages ${chunk.firstPage}–${chunk.lastPage} are scanned images — run OCR on this import page to read them.${aiError ? ` (AI extraction failed: ${aiError})` : ""}`;
      }
    } else {
      const parsed = parsePyqText(pages, patterns);
      drafts = parsed.questions
        .filter((q) => inChunk(q.sourcePage))
        .map((q) => ({
          sourceKey: q.sourceKey,
          number: q.number,
          sourcePage: q.sourcePage,
          statement: q.statement,
          options: q.options,
          answer: q.answer,
          answerSource: q.answerSource,
          solution: q.solution,
          hasImageHint: q.hasImageHint,
          questionTag: q.questionTag,
          sectionTag: q.sectionTag,
          issues: q.issues,
          method,
        }));
      const chunkText = pages.filter((p) => inChunk(p.pageNumber)).map((p) => p.text).join("\n");
      const looksLikeQuestions = /\(\s*[1-4a-dA-D]\s*\)/.test(chunkText);
      if (!drafts.length && looksLikeQuestions) {
        if (aiFallbackAvailable()) {
          method = "AI_TEXT";
          const ai = await extractQuestionsWithAiChunk({
            textChunk: pages.filter((p) => inChunk(p.pageNumber)).map((p) => `--- [Page ${p.pageNumber}] ---\n${p.text}`).join("\n\n"),
            firstPage: chunk.firstPage,
            startNumber: 1,
            endNumber: 999,
            subjectContext: job.subject ?? undefined,
            chapterContext: job.chapter ?? undefined,
            sourceName: job.sourceName,
          });
          drafts = ai.map((q) => fromAi(q, "AI_TEXT", headingBeforePage(pages, q.sourcePage, patterns), patterns));
        } else {
          chunkStatus = "FAILED";
          chunkError = `No questions could be read on pages ${chunk.firstPage}–${chunk.lastPage} (unusual layout). Retry after fixing, or add them manually.`;
        }
      }
    }

    // Full Question Reference Image Cropping:
    // Every question gets an authoritative high-resolution reference card (180 DPI)
    // preserving formulas, math, diagrams, chemical bonds, and all options A-D.
    if (pdf && drafts.length > 0) {
      try {
        const uncropped = drafts.filter((d) => !d.imageUrl);
        if (uncropped.length > 0) {
          const cardCrops = await cropQuestionCards(
            pdf,
            uncropped.map((d) => ({ number: d.number, sourcePage: d.sourcePage }))
          );
          for (const c of cardCrops) {
            const d = drafts.find((x) => x.sourcePage === c.page && x.number === c.questionNumber);
            if (d && !d.imageUrl) {
              d.imageUrl = await uploadFile({
                key: `questions/pyq-import/${jobId}/p${c.page}-q${c.questionNumber}-card.png`,
                body: c.png,
                contentType: "image/png",
              });
              d.hasImageHint = true;
            }
          }
        }
      } catch (err) {
        console.warn(`[pyq-import] full question card cropping failed on chunk ${chunkIndex}:`, err);
      }
    }

    const saved = await saveDrafts(job, drafts);

    chunk.status = chunkStatus;
    chunk.method = drafts.length ? method : chunk.method;
    chunk.error = chunkError;
    chunk.extractedQuestionsCount = saved;
    chunk.processedAt = new Date().toISOString();
    countsFrom(plan);
    report.chunkPlan = plan;

    return await finishChunk(jobId, report, chunkIndex, saved, chunkError);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[pyq-import] chunk ${chunkIndex} of ${jobId} failed:`, err);
    const job = await prisma.extractionJob.findUnique({ where: { id: jobId } });
    const report = ((job?.reportJson as PyqReport | null) ?? {}) as PyqReport;
    const chunk = report.chunkPlan?.chunks[chunkIndex];
    if (report.chunkPlan && chunk) {
      chunk.status = "FAILED";
      chunk.error = message.slice(0, 300);
      countsFrom(report.chunkPlan);
      return await finishChunk(jobId, report, chunkIndex, 0, message);
    }
    return { success: false, chunkIndex, nextChunkIndex: null, isComplete: true, questionsExtracted: 0, error: message };
  } finally {
    await release(jobId);
  }
}

async function finishChunk(jobId: string, report: PyqReport, chunkIndex: number, saved: number, error?: string): Promise<PyqChunkResult> {
  const plan = report.chunkPlan!;
  const next = plan.chunks.find((c) => c.status === "PENDING");
  const needsOcr = plan.chunks.filter((c) => c.status === "NEEDS_OCR");
  const [total, review, pending] = await Promise.all([
    prisma.extractedQuestion.count({ where: { jobId } }),
    prisma.extractedQuestion.count({ where: { jobId, status: "REVIEW_REQUIRED" } }),
    prisma.extractedQuestion.count({ where: { jobId, reviewDecision: "PENDING" } }),
  ]);
  const done = plan.chunks.filter((c) => c.status === "COMPLETED" || c.status === "FAILED").length;
  const status = next ? "PROCESSING" : needsOcr.length ? "NEEDS_OCR" : total === 0 ? "FAILED" : "REVIEW_REQUIRED";
  const step = next
    ? `Read pages ${plan.chunks[chunkIndex]?.firstPage}–${plan.chunks[chunkIndex]?.lastPage} (${done}/${plan.totalChunks} page groups).`
    : needsOcr.length
    ? `${needsOcr.reduce((n, c) => n + (c.lastPage - c.firstPage + 1), 0)} scanned page(s) need OCR before they can be read.`
    : `Finished: ${total} question(s) extracted from ${plan.totalPages} page(s)${plan.failedChunks ? `, ${plan.failedChunks} page group(s) failed` : ""}. ${pending} awaiting review.`;
  await prisma.extractionJob.update({
    where: { id: jobId },
    data: {
      status,
      progress: Math.round((done / Math.max(1, plan.totalChunks)) * 100),
      currentStep: step,
      extractedCount: total,
      reviewCount: review,
      errorCount: plan.failedChunks,
      reportJson: report as unknown as Prisma.InputJsonValue,
    },
  });
  return {
    success: !error,
    chunkIndex,
    nextChunkIndex: next ? next.index : null,
    isComplete: !next,
    questionsExtracted: saved,
    needsOcrPages: needsOcr.length ? pagesNeedingOcr(report) : undefined,
    error,
  };
}

type JobForSave = {
  id: string;
  sourceName: string;
  fileUrl: string;
  fileName: string;
  subject: string | null;
  chapter: string | null;
  yearMode: string;
  pyqExamId: string | null;
  pyqYear: number | null;
  session: string | null;
  shift: string | null;
  paper: string | null;
  pyqExamRef: { id: string; name: string } | null;
};


function cleanUtf8<T>(val: T): T {
  if (typeof val === "string") return val.replace(/\0/g, "") as unknown as T;
  if (Array.isArray(val)) return val.map(cleanUtf8) as unknown as T;
  if (val && typeof val === "object") {
    const res: any = {};
    for (const [k, v] of Object.entries(val)) {
      res[k] = cleanUtf8(v);
    }
    return res;
  }
  return val;
}

async function saveDrafts(job: JobForSave, drafts: Draft[]): Promise<number> {
  if (!drafts.length) return 0;

  // Exam names for tag-detected exams (custom ones come from the table).
  const examIds = Array.from(new Set(drafts.flatMap((d) => [d.questionTag?.examId, d.sectionTag?.examId]).filter(Boolean) as string[]));
  const exams = new Map((await prisma.pyqExam.findMany({ where: { id: { in: examIds } }, select: { id: true, name: true } })).map((e) => [e.id, e.name]));

  // Duplicate evidence: exact fingerprints anywhere, near matches within the same subject.
  const prints = drafts.map((d) => questionFingerprint(d.statement, d.options));
  const exact = await prisma.question.findMany({ where: { contentFingerprint: { in: prints } }, select: { id: true, contentFingerprint: true } });
  const exactBy = new Map(exact.map((q) => [q.contentFingerprint!, q.id]));

  let saved = 0;
  for (const [i, d] of drafts.entries()) {
    const meta = resolveQuestionMeta({
      yearMode: job.yearMode === "MULTI" ? "MULTI" : "SINGLE",
      document: { examId: job.pyqExamId, examName: job.pyqExamRef?.name ?? null, year: job.pyqYear, session: job.session, shift: job.shift, paper: job.paper },
      questionTag: d.questionTag,
      sectionTag: d.sectionTag,
    });
    const reasons = [...d.issues, ...meta.conflicts];
    if (!meta.year) reasons.push("Year not detected — set the exam year before approving.");
    if (!meta.examId) reasons.push(`Exam "${meta.examLabel ?? "unknown"}" is not configured — choose or add the exam.`);

    const fixedChapter = job.chapter?.trim() || null;
    const cls = classifyQuestion({ statement: d.statement, options: d.options, subjectHint: job.subject, chapterHint: fixedChapter });
    const chapter = fixedChapter ?? cls.chapter;
    const needsChapterReview = !chapter;
    if (needsChapterReview) reasons.push("Needs Chapter Review — no confident chapter match.");

    const fingerprint = prints[i]!;
    let duplicateOf: string | null = exactBy.get(fingerprint) ?? null;
    let duplicateScore: number | null = duplicateOf ? 100 : null;
    if (!duplicateOf && (cls.subject || job.subject)) {
      const near = await nearDuplicate(d, cls.subject ?? job.subject!, chapter);
      if (near) {
        duplicateOf = near.id;
        duplicateScore = near.score;
      }
    }
    if (duplicateOf) reasons.push(`Possible duplicate of an existing question (${duplicateScore}% match).`);

    const data = {
      jobId: job.id,
      sourceKey: d.sourceKey,
      questionIndex: d.number,
      originalNumber: d.number,
      pyqExam: meta.examName,
      pyqExamId: meta.examId,
      pyqYear: meta.year,
      pyqMonth: meta.session,
      pyqSession: meta.session,
      pyqShift: meta.shift,
      pyqPaper: meta.paper,
      pyqQuestionNumber: String(d.number),
      sectionLabel: d.questionTag?.raw ?? d.sectionTag?.raw ?? null,
      metadataMethod: meta.method,
      extractionMethod: d.method,
      sourceName: job.sourceName,
      sourcePdfUrl: job.fileUrl,
      sourcePdfName: job.fileName,
      sourcePage: d.sourcePage,
      statement: d.statement,
      statementHi: /[ऀ-ॿ]/.test(d.statement) ? d.statement : null,
      options: d.options as unknown as Prisma.InputJsonValue,
      correctAnswer: d.answer ?? "",
      answerKeySource: d.answerSource,
      solution: d.solution,
      hasImage: d.hasImageHint || Boolean(d.imageUrl),
      imageUrl: d.imageUrl ?? null,
      imagesJson: d.imageUrl ? ([{ url: d.imageUrl, page: d.sourcePage }] as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
      hasEquation: /[=^_\\]|\$/.test(d.statement),
      subject: cls.subject ?? job.subject ?? "General",
      chapter,
      topic: cls.topic,
      chapterCandidates: cls.candidates as unknown as Prisma.InputJsonValue,
      needsChapterReview,
      contentFingerprint: fingerprint,
      duplicateOfQuestionId: duplicateOf,
      duplicateScore,
      duplicateDecision: duplicateOf ? "PENDING" : null,
      status: reasons.length ? "REVIEW_REQUIRED" : "EXTRACTED",
      confidence: d.method.startsWith("AI") ? 60 : reasons.length ? 70 : 90,
      reviewReasons: reasons as unknown as Prisma.InputJsonValue,
      originalSnapshot: {
        statement: d.statement,
        options: d.options,
        answer: d.answer,
        solution: d.solution,
        sourcePage: d.sourcePage,
        tag: d.questionTag?.raw ?? null,
        section: d.sectionTag?.raw ?? null,
        method: d.method,
      } as unknown as Prisma.InputJsonValue,
    };

    const cleanData = cleanUtf8(data);
    const existing = await prisma.extractedQuestion.findUnique({ where: { jobId_sourceKey: { jobId: job.id, sourceKey: d.sourceKey } } });
    if (existing) {
      // Never overwrite a reviewer's work on a retry.
      if (existing.isEdited || existing.reviewDecision !== "PENDING") continue;
      await prisma.extractedQuestion.update({ where: { id: existing.id }, data: cleanData });
    } else {
      await prisma.extractedQuestion.create({ data: cleanData });
    }
    saved++;
  }
  return saved;
}

/** Best near-duplicate among bank questions of the same subject (and chapter, when known). */
async function nearDuplicate(d: Draft, subject: string, chapter: string | null): Promise<{ id: string; score: number } | null> {
  const candidates = await prisma.question.findMany({
    where: { subject: { equals: subject, mode: "insensitive" }, ...(chapter ? { chapter: { equals: chapter, mode: "insensitive" } } : {}) },
    select: { id: true, contentFingerprint: true, translations: { where: { language: "ENGLISH" }, select: { statement: true, options: true }, take: 1 } },
    orderBy: { createdAt: "desc" },
    take: 400,
  });
  let best: { id: string; score: number } | null = null;
  for (const c of candidates) {
    const t = c.translations[0];
    if (!t) continue;
    const ev = compareQuestions(
      { statement: d.statement, options: d.options },
      { statement: t.statement, options: (t.options as Record<string, string> | null) ?? null, fingerprint: c.contentFingerprint }
    );
    if (ev.score >= DUPLICATE_WARNING_SCORE && ev.score > (best?.score ?? 0)) best = { id: c.id, score: ev.score };
  }
  return best;
}
