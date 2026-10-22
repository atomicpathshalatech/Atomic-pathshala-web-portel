import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { prisma } from "@/lib/db";
import { getAuthenticatedStudent } from "@/lib/ncert/auth-helper";
import { getOrGeneratePageQuestionPool } from "@/lib/ncert/question-pool";
import { NCERTVerificationStatus } from "@prisma/client";

// The AI run continues after the response (waitUntil) — give it room.
export const maxDuration = 60;

/**
 * Gets a page's questions ready before the student opens it: the chapter
 * screen calls this for the NEXT page while the student works on the current
 * one, so "Next page" shows questions at once instead of waiting for the AI.
 * Answers immediately; the generation (if needed) runs in the background.
 * Records no progress — opening the page later does that as usual.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { documentId: string; pageNumber: string } }
) {
  try {
    const auth = await getAuthenticatedStudent();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pageNumber = parseInt(params.pageNumber, 10);
    if (isNaN(pageNumber) || pageNumber < 1) {
      return NextResponse.json({ error: "Invalid page number" }, { status: 400 });
    }

    const page = await prisma.ncertPage.findUnique({
      where: { documentId_pageNumber: { documentId: params.documentId, pageNumber } },
      select: { id: true, extractedText: true },
    });
    if (!page || !page.extractedText) {
      return NextResponse.json({ ready: false, preparing: false });
    }

    // The set the student would get on opening the page: set 1, or the
    // reattempt set they are on.
    const progress = await prisma.ncertStudentPageProgress.findUnique({
      where: { studentId_pageId: { studentId: auth.student.id, pageId: page.id } },
      select: { attemptCount: true },
    });
    const poolSet = progress?.attemptCount || 1;

    const ready = await prisma.ncertPageQuestion.count({
      where: { pageId: page.id, poolSet, verificationStatus: NCERTVerificationStatus.APPROVED },
    });
    if (ready > 0) {
      return NextResponse.json({ ready: true, preparing: false });
    }

    waitUntil(
      getOrGeneratePageQuestionPool(page.id, poolSet, auth.userId || auth.student.userId).catch((err) => {
        console.warn("[NCERT Prepare] background generation failed:", err);
      })
    );
    return NextResponse.json({ ready: false, preparing: true });
  } catch (error: any) {
    console.error("[NCERT Prepare API] Error:", error);
    return NextResponse.json({ error: "Failed to prepare page" }, { status: 500 });
  }
}
