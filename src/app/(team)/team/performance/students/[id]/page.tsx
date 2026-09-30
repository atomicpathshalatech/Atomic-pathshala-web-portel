import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/rbac/super-admin";
import { studentPerformanceDetail } from "@/lib/performance/students";
import { formatTeachingTime } from "@/lib/teaching/stats";
import { formatISTDate, formatISTTime } from "@/lib/date-utils";

export const metadata: Metadata = { title: "Student Performance" };
export const dynamic = "force-dynamic";

const th = "px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-on-surface-variant whitespace-nowrap";
const td = "px-3 py-2.5 text-xs text-on-surface whitespace-nowrap tabular-nums";
const dt = (d: Date | null | undefined) => (d ? `${formatISTDate(d)} ${formatISTTime(d)}` : "—");

export default async function StudentPerformancePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (!(await isSuperAdmin(session.user.id))) redirect("/team");

  const data = await studentPerformanceDetail(params.id);
  if (!data) notFound();
  const { student, totals, practice, liveClasses, recorded } = data;

  const cards = [
    { label: "DPPs attempted", value: totals.dpps },
    { label: "Tests attempted", value: totals.tests },
    { label: "Questions answered", value: totals.questionsAnswered },
    { label: "Questions left", value: totals.questionsLeft },
    { label: "Correct / wrong", value: `${totals.correct} / ${totals.wrong}` },
    { label: "Live classes", value: `${totals.liveClasses} · ${formatTeachingTime(totals.liveMinutes)}` },
    { label: "Recorded watched", value: formatTeachingTime(totals.recordedMinutes) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/team/performance?tab=students" className="text-xs font-bold text-primary">
          ← All students
        </Link>
        <h1 className="font-headline-lg text-headline-lg text-on-surface font-black mt-1">{student.name}</h1>
        <p className="text-sm text-on-surface-variant">
          {student.code} · {student.email} · {student.batches.map((b) => `${b.name}${b.status === "ACTIVE" ? "" : ` (${b.status.toLowerCase()})`}`).join(", ") || "No batch"} · last login {dt(student.lastLoginAt)}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="glass-card rounded-xl border border-outline-variant/30 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">{c.label}</p>
            <p className="text-lg font-black text-on-surface tabular-nums mt-1">{c.value}</p>
          </div>
        ))}
      </div>

      <Section title="DPPs & tests" empty={practice.length === 0 ? "No DPP or test attempted yet." : null}>
        <table className="min-w-full">
          <thead className="bg-surface-container-high/40">
            <tr>
              <th className={th}>DPP / test</th>
              <th className={th}>Subject · chapter</th>
              <th className={th}>Status</th>
              <th className={th}>Questions</th>
              <th className={th}>Answered</th>
              <th className={th}>Left</th>
              <th className={th}>Correct</th>
              <th className={th}>Wrong</th>
              <th className={th}>Score</th>
              <th className={th}>Time spent</th>
              <th className={th}>When</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/15">
            {practice.map((p, i) => (
              <tr key={i}>
                <td className={td}>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary mr-1.5">{p.kind}</span>
                  <span className="font-semibold">{p.title}</span>
                </td>
                <td className={td}>{[p.subject, p.chapter].filter(Boolean).join(" · ") || "—"}</td>
                <td className={td}>{p.status === "IN_PROGRESS" ? "Not submitted" : "Submitted"}</td>
                <td className={td}>{p.totalQuestions}</td>
                <td className={`${td} font-bold`}>{p.answered}</td>
                <td className={td}>{p.notAnswered}</td>
                <td className={`${td} text-emerald-600`}>{p.correct}</td>
                <td className={`${td} text-rose-600`}>{p.wrong}</td>
                <td className={td}>{p.score ?? "—"}</td>
                <td className={td}>{formatTeachingTime(Math.round(p.timeSec / 60))}</td>
                <td className={td}>{dt(p.submittedAt ?? p.startedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Live classes attended" empty={liveClasses.length === 0 ? "Hasn't joined a live class yet." : null}>
        <table className="min-w-full">
          <thead className="bg-surface-container-high/40">
            <tr>
              <th className={th}>Class</th>
              <th className={th}>Subject</th>
              <th className={th}>Date</th>
              <th className={th}>Time present</th>
              <th className={th}>Class length</th>
              <th className={th}>Interactions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/15">
            {liveClasses.map((l, i) => (
              <tr key={i}>
                <td className={`${td} font-semibold`}>{l.title}</td>
                <td className={td}>{l.subject ?? "—"}</td>
                <td className={td}>{dt(l.date)}</td>
                <td className={`${td} font-bold`}>{formatTeachingTime(l.minutesPresent)}</td>
                <td className={td}>{l.classMinutes !== null ? formatTeachingTime(l.classMinutes) : "—"}</td>
                <td className={td}>{l.interactions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="Recorded classes watched" empty={recorded.length === 0 ? "No recorded class watched yet (tracking started with this update)." : null}>
        <table className="min-w-full">
          <thead className="bg-surface-container-high/40">
            <tr>
              <th className={th}>Class</th>
              <th className={th}>Subject · chapter</th>
              <th className={th}>Watched</th>
              <th className={th}>Video length</th>
              <th className={th}>% watched</th>
              <th className={th}>First watched</th>
              <th className={th}>Last watched</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/15">
            {recorded.map((r, i) => (
              <tr key={i}>
                <td className={`${td} font-semibold`}>{r.title}</td>
                <td className={td}>{[r.subject, r.chapter].filter(Boolean).join(" · ") || "—"}</td>
                <td className={`${td} font-bold`}>{formatTeachingTime(r.minutesWatched)}</td>
                <td className={td}>{r.videoMinutes !== null ? formatTeachingTime(r.videoMinutes) : "—"}</td>
                <td className={td}>{r.percent !== null ? `${r.percent}%` : "—"}</td>
                <td className={td}>{dt(r.firstWatchedAt)}</td>
                <td className={td}>{dt(r.lastWatchedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}

function Section({ title, empty, children }: { title: string; empty: string | null; children: React.ReactNode }) {
  return (
    <section className="glass-card rounded-2xl border border-outline-variant/30 overflow-hidden">
      <h2 className="px-4 py-3 border-b border-outline-variant/20 text-sm font-bold text-on-surface">{title}</h2>
      {empty ? <p className="px-4 py-4 text-xs text-on-surface-variant">{empty}</p> : <div className="overflow-x-auto">{children}</div>}
    </section>
  );
}
