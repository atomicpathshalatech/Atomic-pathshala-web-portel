import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { fetchCanonicalTestData, generateTestPaperHtml } from "@/lib/pdf/test-export-engine";
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

    const searchParams = request.nextUrl.searchParams;
    const typeParam = searchParams.get("type") || "without-solution";
    const withSolution = typeParam === "with-solution" || searchParams.get("solutions") === "true";
    const download = searchParams.get("download") === "true";

    const htmlContent = generateTestPaperHtml(testData, {
      withSolution,
      brandName: "ATOMIC PATHSHALA",
      watermarkText: "ATOMIC PATHSHALA",
      testPattern: testData.examType,
    });

    const filename = `Atomic_Pathshala_${testData.code.replace(/[^a-zA-Z0-9_-]/g, "_")}_${withSolution ? "WITH_SOLUTIONS" : "QUESTION_PAPER"}.html`;

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
