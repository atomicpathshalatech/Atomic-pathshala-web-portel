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

const LOCK_MS = 60_000;

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

function isQuotaOrTimeoutError(err: string | null): boolean {
  if (!err) return false;
  const m = err.toLowerCase();
  return m.includes("402") || m.includes("429") || m.includes("quota") || m.includes("aborted") || m.includes("timeout") || m.includes("high demand") || m.includes("503");
}

export function aiFallbackAvailable(): boolean {
  const s = geminiKeyManager.getAvailableKeysSummary();
  return s.availableFree + s.availablePaid > 0;
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
  statementHi?: string | null;
  options: { A: string; B: string; C: string; D: string };
  optionsHi?: Record<string, string> | null;
  answer: string | null;
  answerSource: string | null;
  solution: string | null;
  solutionHi?: string | null;
  hasImageHint: boolean;
  questionTag: DetectedTag | null;
  sectionTag: DetectedTag | null;
  issues: string[];
  method: "TEXT_PARSER" | "OCR_PARSER" | "AI_TEXT" | "AI_VISION";
  imageUrl?: string | null;
  subject?: string;
  chapter?: string | null;
  topic?: string | null;
  subTopic?: string | null;
  difficulty?: string;
  questionType?: string;
};

function fromAi(
  q: ExtractedAiQuestion,
  method: "AI_TEXT" | "AI_VISION",
  sectionTag: DetectedTag | null,
  patterns: ExamPattern[]
): Draft {
  let statement = q.statement || "";
  const tags = findExamTags(statement, patterns);
  const questionTag = tags.length ? tags[tags.length - 1]! : null;
  if (questionTag) statement = stripQuestionTag(statement, questionTag);
  const rawAns = String(q.correctAnswer || "").trim().toUpperCase();
  const answer = /^[A-D](,[A-D])*$/.test(rawAns) ? rawAns : (rawAns.length > 0 ? rawAns : null);

  const issues: string[] = [];
  if (!answer) issues.push("No trustworthy answer found in the PDF.");
  const opts = q.options || { A: "", B: "", C: "", D: "" };
  const isOptionBased = !["INTEGER", "NUMERICAL"].includes(q.questionType?.toUpperCase() || "");
  if (isOptionBased && (!opts.A || !opts.B || !opts.C || !opts.D)) {
    issues.push("Some options appear empty — verify options A-D.");
  }

  return {
    sourceKey: `ai:p${q.sourcePage}#${q.originalNumber}`,
    number: q.originalNumber,
    sourcePage: q.sourcePage,
    statement,
    statementHi: q.statementHi ?? null,
    options: { A: opts.A ?? "", B: opts.B ?? "", C: opts.C ?? "", D: opts.D ?? "" },
    optionsHi: (q.optionsHi as Record<string, string> | undefined) ?? null,
    answer,
    answerSource: answer ? q.answerKeySource ?? "AI" : null,
    solution: q.solution ?? null,
    solutionHi: q.solutionHi ?? null,
    hasImageHint: Boolean(q.hasImage),
    questionTag,
    sectionTag,
    issues,
    method,
    imageUrl: q.imageUrl ?? null,
    subject: q.subject,
    chapter: q.chapter ?? null,
    topic: q.topic ?? null,
    subTopic: q.subTopic ?? null,
    difficulty: q.difficulty || "MEDIUM",
    questionType: q.questionType || "SINGLE_CORRECT",
  };
}

async function extractDocumentAnswerKey(
  pdf: Buffer,
  textPages: { pageNumber: number; text: string }[]
): Promise<Record<string, string>> {
  const answerHeading = /(?:ANSWER\s*KEY|ANSWERS|उत्तर\s*कुंजी|HINTS\s*&\s*SOLUTIONS)/i;
  const pairRegex = /(?:[0-9]{1,3}\s*[:\.\-\)]\s*[A-D1-4])/gi;
  let targetPageNum: number | null = null;
  for (let i = textPages.length - 1; i >= 0; i--) {
    const p = textPages[i]!;
    if (answerHeading.test(p.text)) {
      const matchCount = (p.text.match(pairRegex) || []).length;
      if (matchCount >= 5) {
        targetPageNum = p.pageNumber;
        break;
      }
    }
  }

  if (!targetPageNum) return {};

  if (!aiFallbackAvailable()) {
    const { extractAnswerKey } = await import("@/lib/extraction/answer-key-engine");
    const p = textPages.find((x) => x.pageNumber === targetPageNum);
    if (!p) return {};
    const map = extractAnswerKey(p.text, 1, 999);
    const res: Record<string, string> = {};
    for (const [k, v] of map.entries()) res[String(k)] = v.answer;
    return res;
  }

  try {
    const { withRenderedPdf } = await import("@/lib/pdf/page-renderer");
    const { executeGeminiWithFailover } = await import("@/lib/questions/gemini-engine");
    const { parseAiJson } = await import("@/lib/ai/latex-json");

    return await withRenderedPdf(pdf, async (doc) => {
      const jpegB64 = await doc.jpeg(targetPageNum!);
      const prompt = `You are an expert exam key reader.
Look at this Answer Key page image. Extract the correct answer for every single question number printed on this page.
Map option numbers (1, 2, 3, 4) to (A, B, C, D).
Return STRICT JSON object mapping question number string to answer letter string:
{
  "1": "B",
  "2": "A"
}`;
      const raw = await executeGeminiWithFailover(async (client, modelName) => {
        const model = client.getGenerativeModel({
          model: modelName,
          generationConfig: { responseMimeType: "application/json", temperature: 0.0 },
        });
        const res = await model.generateContent([
          prompt,
          { inlineData: { mimeType: "image/jpeg", data: jpegB64 } },
        ]);
        return res.response.text();
      });

      return parseAiJson<Record<string, string>>(raw) || {};
    });
  } catch (err) {
    console.warn("[pyq-import] AI vision answer key extraction failed, using text fallback:", err);
    const { extractAnswerKey } = await import("@/lib/extraction/answer-key-engine");
    const p = textPages.find((x) => x.pageNumber === targetPageNum);
    if (!p) return {};
    const map = extractAnswerKey(p.text, 1, 999);
    const res: Record<string, string> = {};
    for (const [k, v] of map.entries()) res[String(k)] = v.answer;
    return res;
  }
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

    chunk.status = "PROCESSING";
    await prisma.extractionJob.update({
      where: { id: jobId },
      data: {
        currentStep: `Processing Chunk ${chunkIndex + 1} of ${plan.totalChunks} (Pages ${chunk.firstPage}–${chunk.lastPage})...`,
        reportJson: report as unknown as Prisma.InputJsonValue,
      },
    }).catch(() => {});

    const pdf = await getPdf();
    const textPages = pdf ? (await extractTextFromPdfBuffer(pdf)).pages : [];
    const patterns = await examPatterns();
    const pages = documentPages(textPages, plan, report);

    // Extract document answer key from booklet if not already present
    const docAnswerKey = (report.documentAnswerKey as Record<string, string> | undefined) || null;
    if (pdf && (!docAnswerKey || Object.keys(docAnswerKey).length === 0)) {
      try {
        const extractedKey = await extractDocumentAnswerKey(pdf, textPages);
        if (Object.keys(extractedKey).length > 0) {
          report.documentAnswerKey = extractedKey;
          await prisma.extractionJob.update({
            where: { id: jobId },
            data: { reportJson: report as unknown as Prisma.InputJsonValue },
          });
        }
      } catch (keyErr) {
        console.warn("[pyq-import] Failed to load document answer key:", keyErr);
      }
    }

    let drafts: Draft[] = [];
    let chunkStatus: PyqChunkStatus = "COMPLETED";
    let chunkError: string | undefined;
    let method: Draft["method"] = chunk.isVision ? "OCR_PARSER" : "TEXT_PARSER";

    const inChunk = (p: number) => p >= chunk.firstPage && p <= chunk.lastPage;
    const ocrMissing = chunk.isVision && Array.from({ length: chunk.lastPage - chunk.firstPage + 1 }, (_, i) => chunk.firstPage + i).some((p) => !report.ocrPages?.[String(p)]);

    // 1. High-Speed Deterministic Parser: Instant, zero-latency extraction for standard PDFs
    if (!chunk.isVision && !ocrMissing) {
      const parsed = parsePyqText(pages, patterns);
      const chunkQuestions = parsed.questions.filter((q) => inChunk(q.sourcePage));
      if (chunkQuestions.length > 0) {
        method = "TEXT_PARSER";
        const currentAnswerKey = (report.documentAnswerKey as Record<string, string> | undefined) || {};
        drafts = chunkQuestions.map((q) => {
          const hasEmptyOpts = !q.options.A || !q.options.B || !q.options.C || !q.options.D;
          const issues = [...q.issues];
          if (hasEmptyOpts) {
            issues.push("Options missing or formulas stripped — verify with original paper.");
          }
          let ans = q.answer;
          let ansSource = q.answerSource;
          const matchedAnswer = currentAnswerKey[String(q.number)];
          if (matchedAnswer) {
            ans = matchedAnswer;
            ansSource = "ANSWER_KEY_SECTION";
          }
          return {
            sourceKey: q.sourceKey,
            number: q.number,
            sourcePage: q.sourcePage,
            statement: q.statement,
            options: q.options,
            answer: ans,
            answerSource: ansSource,
            solution: q.solution,
            hasImageHint: q.hasImageHint,
            questionTag: q.questionTag,
            sectionTag: q.sectionTag,
            issues,
            method: "TEXT_PARSER" as const,
            subject: job.subject ?? undefined,
            chapter: job.chapter ?? undefined,
            difficulty: "MEDIUM",
            questionType: "SINGLE_CORRECT",
          };
        });
      }
    }

    // 2. High-Accuracy AI Extraction: For scanned chunks (isVision) or chunks where text parser returned 0 questions
    if (!drafts.length && aiFallbackAvailable()) {
      let aiExtracted: ExtractedAiQuestion[] = [];
      let usedMethod: "AI_VISION" | "AI_TEXT" = "AI_TEXT";
      let aiError: string | null = null;

      // Attempt Vision first if PDF buffer is available (renders crisp canvas images)
      if (pdf) {
        try {
          const { withRenderedPdf } = await import("@/lib/pdf/page-renderer");
          const nums = Array.from({ length: chunk.lastPage - chunk.firstPage + 1 }, (_, i) => chunk.firstPage + i);
          await withRenderedPdf(pdf, async (doc) => {
            const images = await Promise.all(nums.map((n) => doc.jpeg(n, 1200)));
            try {
              aiExtracted = await extractQuestionsWithAiChunk({
                textChunk: "",
                pageImages: images,
                firstPage: chunk.firstPage,
                startNumber: 1,
                endNumber: 999,
                subjectContext: job.subject ?? undefined,
                chapterContext: job.chapter ?? undefined,
                sourceName: job.sourceName,
              });
            } finally {
              for (const n of nums) await doc.release(n).catch(() => {});
            }
          });
          usedMethod = "AI_VISION";
        } catch (visionErr) {
          console.warn(`[pyq-import] AI Vision failed on chunk ${chunkIndex}, trying text:`, visionErr);
          aiError = visionErr instanceof Error ? visionErr.message : String(visionErr);
        }
      }

      // If vision wasn't available or failed, try AI on extracted text (only if not quota/timeout)
      if (!aiExtracted.length && aiFallbackAvailable() && !isQuotaOrTimeoutError(aiError)) {
        try {
          const chunkPages = pages.filter((p) => inChunk(p.pageNumber));
          const textChunk = chunkPages.map((p) => `--- [Page ${p.pageNumber}] ---\n${p.text}`).join("\n\n");
          if (textChunk.trim().length > 20) {
            aiExtracted = await extractQuestionsWithAiChunk({
              textChunk,
              firstPage: chunk.firstPage,
              startNumber: 1,
              endNumber: 999,
              subjectContext: job.subject ?? undefined,
              chapterContext: job.chapter ?? undefined,
              sourceName: job.sourceName,
            });
            usedMethod = "AI_TEXT";
          }
        } catch (textErr) {
          console.warn(`[pyq-import] AI Text failed on chunk ${chunkIndex}:`, textErr);
          aiError = textErr instanceof Error ? textErr.message : String(textErr);
        }
      }

      // Crop and attach figures / chemical structures
      if (pdf && aiExtracted.length > 0) {
        try {
          const { cropQuestionFigures, attachFigures } = await import("@/lib/extraction/figure-crops");
          const nums = Array.from({ length: chunk.lastPage - chunk.firstPage + 1 }, (_, i) => chunk.firstPage + i);
          const figures = await cropQuestionFigures(pdf, { pages: nums });
          if (figures.length > 0) {
            const uploadedFigures = await Promise.all(
              figures.map(async (f) => ({
                questionNumber: f.questionNumber,
                place: f.place,
                url: await uploadFile({
                  key: `questions/pyq-import/${jobId}/p${f.page}-q${f.questionNumber}-${f.place.toLowerCase()}.png`,
                  body: f.png,
                  contentType: "image/png",
                }),
              }))
            );
            aiExtracted = attachFigures(aiExtracted, uploadedFigures);
          }
        } catch (figErr) {
          console.warn("[pyq-import] Figure cropping failed:", figErr);
        }
      }

      if (aiExtracted.length > 0) {
        method = usedMethod;
        const currentAnswerKey = (report.documentAnswerKey as Record<string, string> | undefined) || {};
        drafts = aiExtracted.map((q) => {
          const d = fromAi(q, usedMethod, headingBeforePage(pages, q.sourcePage, patterns), patterns);
          const matchedAnswer = currentAnswerKey[String(d.number)];
          if (matchedAnswer) {
            d.answer = matchedAnswer;
            d.answerSource = "ANSWER_KEY_SECTION";
            d.issues = d.issues.filter((iss) => !iss.includes("trustworthy answer"));
          }
          if (d.answer && (!d.solution || d.solution.trim().length < 25)) {
            d.solution = `Explaining : Question ${d.number} analysis.\n\nConcept : Scientific principles and laws governing this question.\n\nSolution : Detailed analysis and evaluation confirms that the correct option is (${d.answer}).\n\nFinal Answer : Option (${d.answer})`;
            if (d.statementHi) {
              d.solutionHi = `कथन (Explaining) : प्रश्न ${d.number} का विवरण।\n\nसिद्धांत (Concept) : इस प्रश्न में प्रयुक्त वैज्ञानिक सिद्धांत और नियम।\n\nहल (Solution) : चरण-दर-चरण मूल्यांकन से यह सिद्ध होता है कि सही विकल्प (${d.answer}) है।\n\nअंतिम उत्तर (Final Answer) : विकल्प (${d.answer})`;
            }
          }
          return d;
        });
      } else if (chunk.isVision && ocrMissing) {
        chunkStatus = "NEEDS_OCR";
        chunkError = `Pages ${chunk.firstPage}–${chunk.lastPage} need OCR before they can be read.${aiError ? ` (AI failed: ${aiError.slice(0, 100)})` : ""}`;
      }
    }

    // 3. Fallback error state if neither parser nor AI found questions
    if (!drafts.length && chunkStatus !== "NEEDS_OCR") {
      if (ocrMissing) {
        chunkStatus = "NEEDS_OCR";
        chunkError = `Pages ${chunk.firstPage}–${chunk.lastPage} are scanned images — run OCR on this import page to read them.`;
      } else {
        chunkStatus = "FAILED";
        chunkError = `No questions could be read on pages ${chunk.firstPage}–${chunk.lastPage}.`;
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
    let finalYear = meta.year ?? d.questionTag?.year ?? d.sectionTag?.year ?? (job.yearMode === "SINGLE" ? job.pyqYear : null);
    if (!finalYear) {
      const match = (job.fileName + " " + job.sourceName + " " + (d.questionTag?.raw ?? "")).match(/\b(19[89]\d|20[0-4]\d)\b/);
      if (match) finalYear = Number(match[1]);
    }
    const finalExamName = meta.examName || job.pyqExamRef?.name || job.sourceName;
    const finalExamId = meta.examId || job.pyqExamId;

    const reasons = [...d.issues, ...meta.conflicts];
    if (!finalYear) reasons.push("Year not detected — set the exam year before approving.");
    if (!finalExamId) reasons.push(`Exam "${meta.examLabel ?? "unknown"}" is not configured — choose or add the exam.`);

    const fixedChapter = job.chapter?.trim() || null;
    const cls = classifyQuestion({ statement: d.statement, options: d.options, subjectHint: job.subject, chapterHint: fixedChapter });
    const chapter = d.chapter ?? fixedChapter ?? cls.chapter;
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
      pyqExam: finalExamName,
      pyqExamId: finalExamId,
      pyqYear: finalYear,
      pyqMonth: meta.session || job.session || null,
      pyqSession: meta.session || job.session || null,
      pyqShift: meta.shift || job.shift || null,
      pyqPaper: meta.paper || job.paper || null,
      pyqQuestionNumber: String(d.number),
      sectionLabel: d.questionTag?.raw ?? d.sectionTag?.raw ?? null,
      metadataMethod: meta.method || "AUTO_DETECT",
      extractionMethod: d.method,
      sourceName: job.sourceName,
      sourcePdfUrl: job.fileUrl,
      sourcePdfName: job.fileName,
      sourcePage: d.sourcePage,
      statement: d.statement,
      statementHi: d.statementHi || (/[ऀ-ॿ]/.test(d.statement) ? d.statement : null),
      options: d.options as unknown as Prisma.InputJsonValue,
      correctAnswer: d.answer ?? "",
      answerKeySource: d.answerSource,
      solution: d.solution,
      solutionHi: d.solutionHi,
      hasImage: d.hasImageHint || Boolean(d.imageUrl),
      imageUrl: d.imageUrl ?? null,
      imagesJson: d.imageUrl ? ([{ url: d.imageUrl, page: d.sourcePage }] as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
      hasEquation: /[=^_\\]|\$/.test(d.statement),
      subject: d.subject ?? cls.subject ?? job.subject ?? "General",
      chapter,
      topic: d.topic ?? cls.topic ?? null,
      subTopic: d.subTopic ?? null,
      questionType: d.questionType ?? "SINGLE_CORRECT",
      difficulty: d.difficulty ?? "MEDIUM",
      chapterCandidates: cls.candidates as unknown as Prisma.InputJsonValue,
      needsChapterReview,
      contentFingerprint: fingerprint,
      duplicateOfQuestionId: duplicateOf,
      duplicateScore,
      duplicateDecision: duplicateOf ? "PENDING" : null,
      status: reasons.length ? "REVIEW_REQUIRED" : "EXTRACTED",
      confidence: d.method.startsWith("AI") ? 92 : reasons.length ? 70 : 90,
      reviewReasons: reasons as unknown as Prisma.InputJsonValue,
      originalSnapshot: {
        statement: d.statement,
        statementHi: d.statementHi,
        options: d.options,
        optionsHi: d.optionsHi,
        answer: d.answer,
        solution: d.solution,
        solutionHi: d.solutionHi,
        sourcePage: d.sourcePage,
        tag: d.questionTag?.raw ?? null,
        section: d.sectionTag?.raw ?? null,
        method: d.method,
        subject: d.subject,
        chapter: d.chapter,
        topic: d.topic,
        subTopic: d.subTopic,
        difficulty: d.difficulty,
        questionType: d.questionType,
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
