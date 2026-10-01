import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchCanonicalTestData, generateTestPaperHtml, generateTestCoverPageOnlyHtml } from "@/lib/pdf/test-export-engine";
import { apiError } from "@/lib/api/response";
import { studentPaperBlockReason } from "@/lib/tests/paper-access";

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

    const blocked = await studentPaperBlockReason(session.user.id, (session.user as any)?.role, testId, withSolution);
    if (blocked) return apiError(blocked, 403);

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
