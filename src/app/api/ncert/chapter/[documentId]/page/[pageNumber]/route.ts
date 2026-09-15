import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedStudent } from "@/lib/ncert/auth-helper";
import {
  sanitizeQuestionsForClient,
  MAX_REATTEMPTS_PER_PAGE,
} from "@/lib/ncert/question-pool";
import { NCERTPageProgressStatus, NCERTVerificationStatus } from "@prisma/client";

export async function GET(
  request: NextRequest,
  { params }: { params: { documentId: string; pageNumber: string } }
) {
  try {
    const auth = await getAuthenticatedStudent();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { documentId, pageNumber: rawPageNumber } = params;
    const pageNumber = parseInt(rawPageNumber, 10);

    if (isNaN(pageNumber) || pageNumber < 1) {
      return NextResponse.json({ error: "Invalid page number" }, { status: 400 });
    }

    // 1. Fetch document and page
    const document = await prisma.ncertDocument.findUnique({
      where: { id: documentId },
      include: {
        academicChapter: true,
        academicSubject: true,
        academicClass: true,
      },
    });

    if (!document) {
      return NextResponse.json({ error: "NCERT Document not found" }, { status: 404 });
    }

    const page = await prisma.ncertPage.findUnique({
      where: {
        documentId_pageNumber: {
          documentId,
          pageNumber,
        },
      },
    });

    if (!page) {
      return NextResponse.json({ error: "NCERT Page not found" }, { status: 404 });
    }

    // 2. Fetch student's progress for this page
    const pageProgress = await prisma.ncertStudentPageProgress.findUnique({
      where: {
        studentId_pageId: {
          studentId: auth.student.id,
          pageId: page.id,
        },
      },
      include: {
        attempts: {
          orderBy: { attemptNumber: "desc" },
          take: 1,
        },
      },
    });

    // 3. Check if questions exist for current poolSet
    const currentPoolSet = pageProgress?.attemptCount || 1;
    const existingQuestions = await prisma.ncertPageQuestion.findMany({
      where: {
        pageId: page.id,
        poolSet: currentPoolSet,
        verificationStatus: NCERTVerificationStatus.APPROVED,
      },
      orderBy: { createdAt: "asc" },
    });

    const isCompleted = pageProgress?.status === NCERTPageProgressStatus.COMPLETED;
    const isSkipped = pageProgress?.status === NCERTPageProgressStatus.SKIPPED;
    const isInProgress = pageProgress?.status === NCERTPageProgressStatus.IN_PROGRESS;

    let reviews = null;
    let questionsForClient = null;

    if (isCompleted && pageProgress.attempts.length > 0) {
      // Return review with answers
      const lastAttempt = pageProgress.attempts[0];
      const answersMap = new Map<string, string>();
      if (lastAttempt && Array.isArray(lastAttempt.answers)) {
        for (const ans of lastAttempt.answers as any[]) {
          answersMap.set(ans.questionId, ans.selectedOption);
        }
      }

      reviews = existingQuestions.map((q) => {
        const selected = answersMap.get(q.id) || "";
        return {
          id: q.id,
          question: q.question,
          options: q.options,
          selectedOption: selected,
          correctAnswer: q.correctAnswer,
          isCorrect: selected === q.correctAnswer,
          explanation: q.explanation,
          sourceTextReference: q.sourceTextReference,
        };
      });
    } else if (existingQuestions.length > 0 && isInProgress) {
      questionsForClient = sanitizeQuestionsForClient(existingQuestions);
    }

    const currentAttempt = pageProgress?.attemptCount || 1;
    const remainingReattempts = Math.max(0, 1 + MAX_REATTEMPTS_PER_PAGE - currentAttempt);

    return NextResponse.json({
      page: {
        id: page.id,
        pageNumber: page.pageNumber,
        totalPages: document.totalPages,
        extractedText: page.extractedText,
        extractedElements: page.extractedElements,
        pageImageUrl: page.pageImageUrl,
        fileUrl: document.fileUrl,
      },
      document: {
        id: document.id,
        language: document.language,
        chapterTitle: document.academicChapter.title,
        chapterTitleHindi: document.academicChapter.titleHindi,
        chapterNumber: document.academicChapter.chapterNumber,
        subjectName: document.academicSubject.name,
        subjectNameHindi: document.academicSubject.nameHindi,
        className: document.academicClass.name,
      },
      progress: {
        status: pageProgress?.status || NCERTPageProgressStatus.NOT_STARTED,
        attemptCount: currentAttempt,
        score: pageProgress?.score || 0,
        accuracy: pageProgress?.accuracy || 0,
        canReattempt: isCompleted && remainingReattempts > 0,
        remainingReattempts,
        isCompleted,
        isSkipped,
        isInProgress,
      },
      questions: questionsForClient,
      lastResult: reviews
        ? {
            score: pageProgress?.score || 0,
            accuracy: pageProgress?.accuracy || 0,
            reviews,
          }
        : null,
    });
  } catch (error: any) {
    console.error("[NCERT Page GET API] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to load NCERT page" }, { status: 500 });
  }
}
