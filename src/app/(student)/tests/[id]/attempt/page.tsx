import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { resolveStudentForTest } from "@/lib/test-series/access";
import { computeDeadlineMs } from "@/lib/test-engine/scoring";
import { toLegacyQuestion } from "@/lib/questions/legacy";
import { ExamRunner } from "@/components/student/ExamRunner";

export const metadata: Metadata = {
  title: "Live CBT Exam Room | Atomic Pathshala",
};

export default async function TestAttemptPage({ params }: { params: { id: string } }) {
  const { session } = await requireStudentSession();

  const test = await prisma.test.findUnique({
    where: { id: params.id },
    include: {
      batchSchedule: { include: { batch: true } },
      testSeries: true,
      sections: {
        orderBy: { order: "asc" },
        include: {
          questions: {
            orderBy: { order: "asc" },
            include: { question: { include: { translations: true } } },
          },
        },
      },
    },
  });
  if (!test) notFound();
  if (test.status !== "PUBLISHED") redirect("/tests");
  if (!test.batchScheduleId && !test.testSeriesId) redirect("/tests");

  const { student } = await resolveStudentForTest(session.user.id, test);
  if (!student) redirect("/tests");

  const now = new Date();
  // Standalone tests have no schedule window — open anytime once
  // PUBLISHED. Batch-scheduled tests still respect the class's window.
  if (test.batchSchedule && now < test.batchSchedule.startsAt) redirect("/tests");

  let attempt = await prisma.attempt.findUnique({
    where: { testId_studentId: { testId: test.id, studentId: student.id } },
    include: { answers: true },
  });

  if (!attempt) {
    if (test.batchSchedule && now > test.batchSchedule.endsAt) redirect("/tests");
    attempt = await prisma.attempt.create({
      data: { testId: test.id, studentId: student.id },
      include: { answers: true },
    });
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

  const deadlineMs = computeDeadlineMs(attempt.startedAt, test.durationMin, test.batchSchedule?.endsAt);

  const answersMap = new Map(
    attempt.answers.map((a) => [
      a.questionId,
      Array.isArray(a.selectedOptionIds) ? (a.selectedOptionIds as string[])[0] ?? null : null,
    ])
  );

  const sectionQuestions = test.sections.flatMap((s) => s.questions);

  const questionsData = sectionQuestions.map((sq) => {
    const legacy = toLegacyQuestion(sq.question);
    const enTrans = sq.question.translations?.find((t) => t.language === "ENGLISH");
    const hiTrans = sq.question.translations?.find((t) => t.language === "HINDI");
    const enOpts = (enTrans?.options as Record<string, string>) || {};
    const hiOpts = (hiTrans?.options as Record<string, string>) || {};

    return {
      id: sq.question.id,
      order: sq.order,
      subject: sq.question.subject || test.batchSchedule?.subject || "General",
      body: enTrans?.statement || legacy.body,
      type: legacy.type,
      optionA: enOpts.A || legacy.optionA,
      optionB: enOpts.B || legacy.optionB,
      optionC: enOpts.C || legacy.optionC,
      optionD: enOpts.D || legacy.optionD,
      bodyHi: hiTrans?.statement || null,
      optionAHi: hiOpts.A || null,
      optionBHi: hiOpts.B || null,
      optionCHi: hiOpts.C || null,
      optionDHi: hiOpts.D || null,
      mySelection: answersMap.get(sq.question.id) ?? null,
    };
  });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, photoUrl: true },
  });

  return (
    <ExamRunner
      testId={test.id}
      initialData={{
        attempt: {
          id: attempt.id,
          status: attempt.status,
          startedAt: attempt.startedAt.toISOString(),
          deadlineAt: new Date(deadlineMs).toISOString(),
        },
        test: {
          id: test.id,
          title: test.name,
          instructions: test.instructions,
          durationMin: test.durationMin,
          targetExam: test.batchSchedule?.batch.targetExam || test.testSeries?.course || test.examType || "NEET UG",
        },
        questions: questionsData,
        candidateName: user?.name || "Student",
        candidatePhoto: user?.photoUrl || null,
      }}
    />
  );
}
