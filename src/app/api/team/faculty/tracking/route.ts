import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UnauthorizedError, ForbiddenError } from "@/lib/rbac/guard";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { apiSuccess, handleApiError } from "@/lib/api/response";

export interface TeacherTrackingRecord {
  teacherId: string;
  userId: string;
  name: string;
  photoUrl: string | null;
  email: string | null;
  employeeCode: string | null;
  department: string | null;
  subjects: string[];
  scheduledCount: number;
  conductedCount: number;
  attendancePct: number;
  totalTeachingMinutes: number;
  watchTimeFormatted: string;
  isCurrentlyLive: boolean;
  rank: number;
}

/**
 * GET /api/team/faculty/tracking
 * Dedicated API for Teacher Live Class Tracking & Teaching Watch Time:
 * - Attendance (% and count: scheduled vs conducted live classes)
 * - Teaching Watch Time in canonical minutes: e.g. "3,250 min (54h 10m)"
 * - Rankings based on actual teaching minutes derived strictly from WhiteboardSession lifecycle.
 * (Zero YouTube watch-time integration per strict scope).
 */
export async function GET(_request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) throw new UnauthorizedError();

    const canRead = await hasPermission(session.user.id, PERMISSIONS.TEACHER_READ);
    if (!canRead) throw new ForbiddenError();

    const [teachers, batchSchedules] = await Promise.all([
      prisma.teacher.findMany({
        include: {
          user: {
            select: {
              id: true,
              name: true,
              photoUrl: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.batchSchedule.findMany({
        where: {
          type: "LIVE_CLASS",
          isTest: false,
        },
        select: {
          id: true,
          teacherId: true,
          status: true,
          startsAt: true,
          endsAt: true,
          liveWhiteboardSession: {
            select: {
              id: true,
              teacherId: true,
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
    ]);

    // Group schedules and whiteboard sessions by teacher
    const scheduleMapByTeacher = new Map<string, typeof batchSchedules>();
    for (const s of batchSchedules) {
      if (!s.teacherId) continue;
      const list = scheduleMapByTeacher.get(s.teacherId) || [];
      list.push(s);
      scheduleMapByTeacher.set(s.teacherId, list);
    }

    const records: TeacherTrackingRecord[] = teachers.map((teacher) => {
      const teacherSchedules = scheduleMapByTeacher.get(teacher.id) || [];
      const scheduledClasses = teacherSchedules.filter((s) => s.status !== "CANCELLED");
      const scheduledCount = scheduledClasses.length;

      let conductedCount = 0;
      let totalTeachingMinutes = 0;
      let isCurrentlyLive = false;

      for (const s of scheduledClasses) {
        const wb = s.liveWhiteboardSession;
        const isConducted =
          s.status === "COMPLETED" ||
          wb?.status === "ENDED" ||
          wb?.livePhase === "ENDED";

        if (isConducted) {
          conductedCount += 1;
        }

        if (wb) {
          if (wb.status === "ACTIVE" || wb.livePhase === "LIVE") {
            isCurrentlyLive = true;
          }

          const start = wb.actualStartedAt || wb.startedAt;
          const end =
            wb.actualEndedAt ||
            wb.endedAt ||
            (wb.status === "ACTIVE" || wb.livePhase === "LIVE" ? new Date() : null);

          if (start && end) {
            const diffMs = end.getTime() - start.getTime();
            if (diffMs > 0) {
              totalTeachingMinutes += Math.round(diffMs / 60000);
            }
          }
        }
      }

      const attendancePct =
        scheduledCount > 0 ? Math.round((conductedCount / scheduledCount) * 100) : 0;

      const hours = Math.floor(totalTeachingMinutes / 60);
      const remainingMins = totalTeachingMinutes % 60;
      const watchTimeFormatted = `${totalTeachingMinutes.toLocaleString()} min (${hours}h ${remainingMins}m)`;

      return {
        teacherId: teacher.id,
        userId: teacher.userId,
        name: teacher.user.name,
        photoUrl: teacher.user.photoUrl,
        email: teacher.user.email,
        employeeCode: teacher.employeeCode,
        department: teacher.department,
        subjects: teacher.subjects,
        scheduledCount,
        conductedCount,
        attendancePct,
        totalTeachingMinutes,
        watchTimeFormatted,
        isCurrentlyLive,
        rank: 0,
      };
    });

    // Ranking algorithm: Primary sort by total teaching minutes (descending),
    // secondary sort by attendance percentage (descending).
    records.sort((a, b) => {
      if (b.totalTeachingMinutes !== a.totalTeachingMinutes) {
        return b.totalTeachingMinutes - a.totalTeachingMinutes;
      }
      if (b.attendancePct !== a.attendancePct) {
        return b.attendancePct - a.attendancePct;
      }
      return b.conductedCount - a.conductedCount;
    });

    const rankedRecords = records.map((record, index) => ({
      ...record,
      rank: index + 1,
    }));

    // Overall metrics
    const totalScheduled = rankedRecords.reduce((acc, r) => acc + r.scheduledCount, 0);
    const totalConducted = rankedRecords.reduce((acc, r) => acc + r.conductedCount, 0);
    const totalMinutes = rankedRecords.reduce((acc, r) => acc + r.totalTeachingMinutes, 0);
    const totalHours = Math.floor(totalMinutes / 60);
    const totalRemMins = totalMinutes % 60;

    const summary = {
      totalFaculty: teachers.length,
      totalScheduledClasses: totalScheduled,
      totalConductedClasses: totalConducted,
      overallAttendancePct: totalScheduled > 0 ? Math.round((totalConducted / totalScheduled) * 100) : 0,
      totalTeachingWatchTimeMinutes: totalMinutes,
      totalTeachingWatchTimeString: `${totalMinutes.toLocaleString()} min (${totalHours}h ${totalRemMins}m)`,
    };

    return apiSuccess({
      summary,
      teachers: rankedRecords,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
