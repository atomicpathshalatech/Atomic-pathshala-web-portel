import "server-only";
import { prisma } from "@/lib/db";
import { resolveStudentForSchedule } from "@/lib/batch/access";

/**
 * Access rule for a standalone TestSeries test (no BatchSchedule), per the
 * user's explicit decision: PUBLIC series are open to every active
 * student; PRIVATE series are gated by matching the series' targetBatch/
 * className/course against the student's own batch enrollment/class/
 * targetExam — any field left blank on the series is not filtered on.
 * A series with all three blank and PRIVATE visibility is therefore open
 * to every active student too (nothing to match against), same as PUBLIC.
 */
export async function resolveStudentForSeries(userId: string, testSeriesId: string) {
  const series = await prisma.testSeries.findUnique({ where: { id: testSeriesId } });
  if (!series) return { series: null, student: null };

  const student = await prisma.student.findUnique({ where: { userId } });
  if (!student) return { series, student: null };
  if (student.status !== "ACTIVE") return { series, student: null };

  if (series.visibility === "PUBLIC") return { series, student };

  if (series.className && student.class !== series.className) return { series, student: null };
  if (series.course && student.targetExam !== series.course) return { series, student: null };

  if (series.targetBatch) {
    const enrolled = await prisma.batchEnrollment.findFirst({
      where: { studentId: student.id, status: "ACTIVE", batch: { name: series.targetBatch } },
    });
    if (!enrolled) return { series, student: null };
  }

  return { series, student };
}

/**
 * Unified access check for a Test, whichever kind it is — a class test
 * bound to a BatchSchedule, or a standalone test under a TestSeries. Every
 * student-facing test route (list/start/answer/submit/result) should go
 * through this instead of assuming batchScheduleId is always set.
 */
export async function resolveStudentForTest(
  userId: string,
  test: { batchScheduleId: string | null; testSeriesId: string | null }
): Promise<{ student: { id: string } | null }> {
  if (test.batchScheduleId) {
    const { student } = await resolveStudentForSchedule(userId, test.batchScheduleId);
    return { student };
  }
  if (test.testSeriesId) {
    const { student } = await resolveStudentForSeries(userId, test.testSeriesId);
    return { student };
  }
  return { student: null };
}
