import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { apiSuccess, handleApiError } from "@/lib/api/response";
import { POPUP_LEAD_MS, isDppTest, isInUpcomingPopupWindow, testWindowStart } from "@/lib/tests/schedule-rules";

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

    // 3. The test to announce: only from 24 h before it opens until its window
    // ends (it used to fall back to the newest test even after it was over).
    const now = new Date();
    const horizon = new Date(now.getTime() + POPUP_LEAD_MS);
    const lookBack = new Date(now.getTime() - 2 * 24 * 3600 * 1000);

    const candidates = await prisma.test.findMany({
      where: {
        archived: false,
        AND: [
          {
            OR: [
              { testSeriesId: { in: importedSeriesIds } },
              { batchSchedule: { batchId: { in: batchIds } } },
            ],
          },
          {
            OR: [
              { openTime: { gte: lookBack, lte: horizon } },
              { openTime: null, batchSchedule: { startsAt: { gte: lookBack, lte: horizon } } },
            ],
          },
        ],
      },
      orderBy: { openTime: "asc" },
      take: 20,
      include: {
        testSeries: { select: { id: true, name: true, code: true } },
        batchSchedule: { select: { batchId: true, startsAt: true, endsAt: true, type: true, batch: { select: { name: true } } } },
        attempts: { where: { studentId: student.id }, select: { status: true } },
      },
    });

    const tests = candidates
      .filter((t) => !isDppTest(t) && isInUpcomingPopupWindow(t, now))
      // Already submitted: nothing left to announce.
      .filter((t) => !t.attempts.some((a) => a.status === "SUBMITTED" || a.status === "AUTO_SUBMITTED"))
      .sort((x, y) => (testWindowStart(x)?.getTime() ?? 0) - (testWindowStart(y)?.getTime() ?? 0));

    if (tests.length === 0) {
      return NextResponse.json({ success: true, data: { upcomingTest: null } });
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
          scheduledAt: testWindowStart(test),
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
