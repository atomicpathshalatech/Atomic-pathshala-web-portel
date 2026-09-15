import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedStudent } from "@/lib/ncert/auth-helper";
import { preparePageReattempt } from "@/lib/ncert/question-pool";

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

    const reattemptResult = await preparePageReattempt({
      studentId: auth.student.id,
      documentId,
      pageId: page.id,
      userId: auth.student.userId || auth.user?.id,
    });

    return NextResponse.json(reattemptResult);
  } catch (error: any) {
    console.error("[NCERT Reattempt API] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to prepare reattempt" },
      { status: 400 }
    );
  }
}
