import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fetchCanonicalTestData, generateTestPaperHtml, generateTestCoverPageOnlyHtml } from "@/lib/pdf/test-export-engine";
import { apiError } from "@/lib/api/response";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized. Please log in to download this test.", { status: 401 });
    }

    const testId = params.id;
    const testData = await fetchCanonicalTestData(testId);
    if (!testData) {
      return apiError("Test not found", 404);
    }

    // If student or parent, enforce that PDF download is only allowed after completing the test or if the test window has closed
    const userRole = (session.user as any)?.role;
    if (userRole === "STUDENT" || userRole === "PARENT") {
      const dbTest = await prisma.test.findUnique({
        where: { id: testId },
        select: {
          closeTime: true,
          batchSchedule: { select: { endsAt: true } },
        },
      });

      const now = new Date();
      const isClosed = Boolean(
        (dbTest?.closeTime && now > dbTest.closeTime) ||
        (dbTest?.batchSchedule?.endsAt && now > dbTest.batchSchedule.endsAt)
      );

      let hasCompleted = false;
      const student = await prisma.student.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      });

      if (student) {
        const completedAttempt = await prisma.attempt.findFirst({
          where: {
            testId,
            studentId: student.id,
            status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] },
          },
          select: { id: true },
        });
        hasCompleted = Boolean(completedAttempt);
      }

      if (!hasCompleted && !isClosed) {
        return apiError("Test paper download is not available until you have completed the test or the test attempt window has closed.", 403);
      }
    }

    const searchParams = request.nextUrl.searchParams;
    const typeParam = searchParams.get("type") || "without-solution";
    const isCoverOnly = typeParam === "cover" || searchParams.get("preview") === "cover";
    const withSolution = typeParam === "with-solution" || searchParams.get("solutions") === "true";
    const download = searchParams.get("download") === "true";

    const htmlContent = isCoverOnly
      ? generateTestCoverPageOnlyHtml(testData, {
          withSolution: false,
          brandName: "ATOMIC PATHSHALA",
          watermarkText: "ATOMIC PATHSHALA",
          testPattern: testData.examType,
        })
      : generateTestPaperHtml(testData, {
          withSolution,
          brandName: "ATOMIC PATHSHALA",
          watermarkText: "ATOMIC PATHSHALA",
          testPattern: testData.examType,
        });

    const filename = isCoverOnly
      ? `Atomic_Pathshala_${testData.code.replace(/[^a-zA-Z0-9_-]/g, "_")}_COVER.html`
      : `Atomic_Pathshala_${testData.code.replace(/[^a-zA-Z0-9_-]/g, "_")}_${withSolution ? "WITH_SOLUTIONS" : "QUESTION_PAPER"}.html`;

    const headers: Record<string, string> = {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    };

    if (download) {
      headers["Content-Disposition"] = `attachment; filename="${filename}"`;
    } else {
      headers["Content-Disposition"] = `inline; filename="${filename}"`;
    }

    return new NextResponse(htmlContent, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error("Error generating test export:", error);
    return new NextResponse("Internal Server Error while generating test document", { status: 500 });
  }
}
