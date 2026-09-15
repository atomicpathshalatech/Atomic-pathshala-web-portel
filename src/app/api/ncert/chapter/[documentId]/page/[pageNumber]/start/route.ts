import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedStudent } from "@/lib/ncert/auth-helper";
import {
  getOrGeneratePageQuestionPool,
  sanitizeQuestionsForClient,
} from "@/lib/ncert/question-pool";
import { NCERTPageProgressStatus } from "@prisma/client";

export async function POST(
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

    const page = await prisma.ncertPage.findUnique({
      where: {
        documentId_pageNumber: {
          documentId,
          pageNumber,
        },
      },
      include: { document: true },
    });

    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    // Initialize or get student progress
    const pageProgress = await prisma.ncertStudentPageProgress.upsert({
      where: {
        studentId_pageId: {
          studentId: auth.student.id,
          pageId: page.id,
        },
      },
      update: {
        status: NCERTPageProgressStatus.IN_PROGRESS,
      },
      create: {
        studentId: auth.student.id,
        documentId,
        chapterId: page.document.academicChapterId,
        pageId: page.id,
        pageNumber: page.pageNumber,
        language: page.document.language,
        status: NCERTPageProgressStatus.IN_PROGRESS,
        attemptCount: 1,
      },
    });

    const poolSet = pageProgress.attemptCount || 1;
    // Prepare or fetch questions
    const questions = await getOrGeneratePageQuestionPool(
      page.id,
      poolSet,
      auth.student.userId || auth.user?.id
    );

    if (questions.length === 0) {
      return NextResponse.json({
        message: "No verified questions could be generated from this page content.",
        questions: [],
        canSkip: true,
      });
    }

    return NextResponse.json({
      questions: sanitizeQuestionsForClient(questions),
      attemptNumber: poolSet,
    });
  } catch (error: any) {
    console.error("[NCERT Start Practice API] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to start practice" }, { status: 500 });
  }
}
