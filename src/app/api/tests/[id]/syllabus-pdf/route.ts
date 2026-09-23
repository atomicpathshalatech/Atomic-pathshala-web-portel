import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  generateTestSyllabusPdfBuffer,
  generateTestSyllabusHtml,
  type TestSyllabusChapterItem,
} from "@/lib/pdf/syllabus-pdf-engine";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized. Please log in.", { status: 401 });
    }

    const testId = params.id;
    const searchParams = request.nextUrl.searchParams;
    const batchId = searchParams.get("batchId");
    const download = searchParams.get("download") === "true";
    const format = searchParams.get("format");

    const test = await prisma.test.findUnique({
      where: { id: testId },
      include: {
        testSeries: {
          select: { id: true, name: true, code: true },
        },
      },
    });

    if (!test) {
      return new NextResponse("Test not found", { status: 404 });
    }

    let batchName: string | null = null;
    if (batchId) {
      const b = await prisma.batch.findUnique({
        where: { id: batchId },
        select: { name: true },
      });
      if (b) batchName = b.name;
    }

    // Parse chapters from stored syllabus Json
    let chapters: TestSyllabusChapterItem[] = [];
    if (test.syllabus) {
      try {
        const raw = typeof test.syllabus === "string" ? JSON.parse(test.syllabus) : test.syllabus;
        if (Array.isArray(raw?.chapters)) {
          chapters = raw.chapters;
        } else if (Array.isArray(raw)) {
          chapters = raw;
        }
      } catch (e) {
        console.error("Failed to parse test syllabus JSON:", e);
      }
    }

    const syllabusData = {
      testId: test.id,
      testName: test.name,
      testCode: test.code,
      durationMin: test.durationMin,
      openTime: test.openTime,
      examType: test.examType,
      testType: test.testType,
      batchName: batchName || test.testSeries?.name || null,
      chapters,
      generatedAt: test.createdAt,
    };

    const safeTitle = test.name.replace(/[^a-zA-Z0-9_-]/g, "_");

    if (format === "html") {
      const htmlContent = generateTestSyllabusHtml(syllabusData);
      const filename = `Atomic_Pathshala_Syllabus_${safeTitle}.html`;
      return new NextResponse(htmlContent, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": download ? `attachment; filename="${filename}"` : `inline; filename="${filename}"`,
          "Cache-Control": "public, max-age=3600, s-maxage=3600",
        },
      });
    }

    // Default: Direct vector PDF document
    const pdfBuffer = await generateTestSyllabusPdfBuffer(syllabusData);
    const filename = `Atomic_Pathshala_Syllabus_${safeTitle}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": download
          ? `attachment; filename="${filename}"`
          : `inline; filename="${filename}"`,
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    });
  } catch (err: any) {
    console.error("Error serving test syllabus PDF:", err);
    return new NextResponse("Failed to load test syllabus", { status: 500 });
  }
}
