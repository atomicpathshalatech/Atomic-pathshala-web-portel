import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { resolveStudentForSchedule } from "@/lib/batch/access";
import { TestAttemptRunner } from "@/components/student/TestAttemptRunner";

export const metadata: Metadata = {
  title: "Attempt Test",
};

export default async function TestAttemptPage({ params }: { params: { id: string } }) {
  const { session } = await requireStudentSession();

  const test = await prisma.test.findUnique({
    where: { id: params.id },
    include: { batchSchedule: true },
  });
  if (!test) notFound();
  if (test.status !== "PUBLISHED") redirect("/tests");

  const { student } = await resolveStudentForSchedule(session.user.id, test.batchScheduleId);
  if (!student) redirect("/tests");

  const now = new Date();
  if (now < test.batchSchedule.startsAt) redirect("/tests");

  let attempt = await prisma.testAttempt.findUnique({
    where: { testId_studentId: { testId: test.id, studentId: student.id } },
  });

  // First visit: start the attempt right here (same idempotent create as
  // POST /api/tests/[id]/attempts) so the runner below can assume one
  // already exists. A closed window with no existing attempt just means the
  // student never opened it in time — nothing to resume.
  if (!attempt) {
    if (now > test.batchSchedule.endsAt) redirect("/tests");
    attempt = await prisma.testAttempt.create({ data: { testId: test.id, studentId: student.id } });
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: "TEST_ATTEMPT_STARTED",
        entityType: "Test",
        entityId: test.id,
        metadata: { attemptId: attempt.id },
      },
    });
  }

  if (attempt.status !== "IN_PROGRESS") redirect(`/tests/${test.id}/result`);

  return <TestAttemptRunner testId={test.id} />;
}
