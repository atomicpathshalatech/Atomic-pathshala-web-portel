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
    const searchQuery = searchParams.get("q")?.trim().toLowerCase() || "";

    const [teachers, batchSchedules, lecturesWithProgress, testimonials] = await Promise.all([
      prisma.teacher.findMany({
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              photoUrl: true,
            },
          },
          batchAssignments: {
            include: {
              batch: {
                select: {
                  id: true,
                  name: true,
                  _count: { select: { enrollments: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.batchSchedule.findMany({
        where: { type: "LIVE_CLASS", isTest: false },
        select: {
          id: true,
          teacherId: true,
          status: true,
          startsAt: true,
          endsAt: true,
          liveWhiteboardSession: {
            select: {
              id: true,
              status: true,
              livePhase: true,
              startedAt: true,
              endedAt: true,
              actualStartedAt: true,
              actualEndedAt: true,
            },
          },
        },
      }),
      prisma.lecture.findMany({
        select: {
          id: true,
          teacherId: true,
          durationMin: true,
          _count: { select: { progress: true } },
        },
      }),
      prisma.teacherTestimonial.findMany({
        where: { status: "APPROVED" },
        select: { teacherId: true, rating: true },
      }),
    ]);

    // Group schedules by teacher
    const schedulesByTeacher = new Map<string, typeof batchSchedules>();
    for (const s of batchSchedules) {
      if (!s.teacherId) continue;
      const list = schedulesByTeacher.get(s.teacherId) || [];
      list.push(s);
      schedulesByTeacher.set(s.teacherId, list);
    }

    // Group lectures by teacher
    const lecturesByTeacher = new Map<string, typeof lecturesWithProgress>();
    for (const l of lecturesWithProgress) {
      const list = lecturesByTeacher.get(l.teacherId) || [];
      list.push(l);
      lecturesByTeacher.set(l.teacherId, list);
    }

    // Group testimonials by teacher
    const testimonialsByTeacher = new Map<string, typeof testimonials>();
    for (const t of testimonials) {
      const list = testimonialsByTeacher.get(t.teacherId) || [];
      list.push(t);
      testimonialsByTeacher.set(t.teacherId, list);
    }

    const educatorRankings = teachers.map((teacher) => {
      const teacherSchedules = schedulesByTeacher.get(teacher.id) || [];
      const teacherLectures = lecturesByTeacher.get(teacher.id) || [];
      const teacherTestimonials = testimonialsByTeacher.get(teacher.id) || [];

      const scheduledClasses = teacherSchedules.filter((s) => s.status !== "CANCELLED");
      const scheduledCount = scheduledClasses.length;

      let conductedCount = 0;
      let liveTeachingMinutes = 0;

      for (const s of scheduledClasses) {
        const wb = s.liveWhiteboardSession;
        const isConducted =
          s.status === "COMPLETED" ||
          wb?.status === "ENDED" ||
          wb?.livePhase === "ENDED";

        if (isConducted) conductedCount += 1;

        if (wb) {
          const start = wb.actualStartedAt || wb.startedAt;
          const end =
            wb.actualEndedAt ||
            wb.endedAt ||
            (wb.status === "ACTIVE" || wb.livePhase === "LIVE" ? new Date() : null);

          if (start && end) {
            const diffMs = end.getTime() - start.getTime();
            if (diffMs > 0) {
              liveTeachingMinutes += Math.round(diffMs / 60000);
            }
          }
        }
      }

      const attendancePct =
        scheduledCount > 0 ? Math.round((conductedCount / scheduledCount) * 100) : 100;

      // Recorded lectures delivered & student watch impact
      const totalLecturesCreated = teacherLectures.length;
      let totalStudentWatchCompletions = 0;
      let recordedWatchMinutesDelivered = 0;

      for (const lec of teacherLectures) {
        totalStudentWatchCompletions += lec._count.progress;
        recordedWatchMinutesDelivered += (lec.durationMin || 45) * lec._count.progress;
      }

      const totalWatchMinutes = liveTeachingMinutes + recordedWatchMinutesDelivered;
      const totalWatchHours = Math.round(totalWatchMinutes / 60);

      // Student ratings & feedback
      let avgRating = 5.0;
      if (teacherTestimonials.length > 0) {
        const sumRating = teacherTestimonials.reduce((sum, t) => sum + (t.rating || 5), 0);
        avgRating = Number((sumRating / teacherTestimonials.length).toFixed(1));
      }

      // Total students enrolled across batches
      const totalStudentsTaught = teacher.batchAssignments.reduce(
        (sum, b) => sum + b.batch._count.enrollments,
        0
      );

      // Composite Educator Performance Score (0 - 1000)
      const performanceScore = Math.min(
        1000,
        Math.round(
          Math.min(400, totalWatchHours * 10) +
            (attendancePct * 3) +
            (avgRating * 40) +
            Math.min(100, conductedCount * 10)
        )
      );

      let badge = "Rising Star";
      if (performanceScore >= 800) badge = "Master Educator";
      else if (performanceScore >= 600) badge = "Star Faculty";
      else if (performanceScore >= 400) badge = "Core Faculty";

      return {
        teacherId: teacher.id,
        userId: teacher.userId,
        name: teacher.user.name,
        email: teacher.user.email,
        photoUrl: teacher.user.photoUrl,
        employeeCode: teacher.employeeCode,
        department: teacher.department,
        subjects: teacher.subjects,
        scheduledCount,
        conductedCount,
        attendancePct,
        liveTeachingMinutes,
        totalLecturesCreated,
        totalStudentWatchCompletions,
        totalWatchHours,
        avgRating,
        testimonialCount: teacherTestimonials.length,
        totalStudentsTaught,
        activeBatchesCount: teacher.batchAssignments.length,
        performanceScore,
        badge,
      };
    });

    const filtered = educatorRankings
      .filter((e) => {
        if (!searchQuery) return true;
        return (
          e.name.toLowerCase().includes(searchQuery) ||
          e.email.toLowerCase().includes(searchQuery) ||
          (e.department && e.department.toLowerCase().includes(searchQuery)) ||
          e.subjects.some((s) => s.toLowerCase().includes(searchQuery))
        );
      })
      .sort((a, b) => b.performanceScore - a.performanceScore)
      .map((e, index) => ({
        ...e,
        rank: index + 1,
      }));

    return NextResponse.json({
      ok: true,
      summary: {
        totalTeachers: filtered.length,
        totalWatchHoursDelivered: filtered.reduce((sum, e) => sum + e.totalWatchHours, 0),
        avgPlatformRating:
          filtered.length > 0
            ? (filtered.reduce((sum, e) => sum + e.avgRating, 0) / filtered.length).toFixed(1)
            : "5.0",
        totalClassesConducted: filtered.reduce((sum, e) => sum + e.conductedCount, 0),
      },
      rankings: filtered,
    });
  } catch (error) {
    console.error("[Educators Performance API Error]:", error);
    return NextResponse.json({ ok: false, error: "Internal Server Error" }, { status: 500 });
  }
}
