import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fetchCanonicalTestData, generateTestPaperHtml, generateTestCoverPageOnlyHtml } from "@/lib/pdf/test-export-engine";
import { apiError } from "@/lib/api/response";
import { areResultsReleased, isDppTest, resultsReleaseAt } from "@/lib/tests/schedule-rules";

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

    const searchParams = request.nextUrl.searchParams;
    const typeParam = searchParams.get("type") || "without-solution";
    const isCoverOnly = typeParam === "cover" || searchParams.get("preview") === "cover";
    const withSolution = typeParam === "with-solution" || searchParams.get("solutions") === "true";

    // Students/parents: a test's paper and solutions open for everyone once the
    // scheduled test time is over (not as soon as one student submits). A DPP
    // is practice: its question sheet once published, its solutions after
    // the student has submitted it.
    const userRole = (session.user as any)?.role;
    if (userRole === "STUDENT" || userRole === "PARENT") {
      const dbTest = await prisma.test.findUnique({
        where: { id: testId },
        select: {
          status: true,
          openTime: true,
          closeTime: true,
          durationMin: true,
          batchSchedule: { select: { startsAt: true, endsAt: true, type: true } },
        },
      });
      const published = dbTest
        ? isDppTest(dbTest)
          ? dbTest.status === "PUBLISHED"
          : !["DRAFT", "PENDING_APPROVAL", "UNDER_REVIEW"].includes(dbTest.status)
        : false;
      if (!dbTest || !published) {
        return apiError("This paper isn't published yet.", 403);
      }

      if (isDppTest(dbTest)) {
        if (withSolution) {
          const student = await prisma.student.findUnique({ where: { userId: session.user.id }, select: { id: true } });
          const done = student
            ? await prisma.attempt.findFirst({
                where: { testId, studentId: student.id, status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } },
                select: { id: true },
              })
            : null;
          if (!done) return apiError("DPP solutions open after you submit the DPP.", 403);
        }
      } else if (!areResultsReleased(dbTest)) {
        return apiError(
          `The test paper and solutions open for everyone after the test time is over (${resultsReleaseAt(dbTest)?.toISOString()}).`,
          403
        );
      }
    }

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
          // The download buttons open ?direct=true: lay the pages out, then go
          // straight to the browser's "Save as PDF" dialog.
          autoPrint: searchParams.get("direct") === "true",
        });

    const currentDateStr = new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(testData.createdAt || new Date()).replace(/[/\\?%*:|"<>]/g, "-");

    const safeTestName = (testData.name || "Test").replace(/[/\\?%*:|"<>]/g, "_").trim();
    const filename = isCoverOnly
      ? `${safeTestName} - ${currentDateStr} - ATOMIC PATHSHALA - COVER.html`
      : `${safeTestName} - ${currentDateStr} - ATOMIC PATHSHALA${withSolution ? " (Solutions)" : ""}.html`;

    const headers: Record<string, string> = {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      Pragma: "no-cache",
      Expires: "0",
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
