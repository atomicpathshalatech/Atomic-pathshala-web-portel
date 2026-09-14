import "server-only";
import { prisma } from "@/lib/db";

/**
 * Explicit, auditable "delete this and everything tied to it" for the
 * resource types the platform registry (src/lib/resources/registry.ts)
 * covers. Deliberately NOT a schema-level onDelete: Cascade on
 * Attempt.testId — that stays Restrict as a DB-level safety net so no
 * other, unrelated code path can silently wipe a student's attempt by
 * deleting a Test out from under it. These functions are the one
 * intentional, audited place that cascade is allowed to happen, and only
 * when an admin explicitly deletes the parent resource.
 */

export async function deleteTestCascading(testId: string, actorUserId: string) {
  const test = await prisma.test.findUnique({ where: { id: testId }, select: { id: true, name: true } });
  if (!test) return null;

  const attemptCount = await prisma.attempt.count({ where: { testId } });

  // AttemptAnswer/AttemptViolation/TestAttemptAnalysis all cascade
  // automatically from Attempt (onDelete: Cascade on each) — deleting the
  // Attempt rows here is enough to clean up the whole chain.
  await prisma.$transaction([
    prisma.attempt.deleteMany({ where: { testId } }),
    prisma.test.delete({ where: { id: testId } }),
  ]);

  await prisma.auditLog.create({
    data: {
      userId: actorUserId,
      action: "TEST_DELETED",
      entityType: "Test",
      entityId: testId,
      metadata: { title: test.name, attemptsDeleted: attemptCount },
    },
  });

  return { title: test.name, attemptsDeleted: attemptCount };
}

/**
 * Deleting a BatchSchedule or a whole Batch cascades (at the DB level,
 * schema onDelete: Cascade) into any Test rows hanging off their
 * schedules — which then hits the exact same Attempt.testId Restrict wall
 * deleteTestCascading exists to get around. Since that wall trips inside
 * Postgres's own cascade before any application code runs, it has to be
 * cleared beforehand: delete every Attempt for every Test under the given
 * schedule ids first, then the caller's own Batch/BatchSchedule delete can
 * proceed and cascade cleanly.
 */
export async function clearAttemptsForSchedules(scheduleIds: string[]): Promise<number> {
  if (scheduleIds.length === 0) return 0;
  const tests = await prisma.test.findMany({
    where: { batchScheduleId: { in: scheduleIds } },
    select: { id: true },
  });
  if (tests.length === 0) return 0;
  const result = await prisma.attempt.deleteMany({
    where: { testId: { in: tests.map((t) => t.id) } },
  });
  return result.count;
}

/**
 * Dpp's Attempt relation (Attempt.dppId) has no Restrict — it's already
 * SetNull by default, so no explicit cleanup is strictly required for the
 * delete itself to succeed. This still runs in a transaction and logs the
 * orphaned-attempt count so a deletion that detaches real attempt history
 * from its DPP is visible in the audit trail, not silent.
 */
/**
 * Deletes a teacher's platform account entirely. Deleting the underlying
 * User row (rather than just the Teacher row) is deliberate — Teacher.user
 * is onDelete: Cascade toward Teacher (schema.prisma), so removing the User
 * takes the Teacher profile and every Cascade-linked relation
 * (BatchTeacher, TestSeriesTeacher, DoubtSlot, DoubtBooking,
 * WhiteboardBoard, WhiteboardSession, Contract, PenaltyRecord,
 * TeacherDocument, TeacherFollow, TeacherClassFeedback) with it in one
 * transaction-safe operation, and BatchSchedule.teacherId is already
 * onDelete: SetNull so past/future schedule entries survive.
 *
 * Lecture.teacherId is the one required, non-cascading relation on Teacher
 * (no onDelete clause — schema.prisma) — deleting a teacher who is still
 * the instructor of record on any Lecture would hit a raw FK violation, so
 * that case is refused up front with an actionable message instead.
 */
export async function deleteTeacherCascading(teacherId: string, actorUserId: string) {
  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    select: { id: true, userId: true, employeeCode: true, user: { select: { name: true, email: true } } },
  });
  if (!teacher) return null;

  const lectureCount = await prisma.lecture.count({ where: { teacherId } });
  if (lectureCount > 0) {
    throw new Error(
      `This teacher is still the instructor on ${lectureCount} lecture(s). Reassign or delete those lectures first, then delete the teacher.`
    );
  }

  await prisma.user.delete({ where: { id: teacher.userId } });

  await prisma.auditLog.create({
    data: {
      userId: actorUserId,
      action: "TEACHER_DELETED",
      entityType: "Teacher",
      entityId: teacherId,
      metadata: { employeeCode: teacher.employeeCode, name: teacher.user.name, email: teacher.user.email },
    },
  });

  return { name: teacher.user.name, employeeCode: teacher.employeeCode };
}

export async function deleteDppCascading(dppId: string, actorUserId: string) {
  const dpp = await prisma.dpp.findUnique({ where: { id: dppId }, select: { id: true, name: true } });
  if (!dpp) return null;

  const attemptCount = await prisma.attempt.count({ where: { dppId } });

  await prisma.dpp.delete({ where: { id: dppId } });

  await prisma.auditLog.create({
    data: {
      userId: actorUserId,
      action: "DPP_DELETED",
      entityType: "Dpp",
      entityId: dppId,
      metadata: { title: dpp.name, attemptsOrphaned: attemptCount },
    },
  });

  return { title: dpp.name, attemptsOrphaned: attemptCount };
}
