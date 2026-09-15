import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedStudent } from "@/lib/ncert/auth-helper";
import { recordPageSkip } from "@/lib/ncert/question-pool";

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
    });

    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    const skipResult = await recordPageSkip({
      studentId: auth.student.id,
      documentId,
      pageId: page.id,
    });

    return NextResponse.json(skipResult);
  } catch (error: any) {
    console.error("[NCERT Skip API] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to skip page" }, { status: 500 });
  }
}
