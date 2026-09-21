import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export const dynamic = "force-dynamic";

/**
 * GET /api/student/upcoming-test
 * Returns the earliest upcoming test for the logged-in student across all active enrolled batches.
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ success: true, data: { upcomingTest: null } });
    }

    // 1. Get student's enrolled batch IDs
    const student = await prisma.student.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!student) {
      return NextResponse.json({ success: true, data: { upcomingTest: null } });
    }

    const enrollments = await prisma.batchEnrollment.findMany({
      where: {
        studentId: student.id,
        status: "ACTIVE",
      },
      select: { batchId: true, batch: { select: { id: true, name: true } } },
    });

    const batchIds = enrollments.map((e) => e.batchId);
    if (batchIds.length === 0) {
      return NextResponse.json({ success: true, data: { upcomingTest: null } });
    }

    const defaultBatchId = batchIds[0] || "";
    const batchMap = new Map(enrollments.map((e) => [e.batchId, e.batch.name]));

    // 2. Find test series imported into these batches
    const importedSeries = await prisma.batchTestSeries.findMany({
      where: { batchId: { in: batchIds } },
      select: { testSeriesId: true, batchId: true },
    });

    const seriesToBatchMap = new Map(importedSeries.map((i) => [i.testSeriesId, i.batchId]));
    const importedSeriesIds = importedSeries.map((i) => i.testSeriesId);

    // 3. Query upcoming tests
    const now = new Date();
    // Allow tests scheduled in the future, or scheduled within the last 4 hours (still active)
    const threshold = new Date(now.getTime() - 4 * 3600 * 1000);

    const tests = await prisma.test.findMany({
      where: {
        archived: false,
        openTime: { gte: threshold },
        OR: [
          { testSeriesId: { in: importedSeriesIds } },
          { batchSchedule: { batchId: { in: batchIds } } },
        ],
      },
      orderBy: { openTime: "asc" },
      take: 1,
      include: {
        testSeries: { select: { id: true, name: true, code: true } },
        batchSchedule: { select: { batchId: true, batch: { select: { name: true } } } },
      },
    });

    if (tests.length === 0) {
      // Fallback: If no upcoming test by openTime, check if any test exists in the imported test series
      const anyTest = await prisma.test.findFirst({
        where: {
          archived: false,
          OR: [
            { testSeriesId: { in: importedSeriesIds } },
            { batchSchedule: { batchId: { in: batchIds } } },
          ],
        },
        orderBy: { createdAt: "desc" },
        include: {
          testSeries: { select: { id: true, name: true, code: true } },
          batchSchedule: { select: { batchId: true, batch: { select: { name: true } } } },
        },
      });

      if (!anyTest) {
        return NextResponse.json({ success: true, data: { upcomingTest: null } });
      }

      const assignedBatchId: string =
        anyTest.batchSchedule?.batchId ||
        (anyTest.testSeriesId ? seriesToBatchMap.get(anyTest.testSeriesId) : defaultBatchId) ||
        defaultBatchId;
      const assignedBatchName =
        anyTest.batchSchedule?.batch?.name ||
        batchMap.get(assignedBatchId) ||
        "Enrolled Batch";

      let chapters: any[] = [];
      if (anyTest.syllabus) {
        try {
          const raw =
            typeof anyTest.syllabus === "string"
              ? JSON.parse(anyTest.syllabus)
              : anyTest.syllabus;
          chapters = raw?.chapters || raw || [];
        } catch {}
      }

      return NextResponse.json({
        success: true,
        data: {
          upcomingTest: {
            id: anyTest.id,
            name: anyTest.name,
            code: anyTest.code,
            testType: anyTest.testType || "Test",
            examType: anyTest.examType || "NEET",
            durationMin: anyTest.durationMin,
            scheduledAt: anyTest.openTime,
            batchId: assignedBatchId,
            batchName: assignedBatchName,
            chaptersCount: chapters.length,
            chapters: chapters,
            syllabusPdfUrl: `/api/tests/${anyTest.id}/syllabus-pdf?batchId=${assignedBatchId}`,
            syllabusPdfDownloadUrl: `/api/tests/${anyTest.id}/syllabus-pdf?batchId=${assignedBatchId}&download=true`,
          },
        },
      });
    }

    const test = tests[0];
    if (!test) {
      return NextResponse.json({ success: true, data: { upcomingTest: null } });
    }

    const assignedBatchId: string =
      test.batchSchedule?.batchId ||
      (test.testSeriesId ? seriesToBatchMap.get(test.testSeriesId) : defaultBatchId) ||
      defaultBatchId;
    const assignedBatchName =
      test.batchSchedule?.batch?.name ||
      batchMap.get(assignedBatchId) ||
      "Enrolled Batch";

    let chapters: any[] = [];
    if (test.syllabus) {
      try {
        const raw =
          typeof test.syllabus === "string" ? JSON.parse(test.syllabus) : test.syllabus;
        chapters = raw?.chapters || raw || [];
      } catch {}
    }

    return NextResponse.json({
      success: true,
      data: {
        upcomingTest: {
          id: test.id,
          name: test.name,
          code: test.code,
          testType: test.testType || "Test",
          examType: test.examType || "NEET",
          durationMin: test.durationMin,
          scheduledAt: test.openTime,
          batchId: assignedBatchId,
          batchName: assignedBatchName,
          chaptersCount: chapters.length,
          chapters: chapters,
          syllabusPdfUrl: `/api/tests/${test.id}/syllabus-pdf?batchId=${assignedBatchId}`,
          syllabusPdfDownloadUrl: `/api/tests/${test.id}/syllabus-pdf?batchId=${assignedBatchId}&download=true`,
        },
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
