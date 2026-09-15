import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthenticatedStudent } from "@/lib/ncert/auth-helper";
import { evaluateStudentSubmission } from "@/lib/ncert/question-pool";

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

    const body = await request.json();
    const { answers } = body;

    if (!Array.isArray(answers) || answers.length === 0) {
      return NextResponse.json({ error: "Answers array is required" }, { status: 400 });
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
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    const result = await evaluateStudentSubmission({
      studentId: auth.student.id,
      documentId,
      pageId: page.id,
      answers,
    });

    return NextResponse.json({ result });
  } catch (error: any) {
    console.error("[NCERT Submit API] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to submit answers" }, { status: 500 });
  }
}
