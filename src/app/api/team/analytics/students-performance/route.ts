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
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (timeframe === "week") {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (timeframe === "month") {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Fetch all students
    const students = await prisma.student.findMany({
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
      take: 200,
    });

    const studentIds = students.map((s) => s.id);

    const [testAttempts, dppAttempts, lectureProgresses, liveAttendances, ncertAttempts] = await Promise.all([
      prisma.attempt.findMany({
        where: {
          studentId: { in: studentIds },
          status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] },
          testId: { not: null },
          ...(startDate ? { submittedAt: { gte: startDate } } : {}),
        },
        include: {
          test: { select: { name: true, correctMarks: true } },
          answers: { select: { isCorrect: true, timeTakenSec: true } },
        },
      }),
      prisma.attempt.findMany({
        where: {
          studentId: { in: studentIds },
          dppId: { not: null },
          ...(startDate ? { submittedAt: { gte: startDate } } : {}),
        },
        include: {
          answers: { select: { isCorrect: true, timeTakenSec: true } },
        },
      }),
      prisma.lectureProgress.findMany({
        where: {
          studentId: { in: studentIds },
          ...(startDate ? { completedAt: { gte: startDate } } : {}),
        },
        include: {
          lecture: { select: { durationMin: true } },
        },
      }),
      prisma.liveClassAttendance.findMany({
        where: {
          studentId: { in: studentIds },
          ...(startDate ? { createdAt: { gte: startDate } } : {}),
        },
        select: {
          studentId: true,
          joinedAt: true,
          leftAt: true,
        },
      }),
      prisma.ncertStudentPageProgress.findMany({
        where: {
          studentId: { in: studentIds },
          ...(startDate ? { startedAt: { gte: startDate } } : {}),
        },
        select: {
          studentId: true,
          questionsAttempted: true,
          correctAnswers: true,
          incorrectAnswers: true,
        },
      }),
    ]);

    // Aggregate metrics per student
    const studentMetrics = students.map((s) => {
      const studentTests = testAttempts.filter((t) => t.studentId === s.id);
      const studentDpps = dppAttempts.filter((d) => d.studentId === s.id);
      const studentLectures = lectureProgresses.filter((l) => l.studentId === s.id);
      const studentLives = liveAttendances.filter((a) => a.studentId === s.id);
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
      let lectureWatchMinutes = studentLectures.reduce((sum, l) => sum + (l.lecture?.durationMin || 45), 0);
      let liveClassMinutes = 0;
      for (const att of studentLives) {
        if (att.joinedAt && att.leftAt) {
          const dur = Math.round((att.leftAt.getTime() - att.joinedAt.getTime()) / 60000);
          liveClassMinutes += Math.max(5, Math.min(180, dur));
        } else {
          liveClassMinutes += 45;
        }
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
    const totalStudyHoursPlatform = Math.round(
      studentMetrics.reduce((sum, s) => sum + s.totalStudyMinutes, 0) / 60
    );
    const activePracticingStudents = studentMetrics.filter((s) => s.totalQuestionsAttempted > 0).length;

    return NextResponse.json({
      ok: true,
      timeframe,
      summary: {
        totalStudents: studentMetrics.length,
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
