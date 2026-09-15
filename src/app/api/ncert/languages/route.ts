import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { NCERTDocumentStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const chapterId = searchParams.get("chapterId");

    if (!chapterId) {
      return NextResponse.json({ error: "chapterId parameter is required" }, { status: 400 });
    }

    const documents = await prisma.ncertDocument.findMany({
      where: {
        academicChapterId: chapterId,
        status: { in: [NCERTDocumentStatus.READY, NCERTDocumentStatus.PUBLISHED] },
      },
      select: {
        id: true,
        language: true,
        totalPages: true,
        version: true,
      },
    });

    const options = [
      {
        language: "ENGLISH",
        label: "English",
        documentId: documents.find((d) => d.language === "ENGLISH")?.id || null,
        available: documents.some((d) => d.language === "ENGLISH"),
        totalPages: documents.find((d) => d.language === "ENGLISH")?.totalPages || 0,
      },
      {
        language: "HINDI",
        label: "हिंदी",
        documentId: documents.find((d) => d.language === "HINDI")?.id || null,
        available: documents.some((d) => d.language === "HINDI"),
        totalPages: documents.find((d) => d.language === "HINDI")?.totalPages || 0,
      },
    ];

    return NextResponse.json({ languages: options });
  } catch (error: any) {
    console.error("[NCERT Languages API] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch languages" }, { status: 500 });
  }
}
