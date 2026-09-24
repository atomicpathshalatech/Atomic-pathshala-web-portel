import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import {
  cleanDocumentArtifacts,
  extractTextFromPdfBuffer,
  extractQuestionsWithAiChunk,
} from "@/lib/extraction/pdf-extractor";
import { detectQuestionBlocks } from "@/lib/extraction/boundary-detector";
import { extractAnswerKey, extractSolutions } from "@/lib/extraction/answer-key-engine";
import { validateAndClassifyQuestions } from "@/lib/extraction/validator";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();
    await requirePermission(session.user.id, PERMISSIONS.QUESTION_CREATE);

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const sourceName = (formData.get("sourceName") as string)?.trim();
    const startNumber = Math.max(1, parseInt((formData.get("startNumber") as string) || "1", 10));
    const endNumber = Math.max(startNumber, parseInt((formData.get("endNumber") as string) || "180", 10));
    const examName = (formData.get("examName") as string)?.trim() || null;
    const year = (formData.get("year") as string)?.trim() || null;
    const pyqExam = (formData.get("pyqExam") as string)?.trim() || null;
    const pyqYearRaw = formData.get("pyqYear") as string | null;
    const pyqYear = pyqYearRaw ? parseInt(pyqYearRaw, 10) || (year ? parseInt(year, 10) || null : null) : (year ? parseInt(year, 10) || null : null);
    const pyqMonth = (formData.get("pyqMonth") as string)?.trim() || null;
    const subject = (formData.get("subject") as string)?.trim() || "Auto Detect";
    const chapter = (formData.get("chapter") as string)?.trim() || null;
    const rawPastedText = (formData.get("rawText") as string)?.trim();

    if (!sourceName) {
      return apiError("Source Name (e.g. ALLEN, RACE, NCERT) is required.", 400);
    }

    if (!file && !rawPastedText) {
      return apiError("Please upload a PDF file or provide extracted document text.", 400);
    }

    const fileName = file ? file.name : `${sourceName}_Document.pdf`;
    const fileSize = file ? file.size : (rawPastedText?.length || 0);
    const expectedCount = endNumber - startNumber + 1;
    const effectiveSourceName = sourceName || "Exam Document";

    // 1. Create Extraction Job in PENDING status
    const job = await prisma.extractionJob.create({
      data: {
        sourceName,
        fileName,
        fileUrl: `/uploads/extraction/${fileName}`,
        fileSize,
        startNumber,
        endNumber,
        expectedCount,
        status: "PROCESSING",
        progress: 15,
        currentStep: "Parsing Document Stream...",
        examName,
        year: year || (pyqYear ? String(pyqYear) : null),
        pyqExam,
        pyqYear,
        pyqMonth,
        subject: subject !== "Auto Detect" ? subject : null,
        chapter,
        createdById: session.user.id,
      },
    });

    // 2. Extract Document Content
    let docText = "";
    let pageCount = 1;
    let fileUrl = `/uploads/extraction/${fileName}`;

    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const pdfResult = await extractTextFromPdfBuffer(buffer);
      docText = pdfResult.fullText;
      pageCount = pdfResult.pageCount || 1;

      // If PDF text is still too sparse, check if user supplied raw text
      if (docText.trim().length < 50 && rawPastedText?.trim()) {
        docText = rawPastedText.trim();
      }
    } else {
      docText = rawPastedText || "";
    }

    const cleanedText = cleanDocumentArtifacts(docText);

    let extractedList: any[] = [];
    let isAiProcessed = false;

    // 3. Attempt Gemini AI High-Precision Extraction with Auto-Bilingual & 4-Step Solution
    if (cleanedText.trim().length >= 30) {
      try {
        const aiQuestions = await extractQuestionsWithAiChunk({
          textChunk: cleanedText.slice(0, 45000), // process document
          startNumber,
          endNumber,
          subjectContext: subject !== "Auto Detect" ? subject : undefined,
          chapterContext: chapter || undefined,
          sourceName: effectiveSourceName,
        });

        if (aiQuestions && aiQuestions.length > 0) {
          extractedList = aiQuestions;
          isAiProcessed = true;
        }
      } catch (aiErr) {
        console.warn("[Upload Extraction Route] AI extraction fallback to regex boundary parser:", aiErr);
      }
    }

    // 4. Fallback to Local Boundary Regex Engine if AI didn't run or returned 0 questions
    let finalQuestionsToSave: any[] = [];
    let finalReport: any = null;

    if (isAiProcessed && extractedList.length > 0) {
      const verified = extractedList.filter((q) => q.status === "VERIFIED").length;
      const reviewReq = extractedList.filter((q) => q.status === "REVIEW_REQUIRED").length;
      const errors = extractedList.filter((q) => q.status === "EXTRACTION_ERROR").length;
      const missing = Math.max(0, expectedCount - extractedList.length);

      const issues: any[] = [];
      extractedList.forEach((q) => {
        if (q.reviewReasons && q.reviewReasons.length > 0) {
          issues.push({
            questionNumber: q.originalNumber,
            severity: q.status === "EXTRACTION_ERROR" ? "ERROR" : "WARNING",
            message: q.reviewReasons.join(" • "),
          });
        }
      });

      finalReport = {
        sourceName: effectiveSourceName,
        fileName,
        expectedRange: `${startNumber}–${endNumber}`,
        expectedCount,
        extractedCount: extractedList.length,
        verifiedCount: verified,
        reviewCount: reviewReq,
        errorCount: errors,
        missingCount: missing,
        duplicateCount: 0,
        answerKeyMatchedCount: extractedList.filter((q) => q.correctAnswer).length,
        solutionsMatchedCount: extractedList.filter((q) => q.solution).length,
        status: errors > 0 ? "FAILED" : reviewReq > 0 ? "REVIEW_REQUIRED" : "VERIFIED",
        issues,
      };

      finalQuestionsToSave = extractedList.map((q, idx) => ({
        jobId: job.id,
        questionIndex: idx + 1,
        originalNumber: q.originalNumber || startNumber + idx,
        pyqExam: job.pyqExam,
        pyqYear: job.pyqYear,
        pyqMonth: job.pyqMonth,
        pyqQuestionNumber: `Question ${String(q.originalNumber || startNumber + idx).padStart(2, "0")}`,
        sourceName: effectiveSourceName,
        sourcePdfUrl: fileUrl,
        sourcePdfName: fileName,
        sourcePage: q.sourcePage || 1,
        statement: q.statement,
        statementHi: q.statementHi || null,
        options: q.options,
        correctAnswer: q.correctAnswer || "A",
        answerKeySource: q.answerKeySource || "AI_PARSER",
        solution: q.solution || null,
        solutionHi: q.solutionHi || null,
        hasTable: q.hasTable || false,
        hasImage: q.hasImage || false,
        hasEquation: q.hasEquation || false,
        imageUrl: q.imageUrl || null,
        subject: q.subject || (subject !== "Auto Detect" ? subject : "Physics"),
        chapter: q.chapter || chapter || null,
        topic: q.topic || null,
        subTopic: q.subTopic || null,
        questionType: q.questionType || "SINGLE_CORRECT",
        difficulty: q.difficulty || "MEDIUM",
        status: q.status || "VERIFIED",
        confidence: q.confidence || 95,
        confidenceBreakdown: q.confidenceBreakdown || null,
        reviewReasons: q.reviewReasons || [],
        originalSnapshot: {
          statement: q.statement,
          options: q.options,
          correctAnswer: q.correctAnswer,
          solution: q.solution,
        },
      }));
    } else {
      // Regex parsing fallback
      const rawBlocks = detectQuestionBlocks(cleanedText, startNumber, endNumber);
      const answersMap = extractAnswerKey(cleanedText, startNumber, endNumber);
      const solutionsMap = extractSolutions(cleanedText, startNumber, endNumber);

      const { validatedQuestions, report } = validateAndClassifyQuestions(
        rawBlocks,
        answersMap,
        solutionsMap,
        {
          sourceName: effectiveSourceName,
          fileName,
          fileUrl,
          startNumber,
          endNumber,
          defaultSubject: subject !== "Auto Detect" ? subject : undefined,
          defaultChapter: chapter || undefined,
        }
      );

      finalReport = report;
      finalQuestionsToSave = validatedQuestions.map((q) => ({
        jobId: job.id,
        questionIndex: q.questionIndex,
        originalNumber: q.originalNumber,
        pyqExam: job.pyqExam,
        pyqYear: job.pyqYear,
        pyqMonth: job.pyqMonth,
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

    // 5. Persist Extracted Questions in Prisma
    if (finalQuestionsToSave.length > 0) {
      await prisma.extractedQuestion.createMany({
        data: finalQuestionsToSave,
      });
    }

    // 6. Update Job Status & Report
    const updatedJob = await prisma.extractionJob.update({
      where: { id: job.id },
      data: {
        extractedCount: finalReport.extractedCount,
        verifiedCount: finalReport.verifiedCount,
        reviewCount: finalReport.reviewCount,
        errorCount: finalReport.errorCount,
        missingCount: finalReport.missingCount,
        duplicateCount: finalReport.duplicateCount,
        status: finalReport.status === "VERIFIED" ? "VERIFIED" : finalReport.status === "REVIEW_REQUIRED" ? "REVIEW_REQUIRED" : "FAILED",
        progress: 100,
        currentStep: "Validation Complete",
        reportJson: finalReport as any,
      },
    });

    // 7. Audit Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "EXTRACTION_JOB_CREATE",
        entityType: "ExtractionJob",
        entityId: job.id,
        metadata: {
          sourceName: effectiveSourceName,
          fileName,
          expectedCount,
          extractedCount: finalReport.extractedCount,
          verifiedCount: finalReport.verifiedCount,
          status: updatedJob.status,
          isAiProcessed,
        },
      },
    });

    return apiSuccess(
      {
        job: updatedJob,
        report: finalReport,
      },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
