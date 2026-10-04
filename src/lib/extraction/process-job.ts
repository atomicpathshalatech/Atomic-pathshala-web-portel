import "server-only";
import { prisma } from "@/lib/db";
import { uploadFile } from "@/lib/storage";
import { withRenderedPdf } from "@/lib/pdf/page-renderer";
import { cleanDocumentArtifacts, extractTextFromPdfBuffer, extractQuestionsWithAiChunk, type ExtractedAiQuestion } from "./pdf-extractor";
import { detectQuestionBlocks } from "./boundary-detector";
import { extractAnswerKey, extractSolutions } from "./answer-key-engine";
import { validateAndClassifyQuestions } from "./validator";
import { attachFigures, cropQuestionFigures, FIGURE_PLACEHOLDER } from "./figure-crops";

/**
 * PDF → extracted questions, in the background of the upload request.
 *
 * What used to go wrong (and what this does instead):
 *  - The whole document went to the AI in ONE call, cut at 45,000 characters,
 *    with the default output limit — big papers lost most questions, the JSON
 *    came back truncated and everything fell back to the regex parser.
 *    → Pages are sent in small chunks (each with its real page numbers) and
 *      the results are merged by question number.
 *  - Scanned pages and Hindi PDFs in legacy fonts (Kruti Dev etc.) have no
 *    readable text layer, so extraction "failed" or produced garbage.
 *    → Those pages are sent to the AI as page images instead.
 *  - Everything ran inside the request; a long paper hit the 300 s limit and
 *    the job stayed "PROCESSING" for ever. → A time budget: what is done is
 *    saved, the rest is reported, and any error marks the job FAILED.
 *  - Figures were located 3 pages per AI call over the first 60 pages only.
 *    → Only pages that have a figure question, one page per call.
 */

const WORK_BUDGET_MS = 250_000; // inside the route's maxDuration (300 s)
const MAX_CHUNK_CHARS = 14_000;
const MAX_TEXT_PAGES_PER_CHUNK = 6;
const IMAGE_PAGES_PER_CHUNK = 2;

export type ExtractionInput = {
  jobId: string;
  pdfBuffer: Buffer | null;
  rawText?: string | null;
  startNumber: number;
  endNumber: number;
  subject: string; // "Auto Detect" or a subject
  chapter: string | null;
  sourceName: string;
  fileName: string;
  fileUrl: string;
};

const STOPWORDS = new Set(["the", "of", "is", "and", "which", "following", "in", "to", "a", "an", "are", "for", "with", "be", "by", "on", "if", "that", "correct", "statement", "its", "from"]);

/** A page whose text layer is empty, or is a legacy-font Hindi page that decodes to Latin gibberish. */
function needsVision(text: string): boolean {
  const letters = (text.match(/[A-Za-zऀ-ॿ]/g) || []).length;
  if (letters < 80) return true;
  const devanagari = (text.match(/[ऀ-ॿ]/g) || []).length;
  if (devanagari > 20) {
    // Many PDFs store Hindi in visual order: the "ि" matra comes before its
    // consonant and conjuncts split ("िनम् निलिखत", "प श् न"). In real Unicode
    // text "ि" never starts a word and "्" is never followed by a space.
    const broken = (text.match(/(^|[\s(])\u093F/g) || []).length + (text.match(/\u094D\s/g) || []).length;
    return broken >= 2;
  }
  const words = text.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  if (words.length < 40) return false;
  const common = words.filter((w) => STOPWORDS.has(w)).length / words.length;
  return common < 0.02; // real English exam text is full of "the/of/which/following"
}

type Chunk = { firstPage: number; lastPage: number; text?: string; vision?: boolean };

function planChunks(pages: { pageNumber: number; text: string }[]): Chunk[] {
  const chunks: Chunk[] = [];
  let cur: { pages: { pageNumber: number; text: string }[]; chars: number } | null = null;
  const flush = () => {
    if (!cur || !cur.pages.length) return;
    chunks.push({
      firstPage: cur.pages[0]!.pageNumber,
      lastPage: cur.pages[cur.pages.length - 1]!.pageNumber,
      text: cur.pages.map((p) => `--- [Page ${p.pageNumber}] ---\n${p.text}`).join("\n\n"),
    });
    cur = null;
  };
  let visionRun: number[] = [];
  const flushVision = () => {
    for (let i = 0; i < visionRun.length; i += IMAGE_PAGES_PER_CHUNK) {
      const run = visionRun.slice(i, i + IMAGE_PAGES_PER_CHUNK);
      chunks.push({ firstPage: run[0]!, lastPage: run[run.length - 1]!, vision: true });
    }
    visionRun = [];
  };
  for (const p of pages) {
    if (needsVision(p.text)) {
      flush();
      visionRun.push(p.pageNumber);
      continue;
    }
    flushVision();
    const clean = cleanDocumentArtifacts(p.text);
    if (cur && (cur.chars + clean.length > MAX_CHUNK_CHARS || cur.pages.length >= MAX_TEXT_PAGES_PER_CHUNK)) flush();
    cur ??= { pages: [], chars: 0 };
    cur.pages.push({ pageNumber: p.pageNumber, text: clean });
    cur.chars += clean.length;
  }
  flush();
  flushVision();
  return chunks.sort((a, b) => a.firstPage - b.firstPage);
}

/** Two copies of the same printed question (chunk overlap / page break): keep the more complete one. */
function completeness(q: ExtractedAiQuestion): number {
  return (
    (q.statement?.length ?? 0) / 50 +
    Object.values(q.options || {}).filter((o) => String(o).trim()).length * 5 +
    (q.correctAnswer ? 10 : 0) +
    (q.solution ? 3 : 0) +
    (q.statementHi ? 2 : 0)
  );
}

async function setStep(jobId: string, progress: number, currentStep: string) {
  await prisma.extractionJob.update({ where: { id: jobId }, data: { progress, currentStep } }).catch(() => {});
}

export async function processExtractionJob(input: ExtractionInput): Promise<void> {
  const startedAt = Date.now();
  const { jobId, startNumber, endNumber } = input;
  const expectedCount = endNumber - startNumber + 1;
  const subjectContext = input.subject !== "Auto Detect" ? input.subject : undefined;
  const notes: string[] = [];

  try {
    // 1. Read the pages
    await setStep(jobId, 10, "Reading the PDF pages...");
    let pages: { pageNumber: number; text: string }[] = [];
    if (input.pdfBuffer) {
      const res = await extractTextFromPdfBuffer(input.pdfBuffer);
      pages = res.pages;
    }
    if ((!pages.length || pages.every((p) => !p.text.trim())) && input.rawText?.trim() && !input.pdfBuffer) {
      pages = [{ pageNumber: 1, text: input.rawText.trim() }];
    }

    const chunks = planChunks(pages);
    const visionChunks = chunks.filter((c) => c.vision).length;
    if (visionChunks) notes.push(`${visionChunks} chunk(s) read from page images (scanned or non-Unicode Hindi pages).`);

    // 2. AI extraction, chunk by chunk, inside the time budget
    const byNumber = new Map<number, ExtractedAiQuestion>();
    const skippedPages: string[] = [];
    let aiChunksOk = 0;
    let aiChunksFailed = 0;

    const runChunk = async (c: Chunk, images?: string[]) => {
      const list = await extractQuestionsWithAiChunk({
        textChunk: c.text ?? "",
        pageImages: images,
        firstPage: c.firstPage,
        startNumber,
        endNumber,
        subjectContext,
        chapterContext: input.chapter || undefined,
        sourceName: input.sourceName,
      });
      for (const q of list) {
        if (!Number.isFinite(q.originalNumber)) continue;
        if (q.originalNumber < startNumber || q.originalNumber > endNumber) continue;
        if (!q.sourcePage || q.sourcePage < c.firstPage || q.sourcePage > c.lastPage) q.sourcePage = c.firstPage;
        const prev = byNumber.get(q.originalNumber);
        if (!prev || completeness(q) > completeness(prev)) byNumber.set(q.originalNumber, q);
      }
    };

    const textChunks = chunks.filter((c) => !c.vision);
    const imageChunks = chunks.filter((c) => c.vision);
    let done = 0;
    const total = chunks.length || 1;

    for (const c of textChunks) {
      if (Date.now() - startedAt > WORK_BUDGET_MS) {
        skippedPages.push(`${c.firstPage}–${c.lastPage}`);
        continue;
      }
      await setStep(jobId, 15 + Math.round((done / total) * 55), `Extracting questions — pages ${c.firstPage}–${c.lastPage}...`);
      try {
        await runChunk(c);
        aiChunksOk++;
      } catch (err) {
        aiChunksFailed++;
        console.warn(`[process-job] text chunk ${c.firstPage}-${c.lastPage} failed:`, err);
        notes.push(`Pages ${c.firstPage}–${c.lastPage}: AI extraction failed (${err instanceof Error ? err.message.slice(0, 120) : "error"}).`);
      }
      done++;
    }

    if (imageChunks.length && input.pdfBuffer) {
      await withRenderedPdf(input.pdfBuffer, async (doc) => {
        for (const c of imageChunks) {
          if (Date.now() - startedAt > WORK_BUDGET_MS) {
            skippedPages.push(`${c.firstPage}–${c.lastPage}`);
            continue;
          }
          await setStep(jobId, 15 + Math.round((done / total) * 55), `Reading page images ${c.firstPage}–${c.lastPage}...`);
          const nums = Array.from({ length: c.lastPage - c.firstPage + 1 }, (_, i) => c.firstPage + i);
          try {
            const images = await Promise.all(nums.map((n) => doc.jpeg(n, 1800)));
            await runChunk(c, images);
            aiChunksOk++;
          } catch (err) {
            aiChunksFailed++;
            console.warn(`[process-job] image chunk ${c.firstPage}-${c.lastPage} failed:`, err);
            notes.push(`Pages ${c.firstPage}–${c.lastPage} (images): AI extraction failed.`);
          } finally {
            for (const n of nums) await doc.release(n).catch(() => {});
          }
          done++;
        }
      });
    }

    if (skippedPages.length) notes.push(`Not processed (time limit): pages ${skippedPages.join(", ")}. Upload those pages / that question range again.`);

    let extractedList: ExtractedAiQuestion[] = Array.from(byNumber.values()).sort((a, b) => a.originalNumber - b.originalNumber);
    const isAiProcessed = extractedList.length > 0;

    // 3. Figures — crop from the pages that have a figure question
    if (isAiProcessed && input.pdfBuffer) {
      const figurePages = Array.from(new Set(extractedList.filter((q) => q.hasImage).map((q) => q.sourcePage))).filter((n) => n > 0);
      if (figurePages.length && Date.now() - startedAt < WORK_BUDGET_MS) {
        await setStep(jobId, 75, `Cropping structures & diagrams (${figurePages.length} page(s))...`);
        try {
          const crops = await cropQuestionFigures(input.pdfBuffer, { pages: figurePages, deadlineMs: startedAt + WORK_BUDGET_MS + 25_000 });
          const uploaded: { questionNumber: number; place: "STATEMENT" | "A" | "B" | "C" | "D"; url: string }[] = [];
          for (const [i, c] of crops.entries()) {
            const url = await uploadFile({ key: `questions/extracted/${jobId}/q${c.questionNumber}-${c.place}-${i}.png`, body: c.png, contentType: "image/png" });
            uploaded.push({ questionNumber: c.questionNumber, place: c.place, url });
          }
          extractedList = attachFigures(extractedList, uploaded);
        } catch (figErr) {
          console.warn("[process-job] figure cropping skipped:", figErr);
          notes.push("Figure cropping failed — attach the diagrams manually.");
        }
      }
      // A [FIGURE] spot with no cropped figure: take the marker out and flag it.
      extractedList = extractedList.map((q) => {
        const texts = [q.statement, q.statementHi, ...Object.values(q.options || {}), ...Object.values(q.optionsHi || {})].map((t) => String(t ?? ""));
        if (!texts.some((t) => t.includes(FIGURE_PLACEHOLDER))) return q;
        const clean = (t: any) => (typeof t === "string" ? t.split(FIGURE_PLACEHOLDER).join("").trim() : t);
        return {
          ...q,
          statement: clean(q.statement),
          statementHi: clean(q.statementHi),
          options: Object.fromEntries(Object.entries(q.options || {}).map(([k, v]) => [k, clean(v)])) as ExtractedAiQuestion["options"],
          optionsHi: q.optionsHi ? (Object.fromEntries(Object.entries(q.optionsHi).map(([k, v]) => [k, clean(v)])) as ExtractedAiQuestion["optionsHi"]) : q.optionsHi,
          hasImage: true,
          missingImage: true,
          status: "REVIEW_REQUIRED" as const,
          reviewReasons: [...(q.reviewReasons || []), "⚠️ Structure/diagram could not be cropped automatically — attach the image."],
        };
      });
    }

    await setStep(jobId, 90, "Validating and saving questions...");

    // 4. Rows to save
    let rows: any[] = [];
    let report: any;
    if (isAiProcessed) {
      const found = new Set(extractedList.map((q) => q.originalNumber));
      const missingNumbers = Array.from({ length: expectedCount }, (_, i) => startNumber + i).filter((n) => !found.has(n));
      const verified = extractedList.filter((q) => q.status === "VERIFIED").length;
      const reviewReq = extractedList.filter((q) => q.status === "REVIEW_REQUIRED").length;
      const errors = extractedList.filter((q) => q.status === "EXTRACTION_ERROR").length;
      const issues: any[] = extractedList
        .filter((q) => q.reviewReasons?.length)
        .map((q) => ({ questionNumber: q.originalNumber, severity: q.status === "EXTRACTION_ERROR" ? "ERROR" : "WARNING", message: q.reviewReasons.join(" • ") }));
      if (missingNumbers.length) {
        issues.unshift({ questionNumber: missingNumbers[0], severity: "WARNING", message: `Not found in the PDF: Q${missingNumbers.slice(0, 30).join(", Q")}${missingNumbers.length > 30 ? "…" : ""}` });
      }
      for (const n of notes) issues.unshift({ questionNumber: 0, severity: "WARNING", message: n });

      report = {
        sourceName: input.sourceName,
        fileName: input.fileName,
        expectedRange: `${startNumber}–${endNumber}`,
        expectedCount,
        extractedCount: extractedList.length,
        verifiedCount: verified,
        reviewCount: reviewReq,
        errorCount: errors,
        missingCount: missingNumbers.length,
        duplicateCount: 0,
        answerKeyMatchedCount: extractedList.filter((q) => q.correctAnswer).length,
        solutionsMatchedCount: extractedList.filter((q) => q.solution).length,
        status: errors > 0 ? "FAILED" : reviewReq > 0 || missingNumbers.length > 0 || skippedPages.length > 0 ? "REVIEW_REQUIRED" : "VERIFIED",
        aiChunks: { ok: aiChunksOk, failed: aiChunksFailed, skipped: skippedPages.length },
        issues,
      };

      const job = await prisma.extractionJob.findUnique({ where: { id: jobId }, select: { pyqExam: true, pyqYear: true, pyqMonth: true } });
      rows = extractedList.map((q, idx) => ({
        jobId,
        questionIndex: idx + 1,
        originalNumber: q.originalNumber,
        pyqExam: job?.pyqExam ?? null,
        pyqYear: job?.pyqYear ?? null,
        pyqMonth: job?.pyqMonth ?? null,
        pyqQuestionNumber: `Question ${String(q.originalNumber).padStart(2, "0")}`,
        sourceName: input.sourceName,
        sourcePdfUrl: input.fileUrl,
        sourcePdfName: input.fileName,
        sourcePage: q.sourcePage || 1,
        statement: q.statement,
        statementHi: q.statementHi || null,
        options: q.options,
        correctAnswer: q.correctAnswer || "",
        answerKeySource: q.answerKeySource || "AI_PARSER",
        solution: q.solution || null,
        solutionHi: q.solutionHi || null,
        hasTable: q.hasTable || false,
        hasImage: q.hasImage || false,
        hasEquation: q.hasEquation || false,
        imageUrl: q.imageUrl || null,
        subject: q.subject || subjectContext || "General",
        chapter: q.chapter || input.chapter || null,
        topic: q.topic || null,
        subTopic: q.subTopic || null,
        questionType: q.questionType || "SINGLE_CORRECT",
        difficulty: q.difficulty || "MEDIUM",
        status: q.status || "VERIFIED",
        confidence: q.confidence || 95,
        confidenceBreakdown: q.confidenceBreakdown || null,
        reviewReasons: q.reviewReasons || [],
        // Hindi options have no column of their own — they live in the snapshot
        // and the importer reads them from here (they used to be dropped).
        originalSnapshot: {
          statement: q.statement,
          statementHi: q.statementHi ?? null,
          options: q.options,
          optionsHi: q.optionsHi ?? null,
          correctAnswer: q.correctAnswer,
          solution: q.solution,
          sourceLanguage: q.sourceLanguage ?? null,
          autoTranslated: q.autoTranslated,
        },
      }));
    } else {
      // Regex fallback (no AI result at all)
      const cleanedText = cleanDocumentArtifacts(pages.map((p) => `--- [Page ${p.pageNumber}] ---\n${p.text}`).join("\n\n") || input.rawText || "");
      const rawBlocks = detectQuestionBlocks(cleanedText, startNumber, endNumber);
      const answersMap = extractAnswerKey(cleanedText, startNumber, endNumber);
      const solutionsMap = extractSolutions(cleanedText, startNumber, endNumber);
      const { validatedQuestions, report: r } = validateAndClassifyQuestions(rawBlocks, answersMap, solutionsMap, {
        sourceName: input.sourceName,
        fileName: input.fileName,
        fileUrl: input.fileUrl,
        startNumber,
        endNumber,
        defaultSubject: subjectContext,
        defaultChapter: input.chapter || undefined,
      });
      report = { ...r, issues: [...notes.map((n) => ({ questionNumber: 0, severity: "WARNING", message: n })), ...(r.issues || [])] };
      const job = await prisma.extractionJob.findUnique({ where: { id: jobId }, select: { pyqExam: true, pyqYear: true, pyqMonth: true } });
      rows = validatedQuestions.map((q) => ({
        jobId,
        questionIndex: q.questionIndex,
        originalNumber: q.originalNumber,
        pyqExam: job?.pyqExam ?? null,
        pyqYear: job?.pyqYear ?? null,
        pyqMonth: job?.pyqMonth ?? null,
        pyqQuestionNumber: `Question ${String(q.originalNumber).padStart(2, "0")}`,
        sourceName: q.sourceName,
        sourcePdfUrl: q.sourcePdfUrl,
        sourcePdfName: q.sourcePdfName,
        sourcePage: q.sourcePage,
        statement: q.statement,
        statementHi: q.statementHi || null,
        options: q.options,
        correctAnswer: q.correctAnswer,
        answerKeySource: q.answerKeySource,
        solution: q.solution || null,
        solutionHi: null,
        hasTable: q.hasTable,
        hasImage: q.hasImage,
        hasEquation: q.hasEquation,
        imageUrl: null,
        subject: q.subject,
        chapter: q.chapter || null,
        topic: q.topic || null,
        subTopic: q.subTopic || null,
        questionType: q.questionType,
        difficulty: q.difficulty,
        status: q.status,
        confidence: q.confidence,
        confidenceBreakdown: q.confidenceBreakdown,
        reviewReasons: q.reviewReasons,
        originalSnapshot: q.originalSnapshot,
      }));
    }

    if (rows.length) await prisma.extractedQuestion.createMany({ data: rows });

    await prisma.extractionJob.update({
      where: { id: jobId },
      data: {
        extractedCount: report.extractedCount ?? rows.length,
        verifiedCount: report.verifiedCount ?? 0,
        reviewCount: report.reviewCount ?? 0,
        errorCount: report.errorCount ?? 0,
        missingCount: report.missingCount ?? 0,
        duplicateCount: report.duplicateCount ?? 0,
        status: rows.length === 0 ? "FAILED" : report.status === "VERIFIED" ? "VERIFIED" : report.status === "REVIEW_REQUIRED" ? "REVIEW_REQUIRED" : "FAILED",
        progress: 100,
        currentStep: rows.length === 0 ? "No questions could be extracted from this file." : "Validation Complete",
        reportJson: report,
      },
    });
  } catch (err) {
    console.error(`[process-job] extraction job ${jobId} failed:`, err);
    await prisma.extractionJob
      .update({
        where: { id: jobId },
        data: {
          status: "FAILED",
          progress: 100,
          currentStep: `Extraction failed: ${err instanceof Error ? err.message.slice(0, 180) : String(err)}`,
        },
      })
      .catch(() => {});
  }
}

/** A job still PROCESSING long after its last update was cut off — mark it FAILED so it doesn't spin for ever. */
export async function recoverStaleExtractionJob(job: { id: string; status: string; updatedAt: Date }): Promise<boolean> {
  if (job.status !== "PROCESSING" || Date.now() - job.updatedAt.getTime() < 8 * 60 * 1000) return false;
  const saved = await prisma.extractedQuestion.count({ where: { jobId: job.id } });
  await prisma.extractionJob.update({
    where: { id: job.id },
    data: {
      status: saved > 0 ? "REVIEW_REQUIRED" : "FAILED",
      progress: 100,
      currentStep: saved > 0 ? "Stopped early — the saved questions are ready for review." : "Extraction was cut off before finishing. Please upload again (or a smaller page range).",
    },
  });
  return true;
}
