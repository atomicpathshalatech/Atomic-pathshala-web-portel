import "server-only";
import { prisma } from "@/lib/db";
import { areResultsReleased, isDppTest, resultsReleaseAt } from "@/lib/tests/schedule-rules";

/**
 * Whether a student / parent may have a test's question paper or solutions.
 * Returns null when allowed, else the reason to show. Staff are always allowed.
 *
 *  - A test's paper and solutions open for everyone once the scheduled test
 *    time is over (not as soon as one student submits).
 *  - A DPP is practice: its question sheet once published, its solutions
 *    after the student has submitted it.
 */
export async function studentPaperBlockReason(
  userId: string,
  role: string | undefined,
  testId: string,
  withSolution: boolean
): Promise<string | null> {
  if (role !== "STUDENT" && role !== "PARENT") return null;
  const dbTest = await prisma.test.findUnique({
    where: { id: testId },
    select: {
      status: true,
      openTime: true,
      closeTime: true,
      durationMin: true,
      testType: true,
      batchSchedule: { select: { startsAt: true, endsAt: true, type: true } },
    },
  });
  const published = dbTest
    ? isDppTest(dbTest)
      ? dbTest.status === "PUBLISHED"
      : !["DRAFT", "PENDING_APPROVAL", "UNDER_REVIEW"].includes(dbTest.status)
    : false;
  if (!dbTest || !published) return "This paper isn't published yet.";

  if (isDppTest(dbTest)) {
    if (withSolution) {
      const student = await prisma.student.findUnique({ where: { userId }, select: { id: true } });
      const done = student
        ? await prisma.attempt.findFirst({
            where: { testId, studentId: student.id, status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } },
            select: { id: true },
          })
        : null;
      if (!done) return "DPP solutions open after you submit the DPP.";
    }
    return null;
  }
  if (!areResultsReleased(dbTest)) {
    return `The test paper and solutions open for everyone after the test time is over (${resultsReleaseAt(dbTest)?.toISOString()}).`;
  }
  return null;
}
