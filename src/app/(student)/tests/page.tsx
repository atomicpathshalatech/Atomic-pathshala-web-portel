import type { Metadata } from "next";
import Link from "next/link";
import { requireStudentSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

export const metadata: Metadata = {
  title: "Test Series",
};

function statusOf(now: Date, startsAt: Date, endsAt: Date, myAttempt: { status: string; score: number | null } | null) {
  if (myAttempt) {
    if (myAttempt.status === "IN_PROGRESS") return { label: "In Progress", tone: "bg-secondary/10 text-secondary" };
    return { label: `Submitted · ${myAttempt.score ?? 0} marks`, tone: "bg-primary/10 text-primary" };
  }
  if (now < startsAt) return { label: "Opens soon", tone: "bg-surface-container-high text-on-surface-variant" };
  if (now > endsAt) return { label: "Closed", tone: "bg-outline-variant/30 text-on-surface-variant" };
  return { label: "Open now", tone: "bg-error/10 text-error" };
}

export default async function StudentTestsPage() {
  const { student } = await requireStudentSession();

  const enrollments = await prisma.batchEnrollment.findMany({
    where: { studentId: student.id, status: "ACTIVE" },
    select: { batchId: true },
  });
  const batchIds = enrollments.map((e) => e.batchId);

  const tests =
    batchIds.length === 0
      ? []
      : await prisma.test.findMany({
          where: { status: "PUBLISHED", batchSchedule: { batchId: { in: batchIds } } },
          include: {
            batchSchedule: { include: { batch: { select: { name: true } } } },
            _count: { select: { questions: true } },
            attempts: { where: { studentId: student.id }, select: { status: true, score: true } },
          },
          orderBy: { batchSchedule: { startsAt: "asc" } },
        });

  const now = new Date();

  return (
    <div className="space-y-stack-lg max-w-5xl">
      <header>
        <p className="flex items-center gap-2 text-label-sm text-on-surface-variant mb-2">
          <span>My Courses</span>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span className="text-primary">Test Series</span>
        </p>
        <h1 className="font-display-lg text-display-lg-mobile md:text-display-lg text-on-surface">
          Test Series
        </h1>
        <p className="text-body-lg text-on-surface-variant mt-2">
          Timed mock tests from your batches — attempts and scoring happen server-side, so the
          clock keeps running even if you close the tab.
        </p>
      </header>

      {tests.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center text-on-surface-variant font-body-md">
          No tests published for your batches yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {tests.map((t) => {
            const myAttempt = t.attempts[0] ?? null;
            const s = statusOf(now, t.batchSchedule.startsAt, t.batchSchedule.endsAt, myAttempt);
            const canAttempt =
              !myAttempt && now >= t.batchSchedule.startsAt && now <= t.batchSchedule.endsAt;
            const canResume = myAttempt?.status === "IN_PROGRESS" && now <= t.batchSchedule.endsAt;
            const canViewResult = myAttempt && myAttempt.status !== "IN_PROGRESS";

            return (
              <li key={t.id} className="glass-card rounded-xl p-stack-md">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${s.tone}`}>
                        {s.label}
                      </span>
                      <span className="text-label-sm text-on-surface-variant">{t.batchSchedule.batch.name}</span>
                    </div>
                    <h3 className="font-headline-md text-headline-md text-on-surface mb-2">{t.title}</h3>
                    <div className="flex flex-wrap gap-4 text-label-md text-on-surface-variant">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-lg">assignment</span>
                        {t._count.questions} question{t._count.questions === 1 ? "" : "s"}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-lg">timer</span>
                        {t.durationMin} min
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-lg">event</span>
                        {t.batchSchedule.startsAt.toLocaleString()} — {t.batchSchedule.endsAt.toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 w-full md:w-auto">
                    {canAttempt || canResume ? (
                      <Link
                        href={`/tests/${t.id}/attempt`}
                        className="block text-center w-full md:w-auto px-6 py-2 bg-primary text-on-primary font-label-md rounded-lg hover:opacity-90 transition-all"
                      >
                        {canResume ? "Resume Test" : "Start Test"}
                      </Link>
                    ) : canViewResult ? (
                      <Link
                        href={`/tests/${t.id}/result`}
                        className="block text-center w-full md:w-auto px-6 py-2 border-2 border-primary text-primary font-label-md rounded-lg hover:bg-primary/5 transition-all"
                      >
                        View Result
                      </Link>
                    ) : (
                      <button
                        disabled
                        className="w-full md:w-auto px-6 py-2 bg-surface-container-high text-on-surface font-label-md rounded-lg opacity-70 cursor-not-allowed"
                      >
                        {now < t.batchSchedule.startsAt ? "Opens Soon" : "Closed"}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
