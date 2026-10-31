import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/rbac/super-admin";
import { studentAttemptReview, studentGuruQuizReview } from "@/lib/performance/students";
import { formatISTDate, formatISTTime } from "@/lib/date-utils";
import { FormulaText } from "@/components/test-portal/FormulaText";

export const metadata: Metadata = { title: "Attempt review" };
export const dynamic = "force-dynamic";

const RESULT = {
  CORRECT: { label: "Correct", cls: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  WRONG: { label: "Wrong", cls: "bg-rose-100 text-rose-800 border-rose-300" },
  NOT_ANSWERED: { label: "Not answered", cls: "bg-slate-100 text-slate-700 border-slate-300" },
  UNCHECKED: { label: "Answered (not checked)", cls: "bg-amber-100 text-amber-800 border-amber-300" },
} as const;

/**
 * One DPP / test / Atomic Guru quiz of a student, question by question: what
 * they chose, the right answer, right / wrong / not answered, time and the
 * solution. Super Admin only, like the rest of student performance.
 */
export default async function AttemptReviewPage({ params }: { params: { id: string; kind: string; attemptId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (!(await isSuperAdmin(session.user.id))) redirect("/team");

  const data =
    params.kind === "guru"
      ? await studentGuruQuizReview(params.id, params.attemptId)
      : params.kind === "attempt"
      ? await studentAttemptReview(params.id, params.attemptId)
      : null;
  if (!data) notFound();

  const { summary } = data;
  const accuracy = summary.correct + summary.wrong > 0 ? Math.round((summary.correct / (summary.correct + summary.wrong)) * 100) : null;
  const cards = [
    { label: "Questions", value: summary.total },
    { label: "Correct", value: summary.correct, cls: "text-emerald-600" },
    { label: "Wrong", value: summary.wrong, cls: "text-rose-600" },
    { label: "Not answered", value: summary.notAnswered },
    { label: "Correct %", value: summary.total ? `${Math.round((summary.correct / summary.total) * 100)}%` : "—" },
    { label: "Accuracy (of answered)", value: accuracy !== null ? `${accuracy}%` : "—" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/team/performance/students/${data.student.id}`} className="text-xs font-bold text-primary">
          ← {data.student.name}
        </Link>
        <h1 className="font-headline-lg text-headline-lg text-on-surface font-black mt-1">
          <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary mr-2 align-middle">
            {data.kind === "GURU" ? "ATOMIC GURU" : data.kind}
          </span>
          {data.title}
        </h1>
        <p className="text-sm text-on-surface-variant">
          {data.student.code}
          {data.status ? ` · ${data.status}` : ""}
          {data.score !== null && data.score !== undefined ? ` · score ${data.score}` : ""}
          {data.date ? ` · ${formatISTDate(data.date)} ${formatISTTime(data.date)}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="glass-card rounded-xl border border-outline-variant/30 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">{c.label}</p>
            <p className={`text-lg font-black tabular-nums mt-1 ${c.cls ?? "text-on-surface"}`}>{c.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {data.rows.map((r) => (
          <a
            key={r.questionId}
            href={`#q${r.number}`}
            className={`w-8 h-8 rounded-lg border flex items-center justify-center font-bold ${RESULT[r.result].cls}`}
            title={RESULT[r.result].label}
          >
            {r.number}
          </a>
        ))}
      </div>

      <div className="space-y-3">
        {data.rows.map((r) => (
          <section key={r.questionId} id={`q${r.number}`} className="glass-card rounded-2xl border border-outline-variant/30 p-4 space-y-3 scroll-mt-20">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-bold text-on-surface">Q{r.number}.</p>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] text-on-surface-variant">{r.timeSec ? `${r.timeSec}s` : ""}</span>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${RESULT[r.result].cls}`}>{RESULT[r.result].label}</span>
              </div>
            </div>
            <FormulaText text={r.statement} className="block text-sm text-on-surface" />
            {r.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.imageUrl} alt="" className="max-h-64 rounded-lg border border-outline-variant/30" />
            )}
            {r.options.length > 0 && (
              <ul className="space-y-1.5">
                {r.options.map((o) => {
                  const right = r.correctOptionIds.includes(o.id);
                  const chosen = r.chosenOptionIds.includes(o.id);
                  return (
                    <li
                      key={o.id}
                      className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${
                        right ? "border-emerald-400 bg-emerald-50" : chosen ? "border-rose-400 bg-rose-50" : "border-outline-variant/30"
                      }`}
                    >
                      <span className="font-bold shrink-0 w-5">{o.id}.</span>
                      <FormulaText text={o.text} className="flex-1" />
                      {chosen && <span className="shrink-0 text-[10px] font-bold text-slate-700">Student&apos;s answer</span>}
                      {right && <span className="shrink-0 text-[10px] font-bold text-emerald-700">✓ Right answer</span>}
                    </li>
                  );
                })}
              </ul>
            )}
            {r.solution && (
              <details className="text-sm">
                <summary className="cursor-pointer text-xs font-bold text-primary">Solution</summary>
                <FormulaText text={r.solution} className="block mt-2 text-on-surface-variant" />
              </details>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
