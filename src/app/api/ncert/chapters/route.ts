import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { NCERTDocumentStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const subjectId = searchParams.get("subjectId");

    if (!subjectId) {
      return NextResponse.json({ error: "subjectId parameter is required" }, { status: 400 });
    }

    const chapters = await prisma.academicChapter.findMany({
      where: {
        subjectId,
        isActive: true,
      },
      include: {
        ncertDocuments: {
          where: {
            status: { in: [NCERTDocumentStatus.READY, NCERTDocumentStatus.PUBLISHED] },
          },
          select: {
            id: true,
            language: true,
            status: true,
            totalPages: true,
          },
        },
      },
      orderBy: { chapterNumber: "asc" },
    });

    const formatted = chapters.map((ch) => ({
      id: ch.id,
      chapterNumber: ch.chapterNumber,
      title: ch.title,
      titleHindi: ch.titleHindi,
      displayTitle: `Ch ${ch.chapterNumber}: ${ch.title}`,
      availableLanguages: ch.ncertDocuments.map((d) => d.language),
      documents: ch.ncertDocuments.map((d) => ({
        id: d.id,
        language: d.language,
        totalPages: d.totalPages,
      })),
      hasContent: ch.ncertDocuments.length > 0,
    }));

    return NextResponse.json({ chapters: formatted });
  } catch (error: any) {
    console.error("[NCERT Chapters API] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch chapters" }, { status: 500 });
  }
}
