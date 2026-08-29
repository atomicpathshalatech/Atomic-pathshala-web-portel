import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { canManageTest } from "@/lib/test-engine/access";
import { computeAttemptCounts } from "@/lib/test-engine/scoring";
import { TestQuestionPicker } from "@/components/team-portal/TestQuestionPicker";
import { PublishTestButton } from "@/components/team-portal/PublishTestButton";

export const metadata: Metadata = {
  title: "Test Detail",
};

function questionStatement(translations: { language: string; statement: string }[]) {
  return translations.find((t) => t.language === "ENGLISH")?.statement ?? translations[0]?.statement ?? "";
}

export default async function TestDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canRead = await hasPermission(session.user.id, PERMISSIONS.TEST_READ);
  if (!canRead) redirect("/team");

  const test = await prisma.test.findUnique({
    where: { id: params.id },
    include: {
      batchSchedule: { include: { batch: { select: { id: true, name: true } } } },
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

  const manageable = await canManageTest(session.user.id, test.batchScheduleId);
  if (!manageable) redirect("/team/tests");

  const canPublish = await hasPermission(session.user.id, PERMISSIONS.TEST_PUBLISH);
  const isDraft = test.status === "DRAFT";

  const sectionQuestions = test.sections.flatMap((s) => s.questions.map((sq) => ({ ...sq, section: s })));
  const totalMarks = sectionQuestions.reduce(
    (sum, sq) => sum + (sq.marksOverride ?? sq.section.marksPerQuestion ?? test.correctMarks),
    0
  );

  const results =
    test.status !== "DRAFT"
      ? await prisma.attempt.findMany({
          where: { testId: test.id, status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } },
          include: { student: { include: { user: true } }, answers: true },
          orderBy: [{ score: "desc" }, { submittedAt: "asc" }],
        })
      : [];

  return (
    <div className="space-y-stack-lg max-w-4xl">
      <div>
        <p className="flex items-center gap-2 text-label-sm text-on-surface-variant mb-2">
          <Link href="/team/tests" className="hover:text-primary">
            Tests
          </Link>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span className="text-primary">{test.name}</span>
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface">{test.name}</h1>
            <p className="text-label-sm text-on-surface-variant mt-1">
              {test.batchSchedule && `${test.batchSchedule.batch.name} · `}
              {test.durationMin} min · {totalMarks} marks
              {test.batchSchedule &&
                ` · ${new Date(test.batchSchedule.startsAt).toLocaleString()} — ${new Date(
                  test.batchSchedule.endsAt
                ).toLocaleString()}`}
            </p>
          </div>
          {isDraft && canPublish && <PublishTestButton testId={test.id} />}
        </div>
        {test.instructions && (
          <p className="text-body-md text-on-surface-variant mt-3 max-w-2xl">{test.instructions}</p>
        )}
      </div>

      <section className="glass-card rounded-2xl p-6">
        <TestQuestionPicker
          testId={test.id}
          editable={isDraft}
          current={sectionQuestions.map((sq) => ({
            id: sq.id,
            order: sq.order,
            question: {
              id: sq.question.id,
              statement: questionStatement(sq.question.translations),
            },
          }))}
        />
      </section>

      {test.status !== "DRAFT" && (
        <section className="glass-card rounded-2xl p-6 space-y-4">
          <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">leaderboard</span>
            Results ({results.length} submitted)
          </h2>
          {results.length === 0 ? (
            <p className="text-label-sm text-on-surface-variant">No submissions yet.</p>
          ) : (
            <ul className="space-y-2">
              {results.map((r, i) => {
                const counts = computeAttemptCounts(r.answers, sectionQuestions.length);
                return (
                  <li
                    key={r.id}
                    className="flex items-center justify-between bg-surface-container-lowest rounded-lg px-3 py-2"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-label-sm font-bold text-primary w-6">#{i + 1}</span>
                      <div>
                        <p className="font-label-md text-label-md text-on-surface">{r.student.user.name}</p>
                        <p className="text-label-sm text-on-surface-variant">
                          {r.student.enrollmentNumber} · {counts.correctCount} correct ·{" "}
                          {counts.incorrectCount} incorrect · {counts.unattemptedCount} unattempted
                          {r.status === "AUTO_SUBMITTED" ? " · auto-submitted" : ""}
                        </p>
                      </div>
                    </div>
                    <span className="font-headline-md text-headline-md text-primary">{r.score ?? 0}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
