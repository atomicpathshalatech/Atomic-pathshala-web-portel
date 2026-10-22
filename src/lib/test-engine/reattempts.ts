import "server-only";
import { prisma } from "@/lib/db";
import { analyseAttempt, type AttemptForAnalysis } from "@/lib/test-engine/analysis-engine";
import { areResultsReleased } from "@/lib/tests/schedule-rules";
import { resolveStudentForTest } from "@/lib/test-series/access";
import { toLegacyQuestion } from "@/lib/questions/legacy";

/**
 * Re-attempts: after the first attempt is submitted and results are out, a
 * student can sit the same test / DPP / chapter test again for practice.
 * Attempt 1 is the Attempt row (ranked, in leaderboards and reports);
 * Attempt 2, 3, … are TestReattempt rows and never ranked. Each gets the
 * same exam room and the same result dashboard.
 */
export const MAX_REATTEMPTS = 3;

export function reattemptDeadlineMs(startedAt: Date, durationMin: number) {
  return startedAt.getTime() + durationMin * 60_000;
}

/** questionId → chosen option, from the stored JSON. */
export function reattemptAnswers(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === "string" && v) out[k] = v;
    }
  }
  return out;
}

export async function loadTestForExam(testId: string) {
  return prisma.test.findUnique({
    where: { id: testId },
    include: {
      batchSchedule: { include: { batch: true } },
      testSeries: true,
      sections: {
        orderBy: { order: "asc" },
        include: {
          questions: {
            orderBy: { order: "asc" },
            include: {
              question: {
                include: {
                  translations: true,
                  assets: { orderBy: { order: "asc" } },
                },
              },
            },
          },
        },
      },
    },
  });
}

export type ExamTest = NonNullable<Awaited<ReturnType<typeof loadTestForExam>>>;

/** The exam-room question list (no answers or solutions), as the first attempt's page builds it. */
export function examQuestions(test: ExamTest, selections: Record<string, string | null>) {
  return test.sections.flatMap((s) =>
    s.questions.map((sq) => {
      const q = sq.question;
      const legacy = toLegacyQuestion(q);
      const enTrans = q.translations?.find((t) => t.language === "ENGLISH");
      const hiTrans = q.translations?.find((t) => t.language === "HINDI");
      const enOpts = (enTrans?.options as Record<string, string>) || {};
      const hiOpts = (hiTrans?.options as Record<string, string>) || {};
      const diagramAsset = q.assets?.find((a) => a.type === "DIAGRAM" || a.type === "FIGURE");
      const hasReferenceAsset = q.assets?.some((a) => a.type === "REFERENCE" && a.publicUrl === q.imageUrl);
      const isReferenceImage =
        Boolean(q.imageUrl) &&
        (hasReferenceAsset ||
          q.imageUrl === q.referenceImageUrl ||
          q.tags?.includes("Extracted") ||
          q.tags?.includes("AI_AUTO_DRAFT") ||
          q.imageUrl?.includes("/questions/q_") ||
          q.category?.includes("AI_DRAFT") ||
          q.category?.includes("Source:") ||
          q.category?.includes("PYQ"));
      const validDiagramUrl = diagramAsset?.publicUrl || (isReferenceImage ? null : q.imageUrl);
      return {
        id: q.id,
        order: sq.order,
        subject: s.subject || q.subject || test.batchSchedule?.subject || "General",
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
        imageUrl: validDiagramUrl || null,
        camDrawData: (q as { camDrawData?: unknown }).camDrawData || null,
        mySelection: selections[q.id] ?? null,
      };
    })
  );
}

/**
 * Who may re-attempt: the student's first attempt is submitted and the
 * results are out (a re-attempt before that would expose the paper while
 * others are still writing it).
 */
export async function reattemptAccess(userId: string, testId: string) {
  const test = await prisma.test.findUnique({ where: { id: testId }, include: { batchSchedule: true } });
  if (!test) return { error: "Test not found", status: 404 as const };
  if (test.status === "ARCHIVED" || test.archived) return { error: "This test is archived.", status: 409 as const };
  const { student } = await resolveStudentForTest(userId, test);
  if (!student) return { error: "Forbidden", status: 403 as const };
  const first = await prisma.attempt.findUnique({
    where: { testId_studentId: { testId: test.id, studentId: student.id } },
    select: { id: true, status: true },
  });
  if (!first || first.status === "IN_PROGRESS") {
    return { error: "Submit your first attempt before re-attempting.", status: 409 as const };
  }
  if (!areResultsReleased(test)) {
    return { error: "Re-attempt opens when the results are out.", status: 409 as const };
  }
  return { test, student, first };
}

/** Grades a re-attempt (same marking as the first attempt) and closes it. */
export async function finalizeReattempt(reattemptId: string, isLate: boolean) {
  const re = await prisma.testReattempt.findUnique({ where: { id: reattemptId } });
  if (!re || re.status !== "IN_PROGRESS") return re;
  const analysis = await analyseReattempt(re);
  return prisma.testReattempt.update({
    where: { id: re.id },
    data: { status: isLate ? "AUTO_SUBMITTED" : "SUBMITTED", submittedAt: new Date(), score: analysis?.score ?? 0 },
  });
}

/** The full result analysis of a re-attempt, computed in memory (never stored or ranked). */
export async function analyseReattempt(re: {
  id: string;
  testId: string;
  studentId: string;
  submittedAt: Date | null;
  answers: unknown;
}) {
  const [test, student] = await Promise.all([
    prisma.test.findUnique({
      where: { id: re.testId },
      include: {
        sections: {
          orderBy: { order: "asc" },
          include: {
            questions: {
              orderBy: { order: "asc" },
              include: { question: { include: { translations: true, assets: { orderBy: { order: "asc" } } } } },
            },
          },
        },
      },
    }),
    prisma.student.findUnique({
      where: { id: re.studentId },
      select: { id: true, targetExam: true, user: { select: { name: true } } },
    }),
  ]);
  if (!test) return null;
  const answers = Object.entries(reattemptAnswers(re.answers)).map(([questionId, option]) => ({
    questionId,
    selectedOptionIds: [option],
    timeTakenSec: 0,
  }));
  const input = {
    id: re.id,
    studentId: re.studentId,
    submittedAt: re.submittedAt,
    student,
    test,
    answers,
  } as unknown as AttemptForAnalysis;
  return analyseAttempt(input, { persist: false });
}
