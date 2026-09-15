import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    const pages = await prisma.ncertPage.findMany({
      where: { documentId: id },
      select: {
        id: true,
        pageNumber: true,
        pageImageUrl: true,
        extractedText: true,
        extractedElements: true,
        processingStatus: true,
        _count: {
          select: {
            questions: true,
          },
        },
      },
      orderBy: { pageNumber: "asc" },
    });

    const formatted = pages.map((p) => ({
      id: p.id,
      pageNumber: p.pageNumber,
      textLength: p.extractedText.length,
      textPreview: p.extractedText.slice(0, 150) + "...",
      elementsCount: Array.isArray(p.extractedElements) ? p.extractedElements.length : 0,
      questionsGeneratedCount: p._count.questions,
      processingStatus: p.processingStatus,
    }));

    return NextResponse.json({ pages: formatted });
  } catch (error: any) {
    console.error("[Team NCERT Pages API] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch document pages" }, { status: 500 });
  }
}
