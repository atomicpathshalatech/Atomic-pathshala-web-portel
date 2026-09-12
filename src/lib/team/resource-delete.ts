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
