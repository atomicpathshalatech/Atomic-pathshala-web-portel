import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedStudent } from "@/lib/ncert/auth-helper";

export async function GET(
  request: NextRequest,
  { params }: { params: { documentId: string } }
) {
  try {
    const auth = await getAuthenticatedStudent();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { documentId } = params;

    const [doc, chapterProgress, pageProgressList] = await Promise.all([
      prisma.ncertDocument.findUnique({
        where: { id: documentId },
        include: {
          academicChapter: true,
          academicSubject: true,
          academicClass: true,
        },
      }),
      prisma.ncertStudentChapterProgress.findUnique({
        where: {
          studentId_documentId: {
            studentId: auth.student.id,
            documentId,
          },
        },
      }),
      prisma.ncertStudentPageProgress.findMany({
        where: {
          studentId: auth.student.id,
          documentId,
        },
        orderBy: { pageNumber: "asc" },
      }),
    ]);

    if (!doc) {
      return NextResponse.json({ error: "NCERT Document not found" }, { status: 404 });
    }

    const totalPages = doc.totalPages;
    const completedPages = pageProgressList.filter((p) => p.status === "COMPLETED").length;
    const skippedPages = pageProgressList.filter((p) => p.status === "SKIPPED").length;
    const completedOrSkipped = completedPages + skippedPages;
    const completionPercentage =
      totalPages > 0 ? Number(((completedOrSkipped / totalPages) * 100).toFixed(1)) : 0;

    return NextResponse.json({
      chapter: {
        id: doc.academicChapter.id,
        title: doc.academicChapter.title,
        titleHindi: doc.academicChapter.titleHindi,
        chapterNumber: doc.academicChapter.chapterNumber,
        subjectName: doc.academicSubject.name,
        className: doc.academicClass.name,
        language: doc.language,
        totalPages,
      },
      progress: {
        status: chapterProgress?.status || "IN_PROGRESS",
        pagesCompleted: completedPages,
        pagesSkipped: skippedPages,
        totalQuestionsAttempted: chapterProgress?.totalQuestionsAttempted || 0,
        totalCorrect: chapterProgress?.totalCorrect || 0,
        totalIncorrect: chapterProgress?.totalIncorrect || 0,
        accuracy: chapterProgress?.accuracy || 0,
        completionPercentage,
        pageStatuses: pageProgressList.map((p) => ({
          pageNumber: p.pageNumber,
          status: p.status,
          score: p.score,
          accuracy: p.accuracy,
        })),
      },
    });
  } catch (error: any) {
    console.error("[NCERT Progress API] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch progress" }, { status: 500 });
  }
}
