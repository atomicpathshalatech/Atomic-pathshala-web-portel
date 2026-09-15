import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NCERTLanguage, NCERTDocumentStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("classId");
    const subjectId = searchParams.get("subjectId");
    const language = searchParams.get("language") as NCERTLanguage | null;
    const status = searchParams.get("status") as NCERTDocumentStatus | null;

    const whereClause: any = {};
    if (classId) whereClause.academicClassId = classId;
    if (subjectId) whereClause.academicSubjectId = subjectId;
    if (language && Object.values(NCERTLanguage).includes(language)) {
      whereClause.language = language;
    }
    if (status && Object.values(NCERTDocumentStatus).includes(status)) {
      whereClause.status = status;
    }

    const documents = await prisma.ncertDocument.findMany({
      where: whereClause,
      include: {
        academicClass: { select: { id: true, name: true, numericValue: true } },
        academicSubject: { select: { id: true, name: true, nameHindi: true } },
        academicChapter: { select: { id: true, title: true, titleHindi: true, chapterNumber: true } },
        uploadedBy: { select: { id: true, name: true, email: true } },
        _count: {
          select: {
            pages: true,
          },
        },
      },
      orderBy: [
        { academicClass: { numericValue: "asc" } },
        { academicChapter: { chapterNumber: "asc" } },
        { createdAt: "desc" },
      ],
    });

    const formatted = documents.map((doc) => ({
      id: doc.id,
      className: doc.academicClass.name,
      classNumeric: doc.academicClass.numericValue,
      subjectName: doc.academicSubject.name,
      subjectNameHindi: doc.academicSubject.nameHindi,
      chapterTitle: doc.academicChapter.title,
      chapterTitleHindi: doc.academicChapter.titleHindi,
      chapterNumber: doc.academicChapter.chapterNumber,
      language: doc.language,
      fileUrl: doc.fileUrl,
      fileName: doc.fileName,
      fileSize: doc.fileSize,
      version: doc.version,
      status: doc.status,
      totalPages: doc.totalPages,
      pageRecordsCount: doc._count.pages,
      uploadedBy: doc.uploadedBy.name,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }));

    return NextResponse.json({ documents: formatted });
  } catch (error: any) {
    console.error("[Team NCERT Documents API] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch NCERT documents" }, { status: 500 });
  }
}
