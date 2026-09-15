import { prisma } from "@/lib/db";
import {
  NCERTLanguage,
  NcertPageQuestion,
  NCERTVerificationStatus,
  NCERTPageProgressStatus,
  QuestionType,
  Difficulty,
} from "@prisma/client";
import { generatePageQuestions, type CandidateNcertQuestion } from "./ai-generator";
import { validateNcertQuestion } from "./question-validator";
import { generateQuestionId } from "@/lib/questions/id-generator";
import { resolveUserId } from "@/lib/ai-chat/atomicGuruPipeline";

export const MAX_REATTEMPTS_PER_PAGE = 3; // Initial attempt (Set 1) + 3 reattempts (Set 2, 3, 4) = max 4 sets

export interface ClientQuestionView {
  id: string;
  questionType: string;
  question: string;
  options: { id: "A" | "B" | "C" | "D"; text: string }[];
  sourceImageReference?: string | null;

  // Atomic Guru structured components
  assertionText?: string;
  reasonText?: string;
  statements?: string[];
  columnI?: { label: string; text: string }[];
  columnII?: { label: string; text: string }[];
  columnIII?: { label: string; text: string }[];
  sequenceItems?: { label: string; text: string }[];
  tableHeaders?: string[];
  tableRows?: string[][];
  passage?: string;
  imageRequired?: boolean;
  imageDescription?: string;
}

export interface StudentSubmissionAnswer {
  questionId: string;
  selectedOption: string; // "A" | "B" | "C" | "D" | ""
}

export interface QuestionGradingReview {
  id: string;
  questionType?: string;
  question: string;
  options: { id: "A" | "B" | "C" | "D"; text: string }[];
  selectedOption: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation: string;
  sourceTextReference: string;
  sourceImageReference?: string | null;

  // Atomic Guru structured components
  assertionText?: string;
  reasonText?: string;
  statements?: string[];
  columnI?: { label: string; text: string }[];
  columnII?: { label: string; text: string }[];
  columnIII?: { label: string; text: string }[];
  sequenceItems?: { label: string; text: string }[];
  tableHeaders?: string[];
  tableRows?: string[][];
  passage?: string;
  imageRequired?: boolean;
  imageDescription?: string;

  // 4-Part Structured Solution
  explainQuestion?: string;
  concept?: string;
  solution?: string;
  finalAnswer?: string;
}

export interface StructuredQuestionData {
  choices: { id: "A" | "B" | "C" | "D"; text: string }[];
  assertionText?: string;
  reasonText?: string;
  statements?: string[];
  columnI?: { label: string; text: string }[];
  columnII?: { label: string; text: string }[];
  columnIII?: { label: string; text: string }[];
  sequenceItems?: { label: string; text: string }[];
  tableHeaders?: string[];
  tableRows?: string[][];
  passage?: string;
  imageRequired?: boolean;
  imageDescription?: string;
  explainQuestion?: string;
  concept?: string;
  solution?: string;
  finalAnswer?: string;
}

/**
 * Safely extracts rich Atomic Guru structured elements from NcertPageQuestion.options JSON
 * with complete backward compatibility for legacy flat arrays.
 */
export function extractStructuredQuestionData(optionsJson: any): StructuredQuestionData {
  if (Array.isArray(optionsJson)) {
    return { choices: optionsJson };
  }
  if (optionsJson && typeof optionsJson === "object") {
    const choices = Array.isArray(optionsJson.choices) ? optionsJson.choices : [];
    return {
      choices,
      assertionText: optionsJson.assertionText || undefined,
      reasonText: optionsJson.reasonText || undefined,
      statements: Array.isArray(optionsJson.statements) ? optionsJson.statements : undefined,
      columnI: Array.isArray(optionsJson.columnI) ? optionsJson.columnI : undefined,
      columnII: Array.isArray(optionsJson.columnII) ? optionsJson.columnII : undefined,
      columnIII: Array.isArray(optionsJson.columnIII) ? optionsJson.columnIII : undefined,
      sequenceItems: Array.isArray(optionsJson.sequenceItems) ? optionsJson.sequenceItems : undefined,
      tableHeaders: Array.isArray(optionsJson.tableHeaders) ? optionsJson.tableHeaders : undefined,
      tableRows: Array.isArray(optionsJson.tableRows) ? optionsJson.tableRows : undefined,
      passage: optionsJson.passage || undefined,
      imageRequired: Boolean(optionsJson.imageRequired),
      imageDescription: optionsJson.imageDescription || undefined,
      explainQuestion: optionsJson.explainQuestion || undefined,
      concept: optionsJson.concept || undefined,
      solution: optionsJson.solution || undefined,
      finalAnswer: optionsJson.finalAnswer || undefined,
    };
  }
  return { choices: [] };
}

/**
 * Streams verified NCERT page questions directly into the central Question Bank (prisma.question & translations)
 * using the exact same schema and architecture as Atomic Guru.
 * Guaranteed duplicate prevention via statement check.
 */
export async function streamNcertQuestionsToQuestionBank({
  document,
  pageNumber,
  questions,
  userId,
}: {
  document: {
    academicChapter?: { title: string } | null;
    academicSubject?: { name: string } | null;
    academicClass?: { name: string } | null;
    language: NCERTLanguage;
  };
  pageNumber: number;
  questions: CandidateNcertQuestion[];
  userId?: string | null;
}): Promise<number> {
  const subjectName = document.academicSubject?.name || "General";
  const chapterTitle = document.academicChapter?.title || "NCERT Practice";
  const className = document.academicClass?.name || "";
  const isHindi = document.language === NCERTLanguage.HINDI;

  const safeUserId = (await resolveUserId(userId)) || (await prisma.user.findFirst({ select: { id: true } }))?.id;
  if (!safeUserId) return 0;

  let savedCount = 0;

  for (const q of questions) {
    try {
      const trimmedStatement = q.question.trim();
      if (!trimmedStatement) continue;

      // Duplicate prevention: check if translation already exists with identical text
      const existingTranslation = await prisma.questionTranslation.findFirst({
        where: {
          statement: trimmedStatement,
          language: isHindi ? "HINDI" : "ENGLISH",
        },
        select: { id: true },
      });

      if (existingTranslation) {
        continue;
      }

      const code = await generateQuestionId(prisma, subjectName);
      const correctLetter = q.correctAnswer;
      const optionsMap: Record<string, string> = {
        A: q.options.find((o) => o.id === "A")?.text || "",
        B: q.options.find((o) => o.id === "B")?.text || "",
        C: q.options.find((o) => o.id === "C")?.text || "",
        D: q.options.find((o) => o.id === "D")?.text || "",
      };

      const structuredSolution = q.solution || q.explanation || "";

      let pType: QuestionType = QuestionType.SINGLE_CORRECT;
      const typeStr = String(q.questionType).toUpperCase();
      if (typeStr.includes("ASSERTION")) pType = QuestionType.ASSERTION_REASON;
      else if (typeStr.includes("STATEMENT")) pType = QuestionType.STATEMENT_BASED;
      else if (typeStr.includes("MATCH")) pType = QuestionType.MATCH_COLUMN;

      await prisma.question.create({
        data: {
          questionCode: code,
          subject: subjectName,
          chapter: chapterTitle,
          topic: `NCERT Page ${pageNumber}`,
          type: pType,
          difficulty: Difficulty.MEDIUM,
          category: "NCERT_HUB",
          status: "DRAFT",
          solution: structuredSolution,
          tags: `NCERT_HUB, CLASS_${className.replace(/\s+/g, "_")}, CHAPTER_${chapterTitle.replace(/\s+/g, "_")}, PAGE_${pageNumber}`,
          ncertBook: subjectName,
          ncertClass: className,
          ncertChapter: chapterTitle,
          ncertPage: String(pageNumber),
          createdById: safeUserId,
          translations: {
            create: [
              {
                language: isHindi ? "HINDI" : "ENGLISH",
                statement: trimmedStatement,
                options: optionsMap,
                correctOptionIds: [correctLetter],
                solution: structuredSolution,
              },
            ],
          },
          versions: {
            create: {
              versionNumber: 1,
              editedById: safeUserId,
              changeType: "CREATE",
              snapshot: {
                statement: trimmedStatement,
                options: optionsMap,
                correctOption: correctLetter,
                explainQuestion: q.explainQuestion,
                concept: q.concept,
                solution: structuredSolution,
                finalAnswer: q.finalAnswer,
                subject: subjectName,
                chapter: chapterTitle,
                pageNumber,
                sourceTextReference: q.sourceTextReference,
                sourceModule: "NCERT_HUB",
                extras: {
                  assertionText: q.assertionText,
                  reasonText: q.reasonText,
                  statements: q.statements,
                  columnI: q.columnI,
                  columnII: q.columnII,
                },
              },
            },
          },
        },
      });

      savedCount++;
    } catch (err) {
      console.warn("[NCERT Question Bank Stream] Failed to stream question:", err);
    }
  }

  return savedCount;
}

export interface SubmissionEvaluationResult {
  score: number;
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  unattemptedCount: number;
  accuracy: number;
  attemptNumber: number;
  canReattempt: boolean;
  remainingReattempts: number;
  reviews: QuestionGradingReview[];
}

/**
 * Retrieves existing verified questions for a page and poolSet, or generates and validates new ones.
 * Guaranteed to NEVER fabricate questions.
 */
export async function getOrGeneratePageQuestionPool(
  pageId: string,
  poolSet: number = 1
): Promise<NcertPageQuestion[]> {
  // 1. Check existing questions in DB
  const existing = await prisma.ncertPageQuestion.findMany({
    where: {
      pageId,
      poolSet,
      verificationStatus: NCERTVerificationStatus.APPROVED,
    },
    orderBy: { createdAt: "asc" },
  });

  if (existing.length > 0) {
    return existing;
  }

  // 2. Fetch page and metadata
  const page = await prisma.ncertPage.findUnique({
    where: { id: pageId },
    include: {
      document: {
        include: {
          academicChapter: true,
          academicSubject: true,
          academicClass: true,
        },
      },
    },
  });

  if (!page || !page.extractedText) {
    return [];
  }

  // Collect all already used questions on this page to avoid repeating
  const allExistingOnPage = await prisma.ncertPageQuestion.findMany({
    where: { pageId },
    select: { question: true },
  });
  const excludeQuestionTexts = allExistingOnPage.map((q) => q.question);

  // 3. Generate candidate questions via strict page-locked AI
  const candidates = await generatePageQuestions({
    pageNumber: page.pageNumber,
    chapterTitle: page.document.academicChapter.title,
    subjectName: page.document.academicSubject.name,
    className: page.document.academicClass.name,
    language: page.document.language,
    pageText: page.extractedText,
    pageImageUrl: page.pageImageUrl,
    targetCount: 5,
    excludeQuestions: excludeQuestionTexts,
  });

  // 4. Validate candidates
  const approvedRows: any[] = [];
  const approvedCandidates: CandidateNcertQuestion[] = [];
  const currentBatchTexts: string[] = [...excludeQuestionTexts];

  for (const candidate of candidates) {
    const validation = validateNcertQuestion(
      candidate,
      page.extractedText,
      page.document.language,
      currentBatchTexts
    );

    if (validation.isValid) {
      currentBatchTexts.push(candidate.question);
      approvedCandidates.push(candidate);
      approvedRows.push({
        pageId: page.id,
        documentId: page.documentId,
        chapterId: page.document.academicChapterId,
        pageNumber: page.pageNumber,
        language: page.document.language,
        questionType: candidate.questionType,
        question: candidate.question,
        options: {
          choices: candidate.options,
          assertionText: candidate.assertionText,
          reasonText: candidate.reasonText,
          statements: candidate.statements,
          columnI: candidate.columnI,
          columnII: candidate.columnII,
          columnIII: candidate.columnIII,
          sequenceItems: candidate.sequenceItems,
          tableHeaders: candidate.tableHeaders,
          tableRows: candidate.tableRows,
          passage: candidate.passage,
          imageRequired: candidate.imageRequired,
          imageDescription: candidate.imageDescription,
          explainQuestion: candidate.explainQuestion,
          concept: candidate.concept,
          solution: candidate.solution,
          finalAnswer: candidate.finalAnswer,
        },
        correctAnswer: candidate.correctAnswer,
        explanation: candidate.explanation,
        sourceTextReference: candidate.sourceTextReference,
        sourceImageReference: candidate.sourceImageReference,
        verificationStatus: NCERTVerificationStatus.APPROVED,
        poolSet,
      });
    }
  }

  if (approvedRows.length === 0) {
    return [];
  }

  // 5. Store in DB
  await prisma.ncertPageQuestion.createMany({
    data: approvedRows,
  });

  // 6. Automatically stream verified NCERT questions to central Question Bank
  await streamNcertQuestionsToQuestionBank({
    document: page.document,
    pageNumber: page.pageNumber,
    questions: approvedCandidates,
  }).catch((err) => {
    console.warn("[NCERT Question Pool] Background Question Bank stream error:", err);
  });

  return prisma.ncertPageQuestion.findMany({
    where: { pageId, poolSet, verificationStatus: NCERTVerificationStatus.APPROVED },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Strips correct answers and explanations before sending to client prior to submission.
 */
export function sanitizeQuestionsForClient(questions: NcertPageQuestion[]): ClientQuestionView[] {
  return questions.map((q) => {
    const structured = extractStructuredQuestionData(q.options);
    return {
      id: q.id,
      questionType: q.questionType,
      question: q.question,
      options: structured.choices.length > 0 ? structured.choices : (q.options as any),
      sourceImageReference: q.sourceImageReference,
      assertionText: structured.assertionText,
      reasonText: structured.reasonText,
      statements: structured.statements,
      columnI: structured.columnI,
      columnII: structured.columnII,
      columnIII: structured.columnIII,
      sequenceItems: structured.sequenceItems,
      tableHeaders: structured.tableHeaders,
      tableRows: structured.tableRows,
      passage: structured.passage,
      imageRequired: structured.imageRequired,
      imageDescription: structured.imageDescription,
    };
  });
}

/**
 * Evaluates student answers server-side, updates progress, and saves the attempt record.
 */
export async function evaluateStudentSubmission(params: {
  studentId: string;
  documentId: string;
  pageId: string;
  answers: StudentSubmissionAnswer[];
}): Promise<SubmissionEvaluationResult> {
  const { studentId, documentId, pageId, answers } = params;

  // Fetch page and current page progress
  const page = await prisma.ncertPage.findUnique({
    where: { id: pageId },
    include: { document: true },
  });

  if (!page) {
    throw new Error("NCERT page not found");
  }

  // Get or initialize page progress
  let pageProgress = await prisma.ncertStudentPageProgress.findUnique({
    where: {
      studentId_pageId: {
        studentId,
        pageId,
      },
    },
  });

  if (!pageProgress) {
    pageProgress = await prisma.ncertStudentPageProgress.create({
      data: {
        studentId,
        documentId,
        chapterId: page.document.academicChapterId,
        pageId,
        pageNumber: page.pageNumber,
        language: page.document.language,
        status: NCERTPageProgressStatus.IN_PROGRESS,
        attemptCount: 1,
      },
    });
  }

  const currentAttemptNumber = Math.min(pageProgress.attemptCount || 1, 4);

  // Fetch verified questions for the questions submitted
  const questionIds = answers.map((a) => a.questionId);
  const questions = await prisma.ncertPageQuestion.findMany({
    where: {
      id: { in: questionIds },
      pageId,
    },
  });

  const questionMap = new Map(questions.map((q) => [q.id, q]));

  let correctCount = 0;
  let incorrectCount = 0;
  let unattemptedCount = 0;
  const answerDetails: any[] = [];
  const reviews: QuestionGradingReview[] = [];

  for (const item of answers) {
    const q = questionMap.get(item.questionId);
    if (!q) continue;

    const selected = (item.selectedOption || "").trim().toUpperCase();
    const isAnswered = ["A", "B", "C", "D"].includes(selected);
    const isCorrect = isAnswered && selected === q.correctAnswer;

    if (!isAnswered) {
      unattemptedCount++;
    } else if (isCorrect) {
      correctCount++;
    } else {
      incorrectCount++;
    }

    answerDetails.push({
      questionId: q.id,
      selectedOption: selected,
      isCorrect,
    });

    const structured = extractStructuredQuestionData(q.options);

    reviews.push({
      id: q.id,
      questionType: q.questionType,
      question: q.question,
      options: structured.choices.length > 0 ? structured.choices : (q.options as any),
      selectedOption: selected,
      correctAnswer: q.correctAnswer,
      isCorrect,
      explanation: q.explanation,
      sourceTextReference: q.sourceTextReference,
      sourceImageReference: q.sourceImageReference,
      assertionText: structured.assertionText,
      reasonText: structured.reasonText,
      statements: structured.statements,
      columnI: structured.columnI,
      columnII: structured.columnII,
      columnIII: structured.columnIII,
      sequenceItems: structured.sequenceItems,
      tableHeaders: structured.tableHeaders,
      tableRows: structured.tableRows,
      passage: structured.passage,
      imageRequired: structured.imageRequired,
      imageDescription: structured.imageDescription,
      explainQuestion: structured.explainQuestion,
      concept: structured.concept,
      solution: structured.solution || q.explanation,
      finalAnswer: structured.finalAnswer,
    });
  }

  const totalQuestions = questions.length;
  // NEET marking scheme: +4 for correct, -1 for incorrect, 0 for unattempted
  const score = Math.max(0, correctCount * 4 - incorrectCount * 1);
  const accuracy = totalQuestions > 0 ? Number(((correctCount / totalQuestions) * 100).toFixed(1)) : 0;

  // Record attempt
  await prisma.ncertStudentAttempt.create({
    data: {
      studentId,
      pageId,
      pageProgressId: pageProgress.id,
      attemptNumber: currentAttemptNumber,
      questionIds,
      answers: answerDetails,
      score,
      totalQuestions,
      correctCount,
      accuracy,
    },
  });

  // Update page progress
  await prisma.ncertStudentPageProgress.update({
    where: { id: pageProgress.id },
    data: {
      status: NCERTPageProgressStatus.COMPLETED,
      questionsAttempted: totalQuestions,
      correctAnswers: correctCount,
      incorrectAnswers: incorrectCount,
      score,
      accuracy,
      completedAt: new Date(),
    },
  });

  // Update chapter progress
  await updateChapterProgressSummary(studentId, documentId);

  const remainingReattempts = Math.max(0, MAX_REATTEMPTS_PER_PAGE - (currentAttemptNumber - 1));
  const canReattempt = remainingReattempts > 0;

  return {
    score,
    totalQuestions,
    correctCount,
    incorrectCount,
    unattemptedCount,
    accuracy,
    attemptNumber: currentAttemptNumber,
    canReattempt,
    remainingReattempts,
    reviews,
  };
}

/**
 * Marks page as SKIPPED, zero AI requests made.
 */
export async function recordPageSkip(params: {
  studentId: string;
  documentId: string;
  pageId: string;
}): Promise<{ nextPageIndex: number; totalPages: number }> {
  const { studentId, documentId, pageId } = params;

  const page = await prisma.ncertPage.findUnique({
    where: { id: pageId },
    include: { document: true },
  });

  if (!page) {
    throw new Error("NCERT page not found");
  }

  await prisma.ncertStudentPageProgress.upsert({
    where: {
      studentId_pageId: {
        studentId,
        pageId,
      },
    },
    update: {
      status: NCERTPageProgressStatus.SKIPPED,
      skippedAt: new Date(),
    },
    create: {
      studentId,
      documentId,
      chapterId: page.document.academicChapterId,
      pageId,
      pageNumber: page.pageNumber,
      language: page.document.language,
      status: NCERTPageProgressStatus.SKIPPED,
      skippedAt: new Date(),
    },
  });

  await updateChapterProgressSummary(studentId, documentId);

  return {
    nextPageIndex: page.pageNumber + 1,
    totalPages: page.document.totalPages,
  };
}

/**
 * Handles REATTEMPT NEW QUESTION with strict 3-reattempt limit enforcement.
 */
export async function preparePageReattempt(params: {
  studentId: string;
  documentId: string;
  pageId: string;
}): Promise<{ questions: ClientQuestionView[]; attemptNumber: number; remainingReattempts: number }> {
  const { studentId, documentId, pageId } = params;

  let pageProgress = await prisma.ncertStudentPageProgress.findUnique({
    where: { studentId_pageId: { studentId, pageId } },
  });

  if (!pageProgress) {
    throw new Error("Must complete initial attempt before requesting reattempt");
  }

  const currentAttempts = pageProgress.attemptCount || 1;
  if (currentAttempts >= 1 + MAX_REATTEMPTS_PER_PAGE) {
    throw new Error(`Maximum of ${MAX_REATTEMPTS_PER_PAGE} reattempts reached for this page.`);
  }

  const nextAttemptNumber = currentAttempts + 1;
  const poolSet = nextAttemptNumber;

  // Increment attempt count on progress
  await prisma.ncertStudentPageProgress.update({
    where: { id: pageProgress.id },
    data: {
      attemptCount: nextAttemptNumber,
      status: NCERTPageProgressStatus.IN_PROGRESS,
    },
  });

  // Get or generate next set from same page
  const questions = await getOrGeneratePageQuestionPool(pageId, poolSet);
  const remaining = Math.max(0, 1 + MAX_REATTEMPTS_PER_PAGE - nextAttemptNumber);

  return {
    questions: sanitizeQuestionsForClient(questions),
    attemptNumber: nextAttemptNumber,
    remainingReattempts: remaining,
  };
}

/**
 * Recalculates chapter-level progress from all page progress rows for this student and document.
 */
export async function updateChapterProgressSummary(studentId: string, documentId: string) {
  const [doc, pageProgressList] = await Promise.all([
    prisma.ncertDocument.findUnique({ where: { id: documentId } }),
    prisma.ncertStudentPageProgress.findMany({
      where: { studentId, documentId },
    }),
  ]);

  if (!doc) return;

  const completedPages = pageProgressList.filter((p) => p.status === NCERTPageProgressStatus.COMPLETED);
  const skippedPages = pageProgressList.filter((p) => p.status === NCERTPageProgressStatus.SKIPPED);

  let totalQuestions = 0;
  let totalCorrect = 0;
  let totalIncorrect = 0;

  for (const cp of completedPages) {
    totalQuestions += cp.questionsAttempted;
    totalCorrect += cp.correctAnswers;
    totalIncorrect += cp.incorrectAnswers;
  }

  const overallAccuracy = totalQuestions > 0 ? Number(((totalCorrect / totalQuestions) * 100).toFixed(1)) : 0;
  const isFullyComplete = doc.totalPages > 0 && completedPages.length + skippedPages.length >= doc.totalPages;

  await prisma.ncertStudentChapterProgress.upsert({
    where: {
      studentId_documentId: {
        studentId,
        documentId,
      },
    },
    update: {
      pagesCompleted: completedPages.length,
      pagesSkipped: skippedPages.length,
      totalQuestionsAttempted: totalQuestions,
      totalCorrect,
      totalIncorrect,
      accuracy: overallAccuracy,
      status: isFullyComplete ? "COMPLETED" : "IN_PROGRESS",
      completedAt: isFullyComplete ? new Date() : null,
      lastActiveAt: new Date(),
    },
    create: {
      studentId,
      documentId,
      chapterId: doc.academicChapterId,
      language: doc.language,
      pagesCompleted: completedPages.length,
      pagesSkipped: skippedPages.length,
      totalQuestionsAttempted: totalQuestions,
      totalCorrect,
      totalIncorrect,
      accuracy: overallAccuracy,
      status: isFullyComplete ? "COMPLETED" : "IN_PROGRESS",
      completedAt: isFullyComplete ? new Date() : null,
      startedAt: new Date(),
      lastActiveAt: new Date(),
    },
  });
}
