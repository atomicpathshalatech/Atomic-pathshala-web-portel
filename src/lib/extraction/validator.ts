/**
 * STRICT EXTRACTION VALIDATOR & ZERO-SILENT-ERROR ENGINE
 *
 * Enforces:
 * - Expected Question Range (Start - End)
 * - Missing question identification (e.g. Q38 missing)
 * - Duplicate question identification
 * - Answer key completeness & Conflict flags
 * - Calculation of honest confidence metrics
 * - Generation of structured Extraction Reports
 */

import { ParsedQuestionBlock } from "./boundary-detector";
import { ExtractedAnswerKey, ExtractedSolution } from "./answer-key-engine";
import { detectNeetQuestionType } from "../questions/neet-question-classifier";
import { autoDetectNeetTaxonomy } from "../questions/neet-taxonomy-detector";

export interface ValidationIssue {
  type: "MISSING_QUESTION" | "DUPLICATE_QUESTION" | "ANSWER_KEY_MISMATCH" | "ANSWER_KEY_MISSING" | "LOW_CONFIDENCE" | "IMAGE_ERROR" | "TABLE_ERROR" | "OPTIONS_INCOMPLETE";
  questionNumber: number;
  severity: "ERROR" | "WARNING";
  message: string;
}

export interface ExtractionReportData {
  sourceName: string;
  fileName: string;
  expectedRange: string;
  expectedCount: number;
  extractedCount: number;
  verifiedCount: number;
  reviewCount: number;
  errorCount: number;
  missingCount: number;
  duplicateCount: number;
  answerKeyMatchedCount: number;
  solutionsMatchedCount: number;
  status: "VERIFIED" | "REVIEW_REQUIRED" | "EXTRACTION_ERROR";
  issues: ValidationIssue[];
}

export interface ValidatedQuestionRecord {
  originalNumber: number;
  questionIndex: number;
  sourceName: string;
  sourcePdfUrl: string;
  sourcePdfName: string;
  sourcePage: number;
  statement: string;
  statementHi?: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: "A" | "B" | "C" | "D";
  answerKeySource: string;
  solution?: string;
  hasTable: boolean;
  hasImage: boolean;
  hasEquation: boolean;
  subject: string;
  chapter?: string;
  topic?: string;
  subTopic?: string;
  questionType: string;
  difficulty: "EASY" | "MEDIUM" | "HARD" | "VERY_HARD";
  status: "VERIFIED" | "REVIEW_REQUIRED" | "EXTRACTION_ERROR" | "MISSING" | "DUPLICATE";
  confidence: number;
  confidenceBreakdown: {
    text: number;
    options: number;
    table: number;
    image: number;
    answer: number;
    solution: number;
    overall: number;
  };
  reviewReasons: string[];
  originalSnapshot: any;
}

export function validateAndClassifyQuestions(
  rawQuestions: ParsedQuestionBlock[],
  answersMap: Map<number, ExtractedAnswerKey>,
  solutionsMap: Map<number, ExtractedSolution>,
  config: {
    sourceName: string;
    fileName: string;
    fileUrl: string;
    startNumber: number;
    endNumber: number;
    defaultSubject?: string;
    defaultChapter?: string;
  }
): {
  validatedQuestions: ValidatedQuestionRecord[];
  report: ExtractionReportData;
} {
  const expectedCount = Math.max(1, config.endNumber - config.startNumber + 1);
  const issues: ValidationIssue[] = [];
  const validatedQuestions: ValidatedQuestionRecord[] = [];

  // Track seen numbers to detect duplicates and missing
  const seenNumbers = new Map<number, number>(); // qNum -> count
  const questionByNumber = new Map<number, ParsedQuestionBlock[]>();

  for (const q of rawQuestions) {
    seenNumbers.set(q.originalNumber, (seenNumbers.get(q.originalNumber) || 0) + 1);
    const list = questionByNumber.get(q.originalNumber) || [];
    list.push(q);
    questionByNumber.set(q.originalNumber, list);
  }

  // 1. Missing Questions Detection
  const missingNumbers: number[] = [];
  for (let num = config.startNumber; num <= config.endNumber; num++) {
    if (!seenNumbers.has(num)) {
      missingNumbers.push(num);
      issues.push({
        type: "MISSING_QUESTION",
        questionNumber: num,
        severity: "ERROR",
        message: `Question Q.${num} could not be detected in the document stream. Please verify the source PDF.`,
      });
    }
  }

  // 2. Duplicate Questions Detection
  for (const [num, count] of Array.from(seenNumbers.entries())) {
    if (count > 1) {
      issues.push({
        type: "DUPLICATE_QUESTION",
        questionNumber: num,
        severity: "WARNING",
        message: `Question Q.${num} was extracted ${count} times. Manual deduplication recommended.`,
      });
    }
  }

  // 3. Process and Enrich each extracted question
  let idx = 1;
  let answerKeyMatchedCount = 0;
  let solutionsMatchedCount = 0;

  for (let num = config.startNumber; num <= config.endNumber; num++) {
    const blocks = questionByNumber.get(num);

    if (!blocks || blocks.length === 0) {
      // Create a dummy placeholder for missing question so it's visibly displayed in report & UI
      validatedQuestions.push({
        originalNumber: num,
        questionIndex: idx++,
        sourceName: config.sourceName,
        sourcePdfUrl: config.fileUrl,
        sourcePdfName: config.fileName,
        sourcePage: 1,
        statement: `[MISSING QUESTION Q.${num}] Question was expected in range (${config.startNumber}-${config.endNumber}) but could not be extracted automatically.`,
        options: { A: "", B: "", C: "", D: "" },
        correctAnswer: "A",
        answerKeySource: "NONE",
        hasTable: false,
        hasImage: false,
        hasEquation: false,
        subject: config.defaultSubject || "General",
        questionType: "SINGLE_CORRECT",
        difficulty: "MEDIUM",
        status: "MISSING",
        confidence: 0,
        confidenceBreakdown: { text: 0, options: 0, table: 0, image: 0, answer: 0, solution: 0, overall: 0 },
        reviewReasons: [`Question Q.${num} is missing from extracted PDF stream.`],
        originalSnapshot: { missing: true, originalNumber: num },
      });
      continue;
    }

    for (const block of blocks) {
      const reviewReasons = [...block.reviewReasons];
      let status: "VERIFIED" | "REVIEW_REQUIRED" | "EXTRACTION_ERROR" | "DUPLICATE" = "VERIFIED";

      if (seenNumbers.get(num)! > 1) {
        status = "DUPLICATE";
        reviewReasons.push(`Duplicate occurrence of Q.${num}`);
      }

      // Map Answer Key
      let answer: "A" | "B" | "C" | "D" = "A";
      let answerKeySource = "INFERRED";
      const answerKeyItem = answersMap.get(num);

      if (answerKeyItem) {
        answer = answerKeyItem.answer;
        answerKeySource = "ANSWER_KEY_SECTION";
        answerKeyMatchedCount++;
      } else {
        reviewReasons.push(`Answer key missing for Q.${num}. Please verify.`);
        issues.push({
          type: "ANSWER_KEY_MISSING",
          questionNumber: num,
          severity: "WARNING",
          message: `Answer key not found in document for Q.${num}`,
        });
        if (status === "VERIFIED") status = "REVIEW_REQUIRED";
      }

      // Map Solution & Check Conflict
      const solItem = solutionsMap.get(num);
      let solutionText = "";
      if (solItem) {
        solutionText = solItem.solutionText;
        solutionsMatchedCount++;

        if (answerKeyItem && solItem.inferredAnswer && solItem.inferredAnswer !== answerKeyItem.answer) {
          reviewReasons.push(
            `Answer-Solution Conflict: Answer key says (${answerKeyItem.answer}) but solution concludes (${solItem.inferredAnswer}).`
          );
          issues.push({
            type: "ANSWER_KEY_MISMATCH",
            questionNumber: num,
            severity: "ERROR",
            message: `Conflict in Q.${num}: Key=(${answerKeyItem.answer}) vs Solution=(${solItem.inferredAnswer})`,
          });
          status = "REVIEW_REQUIRED";
        }
      }

      // 18 NEET Question Types Auto-Classification
      const neetClassification = detectNeetQuestionType(
        block.statement,
        block.options,
        block.hasImage
      );

      // Automatic NEET Taxonomy (Subject, Chapter, Topic, Sub-Topic, Level of Question / Difficulty)
      const taxonomy = autoDetectNeetTaxonomy(
        block.statement,
        block.options,
        config.defaultSubject
      );

      const subject = config.defaultSubject && config.defaultSubject !== "Auto Detect" && config.defaultSubject !== "General"
        ? config.defaultSubject
        : taxonomy.subject;
      const chapter = config.defaultChapter || taxonomy.chapter;
      const topic = taxonomy.topic;
      const subTopic = taxonomy.subTopic;
      const difficulty = taxonomy.difficulty;

      // Check for low confidence or formatting issues
      if (block.confidence.overall < 88) {
        if (status === "VERIFIED") status = "REVIEW_REQUIRED";
        issues.push({
          type: "LOW_CONFIDENCE",
          questionNumber: num,
          severity: "WARNING",
          message: `Low OCR extraction confidence (${block.confidence.overall}%) on Q.${num}`,
        });
      }

      if (block.reviewReasons.length > 0 && status === "VERIFIED") {
        status = "REVIEW_REQUIRED";
      }

      const confBreakdown = {
        text: block.confidence.text,
        options: block.confidence.options,
        table: block.confidence.table,
        image: block.confidence.image,
        answer: answerKeyItem ? 100 : 70,
        solution: solItem ? 99 : 70,
        overall: block.confidence.overall,
      };

      const record: ValidatedQuestionRecord = {
        originalNumber: num,
        questionIndex: idx++,
        sourceName: config.sourceName,
        sourcePdfUrl: config.fileUrl,
        sourcePdfName: config.fileName,
        sourcePage: block.sourcePage,
        statement: block.statement,
        statementHi: block.statementHi,
        options: block.options,
        correctAnswer: answer,
        answerKeySource,
        solution: solutionText || undefined,
        hasTable: block.hasTable,
        hasImage: block.hasImage,
        hasEquation: block.hasEquation,
        subject,
        chapter: chapter || undefined,
        topic: topic || undefined,
        subTopic: subTopic || undefined,
        questionType: neetClassification.detectedType,
        difficulty,
        status,
        confidence: block.confidence.overall,
        confidenceBreakdown: confBreakdown,
        reviewReasons,
        originalSnapshot: {
          statement: block.statement,
          options: block.options,
          correctAnswer: answer,
          solution: solutionText,
          confidence: confBreakdown,
        },
      };

      validatedQuestions.push(record);
    }
  }

  // Calculate final tallies
  const verifiedCount = validatedQuestions.filter((q) => q.status === "VERIFIED").length;
  const reviewCount = validatedQuestions.filter((q) => q.status === "REVIEW_REQUIRED").length;
  const errorCount = validatedQuestions.filter((q) => q.status === "EXTRACTION_ERROR").length;
  const missingCount = missingNumbers.length;
  const duplicateCount = validatedQuestions.filter((q) => q.status === "DUPLICATE").length;

  let overallStatus: "VERIFIED" | "REVIEW_REQUIRED" | "EXTRACTION_ERROR" = "VERIFIED";
  if (missingCount > 0 || errorCount > 0) {
    overallStatus = "EXTRACTION_ERROR";
  } else if (reviewCount > 0 || duplicateCount > 0) {
    overallStatus = "REVIEW_REQUIRED";
  }

  const report: ExtractionReportData = {
    sourceName: config.sourceName,
    fileName: config.fileName,
    expectedRange: `${config.startNumber}–${config.endNumber}`,
    expectedCount,
    extractedCount: rawQuestions.length,
    verifiedCount,
    reviewCount,
    errorCount,
    missingCount,
    duplicateCount,
    answerKeyMatchedCount,
    solutionsMatchedCount,
    status: overallStatus,
    issues,
  };

  return {
    validatedQuestions,
    report,
  };
}
