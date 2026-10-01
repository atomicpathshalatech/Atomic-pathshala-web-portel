import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const canView = await hasPermission(session.user.id, PERMISSIONS.ANALYTICS_VIEW);
    if (!canView) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get("timeframe") || "today"; // today, week, month, all
    const searchQuery = searchParams.get("q")?.trim().toLowerCase() || "";
    const limit = Math.min(100, Math.max(10, parseInt(searchParams.get("limit") || "50", 10)));

    let startDate: Date | undefined;
    const now = new Date();

    if (timeframe === "today") {
      // Midnight in India (the server runs in UTC).
      const istDay = new Date(now.getTime() + 330 * 60 * 1000).toISOString().slice(0, 10);
      startDate = new Date(`${istDay}T00:00:00+05:30`);
    } else if (timeframe === "week") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (timeframe === "month") {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const since = startDate ? { gte: startDate } : undefined;

    // Activity in the timeframe first; the board then covers every student who
    // did something (it used to look at an arbitrary 200 students only).
    const [testAttempts, dppAttempts, lectureProgresses, liveAttendances, ncertAttempts, videoWatches, totalStudents] = await Promise.all([
      prisma.attempt.findMany({
        where: {
          status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] },
          testId: { not: null },
          ...(since ? { submittedAt: since } : {}),
        },
        select: {
          studentId: true,
          score: true,
          answers: { select: { isCorrect: true } },
        },
      }),
      prisma.attempt.findMany({
        where: {
          dppId: { not: null },
          ...(since ? { submittedAt: since } : {}),
        },
        select: {
          studentId: true,
          answers: { select: { isCorrect: true } },
        },
      }),
      prisma.lectureProgress.findMany({
        where: since ? { completedAt: since } : {},
        select: {
          studentId: true,
          lectureId: true,
          lecture: { select: { durationMin: true } },
        },
      }),
      prisma.liveClassAttendance.findMany({
        // (this table has no createdAt — filtering on it made every
        // Today / Week / Month request fail, so the tab showed zeros)
        where: since ? { joinedAt: since } : {},
        select: {
          studentId: true,
          joinedAt: true,
          leftAt: true,
          lastSeenAt: true,
          activeDurationSec: true,
        },
      }),
      prisma.ncertStudentPageProgress.findMany({
        where: since ? { startedAt: since } : {},
        select: {
          studentId: true,
          questionsAttempted: true,
          correctAnswers: true,
          incorrectAnswers: true,
        },
      }),
      prisma.videoWatch.findMany({
        where: since ? { lastWatchedAt: since } : {},
        select: { studentId: true, lectureId: true, watchedSec: true },
      }),
      prisma.student.count(),
    ]);

    const activeIds = new Set<string>();
    for (const list of [testAttempts, dppAttempts, lectureProgresses, liveAttendances, ncertAttempts, videoWatches]) {
      for (const row of list) activeIds.add(row.studentId);
    }
    // Searching also finds students with no activity in this timeframe.
    const searchMatches = searchQuery
      ? await prisma.student.findMany({
          where: {
            OR: [
              { user: { name: { contains: searchQuery, mode: "insensitive" } } },
              { user: { email: { contains: searchQuery, mode: "insensitive" } } },
              { studentIdCode: { contains: searchQuery, mode: "insensitive" } },
              { enrollmentNumber: { contains: searchQuery, mode: "insensitive" } },
              { batchEnrollments: { some: { batch: { name: { contains: searchQuery, mode: "insensitive" } } } } },
            ],
          },
          select: { id: true },
          take: 200,
        })
      : [];
    for (const m of searchMatches) activeIds.add(m.id);

    const students = await prisma.student.findMany({
      where: { id: { in: [...activeIds] } },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            photoUrl: true,
            phone: true,
          },
        },
        batchEnrollments: {
          include: {
            batch: { select: { id: true, name: true, code: true } },
          },
        },
      },
    });

    // Aggregate metrics per student
    const studentMetrics = students.map((s) => {
      const studentTests = testAttempts.filter((t) => t.studentId === s.id);
      const studentDpps = dppAttempts.filter((d) => d.studentId === s.id);
      const studentLectures = lectureProgresses.filter((l) => l.studentId === s.id);
      const studentLives = liveAttendances.filter((a) => a.studentId === s.id);
      const studentWatches = videoWatches.filter((w) => w.studentId === s.id);
      const studentNcert = ncertAttempts.filter((n) => n.studentId === s.id);

      // Questions practiced
      let totalQuestionsAttempted = 0;
      let totalQuestionsCorrect = 0;

      for (const t of studentTests) {
        for (const ans of t.answers) {
          totalQuestionsAttempted += 1;
          if (ans.isCorrect === true) totalQuestionsCorrect += 1;
        }
      }

      for (const d of studentDpps) {
        for (const ans of d.answers) {
          totalQuestionsAttempted += 1;
          if (ans.isCorrect === true) totalQuestionsCorrect += 1;
        }
      }

      for (const n of studentNcert) {
        totalQuestionsAttempted += n.questionsAttempted;
        totalQuestionsCorrect += n.correctAnswers;
      }

      const practiceAccuracy =
        totalQuestionsAttempted > 0
          ? Math.round((totalQuestionsCorrect / totalQuestionsAttempted) * 100)
          : 0;

      // Watch time and study hours
      const watchedLectureIds = new Set(studentWatches.map((w) => w.lectureId).filter(Boolean));
      const watchedSec = studentWatches.reduce((sum, w) => sum + w.watchedSec, 0);
      const untrackedLectureMin = studentLectures
        .filter((l) => !watchedLectureIds.has(l.lectureId))
        .reduce((sum, l) => sum + (l.lecture?.durationMin ?? 0), 0);
      const lectureWatchMinutes = Math.round(watchedSec / 60) + untrackedLectureMin;
      let liveClassMinutes = 0;
      for (const att of studentLives) {
        const end = att.leftAt ?? att.lastSeenAt;
        const spanMin = Math.max(0, Math.round((end.getTime() - att.joinedAt.getTime()) / 60000));
        const activeMin = Math.round(att.activeDurationSec / 60);
        liveClassMinutes += Math.min(240, activeMin > 0 ? activeMin : spanMin);
      }

      const totalStudyMinutes = lectureWatchMinutes + liveClassMinutes;
      const studyHoursFormatted = `${Math.floor(totalStudyMinutes / 60)}h ${totalStudyMinutes % 60}m`;

      // Test score performance
      let totalTestScore = 0;
      for (const t of studentTests) {
        if (typeof t.score === "number") totalTestScore += t.score;
      }
      const avgTestScore = studentTests.length > 0 ? Math.round(totalTestScore / studentTests.length) : 0;

      // All-Rounder Composite Score (0 - 1000 scale)
      const compositeScore = Math.min(
        1000,
        Math.round(
          Math.min(350, totalQuestionsAttempted * 3.5) +
            (practiceAccuracy * 2.5) +
            Math.min(250, (totalStudyMinutes / 60) * 50) +
            Math.min(150, studentTests.length * 30)
        )
      );

      const batchNames = s.batchEnrollments.map((e) => e.batch.name).join(", ") || "Self Study";

      return {
        studentId: s.id,
        userId: s.user.id,
        name: s.user.name,
        email: s.user.email,
        phone: s.user.phone,
        photoUrl: s.user.photoUrl,
        rollNumber: s.studentIdCode || s.enrollmentNumber,
        targetExam: s.targetExam,
        targetYear: null,
        batchNames,
        totalQuestionsAttempted,
        totalQuestionsCorrect,
        practiceAccuracy,
        totalStudyMinutes,
        studyHoursFormatted,
        lecturesWatchedCount: studentLectures.length,
        liveClassesAttendedCount: studentLives.length,
        testsCompletedCount: studentTests.length,
        totalTestScore,
        avgTestScore,
        compositeScore,
      };
    });

    // Apply search filter
    const filtered = studentMetrics.filter((s) => {
      if (!searchQuery) return true;
      return (
        s.name.toLowerCase().includes(searchQuery) ||
        (s.email && s.email.toLowerCase().includes(searchQuery)) ||
        (s.rollNumber && s.rollNumber.toLowerCase().includes(searchQuery)) ||
        s.batchNames.toLowerCase().includes(searchQuery) ||
        (s.targetExam && s.targetExam.toLowerCase().includes(searchQuery))
      );
    });

    // Topper lists
    const practiceToppers = [...filtered]
      .sort((a, b) => b.totalQuestionsAttempted - a.totalQuestionsAttempted)
      .slice(0, limit);

    const studyTimeToppers = [...filtered]
      .sort((a, b) => b.totalStudyMinutes - a.totalStudyMinutes)
      .slice(0, limit);

    const scoreToppers = [...filtered]
      .sort((a, b) => b.totalTestScore - a.totalTestScore)
      .slice(0, limit);

    const allRounderToppers = [...filtered]
      .sort((a, b) => b.compositeScore - a.compositeScore)
      .slice(0, limit);

    // Summary statistics
    const totalQuestionsPlatform = studentMetrics.reduce((sum, s) => sum + s.totalQuestionsAttempted, 0);
    // One decimal: a few minutes of study no longer rounds down to "0 hrs".
    const totalStudyHoursPlatform =
      Math.round((studentMetrics.reduce((sum, s) => sum + s.totalStudyMinutes, 0) / 60) * 10) / 10;
    const activePracticingStudents = studentMetrics.filter((s) => s.totalQuestionsAttempted > 0).length;

    return NextResponse.json({
      ok: true,
      timeframe,
      summary: {
        totalStudents,
        activeStudents: studentMetrics.filter((m) => m.totalQuestionsAttempted > 0 || m.totalStudyMinutes > 0 || m.testsCompletedCount > 0).length,
        activePracticingStudents,
        totalQuestionsPlatform,
        totalStudyHoursPlatform,
      },
      leaderboards: {
        practiceToppers,
        studyTimeToppers,
        scoreToppers,
        allRounderToppers,
      },
    });
  } catch (error) {
    console.error("[Students Performance API Error]:", error);
    return NextResponse.json({ ok: false, error: "Internal Server Error" }, { status: 500 });
  }
}
