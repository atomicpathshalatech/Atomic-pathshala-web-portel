import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requirePermission, UnauthorizedError } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, apiError, handleApiError } from "@/lib/api/response";
import { cleanDocumentArtifacts } from "@/lib/extraction/pdf-extractor";
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
        year,
        subject: subject !== "Auto Detect" ? subject : null,
        chapter,
        createdById: session.user.id,
      },
    });

    // 2. Extract Document Content
    let docText = "";
    if (file) {
      const buffer = Buffer.from(await file.arrayBuffer());
      // In production Node environment: Read text stream from PDF buffer
      docText = buffer.toString("utf-8");
      // If binary PDF, fallback to text representation or raw text provided
      if (docText.includes("%PDF") || docText.length < 50) {
        docText = rawPastedText || "";
      }
    } else {
      docText = rawPastedText || "";
    }

    const cleanedText = cleanDocumentArtifacts(docText);

    // 3. Detect Question Blocks
    const rawBlocks = detectQuestionBlocks(cleanedText, startNumber, endNumber);

    // 4. Extract Answer Key & Solutions
    const answersMap = extractAnswerKey(cleanedText, startNumber, endNumber);
    const solutionsMap = extractSolutions(cleanedText, startNumber, endNumber);

    // 5. Validate & Classify Questions (Zero-Silent-Error Engine)
    const { validatedQuestions, report } = validateAndClassifyQuestions(
      rawBlocks,
      answersMap,
      solutionsMap,
      {
        sourceName,
        fileName,
        fileUrl: job.fileUrl,
        startNumber,
        endNumber,
        defaultSubject: subject !== "Auto Detect" ? subject : undefined,
        defaultChapter: chapter || undefined,
      }
    );

    // 6. Persist Extracted Questions in Prisma
    if (validatedQuestions.length > 0) {
      await prisma.extractedQuestion.createMany({
        data: validatedQuestions.map((q) => ({
          jobId: job.id,
          questionIndex: q.questionIndex,
          originalNumber: q.originalNumber,
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
          hasTable: q.hasTable,
          hasImage: q.hasImage,
          hasEquation: q.hasEquation,
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
        })),
      });
    }

    // 7. Update Job Status & Report
    const updatedJob = await prisma.extractionJob.update({
      where: { id: job.id },
      data: {
        extractedCount: report.extractedCount,
        verifiedCount: report.verifiedCount,
        reviewCount: report.reviewCount,
        errorCount: report.errorCount,
        missingCount: report.missingCount,
        duplicateCount: report.duplicateCount,
        status: report.status === "VERIFIED" ? "VERIFIED" : report.status === "REVIEW_REQUIRED" ? "REVIEW_REQUIRED" : "FAILED",
        progress: 100,
        currentStep: "Validation Complete",
        reportJson: report as any,
      },
    });

    // 8. Audit Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "EXTRACTION_JOB_CREATE",
        entityType: "ExtractionJob",
        entityId: job.id,
        metadata: {
          sourceName,
          fileName,
          expectedCount,
          extractedCount: report.extractedCount,
          verifiedCount: report.verifiedCount,
          status: updatedJob.status,
        },
      },
    });

    return apiSuccess(
      {
        job: updatedJob,
        report,
      },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
