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
  _withSolution: boolean
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

  const student = await prisma.student.findUnique({ where: { userId }, select: { id: true } });
  if (!student) return "Student account not found.";

  const attempt = await prisma.attempt.findFirst({
    where: { testId, studentId: student.id, status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } },
    select: { id: true },
  });

  if (isDppTest(dbTest)) {
    if (!attempt) {
      return "DPP PDF is available only after you submit the DPP.";
    }
    return null;
  }

  // Regular Test: Must be submitted AND scheduled test time must be over
  if (!attempt) {
    return "Test PDF is available only after you submit your test.";
  }

  if (!areResultsReleased(dbTest)) {
    const releaseTime = resultsReleaseAt(dbTest);
    return `Test PDF opens for everyone after the test scheduled time is over (${releaseTime ? releaseTime.toISOString() : "scheduled window"}).`;
  }

  return null;
}
