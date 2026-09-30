import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/rbac/super-admin";
import { teacherBoard, staffBoard } from "@/lib/performance/team";
import { listStudentPerformance } from "@/lib/performance/students";
import { formatTeachingTime } from "@/lib/teaching/stats";
import { formatISTDate } from "@/lib/date-utils";

export const metadata: Metadata = { title: "Performance Boards" };
export const dynamic = "force-dynamic";

type Tab = "teachers" | "staff" | "students";
type Period = "all" | "30d" | "month";

const PERIODS: { id: Period; label: string }[] = [
  { id: "all", label: "All time" },
  { id: "month", label: "This month" },
  { id: "30d", label: "Last 30 days" },
];

function periodRange(p: Period): { from?: Date } {
  if (p === "30d") return { from: new Date(Date.now() - 30 * 86_400_000) };
  if (p === "month") {
    // Month start in IST.
    const ist = new Date(Date.now() + 5.5 * 3_600_000);
    return { from: new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - 5.5 * 3_600_000) };
  }
  return {};
}

const n = (v: number) => v.toLocaleString("en-IN");
const when = (d: Date | null) => (d ? formatISTDate(d) : "—");
const th = "px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-on-surface-variant whitespace-nowrap";
const td = "px-3 py-2.5 text-xs text-on-surface whitespace-nowrap tabular-nums";

export default async function PerformancePage({ searchParams }: { searchParams: { tab?: string; q?: string; page?: string; period?: string; refreshed?: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (!(await isSuperAdmin(session.user.id))) redirect("/team");

  const tab: Tab = searchParams.tab === "staff" || searchParams.tab === "students" ? searchParams.tab : "teachers";
  const period: Period = searchParams.period === "30d" || searchParams.period === "month" ? searchParams.period : "all";
  const page = Math.max(1, Number(searchParams.page) || 1);
  const q = searchParams.q?.trim() ?? "";
  const link = (over: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const merged = { tab, period, q, ...over };
    for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== "" && !(k === "period" && v === "all")) p.set(k, String(v));
    return `/team/performance?${p.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-black">Performance Boards</h1>
          <p className="text-sm text-on-surface-variant mt-1">What people actually did — taught, watched, attempted. Super Admin only.</p>
        </div>
        {tab === "teachers" && (
          <form method="post" action="/api/team/performance/refresh-youtube">
            <button type="submit" className="px-4 py-2 rounded-xl border border-outline-variant/40 text-xs font-bold text-on-surface hover:bg-surface-container-high flex items-center gap-1.5">
              <span className="material-symbols-outlined text-base">sync</span>
              Refresh YouTube numbers
            </button>
          </form>
        )}
      </div>
      {searchParams.refreshed && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
          {searchParams.refreshed === "fail" ? "Couldn't reach YouTube — numbers are from the last daily refresh." : `YouTube numbers refreshed (${searchParams.refreshed} videos).`}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {(["teachers", "staff", "students"] as Tab[]).map((t) => (
          <Link
            key={t}
            href={link({ tab: t, page: undefined })}
            className={`px-4 py-2 rounded-xl text-xs font-bold capitalize ${tab === t ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface"}`}
          >
            {t === "staff" ? "Other staff" : t}
          </Link>
        ))}
        {tab === "teachers" && (
          <span className="ml-auto flex gap-1">
            {PERIODS.map((p) => (
              <Link key={p.id} href={link({ period: p.id })} className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold ${period === p.id ? "bg-primary/15 text-primary" : "text-on-surface-variant"}`}>
                {p.label}
              </Link>
            ))}
          </span>
        )}
      </div>

      {tab === "teachers" && <TeachersTable period={period} />}
      {tab === "staff" && <StaffTable />}
      {tab === "students" && <StudentsTable q={q} page={page} link={link} />}
    </div>
  );
}

async function TeachersTable({ period }: { period: Period }) {
  const rows = await teacherBoard(periodRange(period));
  const pending = rows.reduce((s, r) => s + r.youtubePending, 0);
  return (
    <section className="glass-card rounded-2xl border border-outline-variant/30 overflow-hidden">
      <div className="px-4 py-3 border-b border-outline-variant/20 text-[11px] text-on-surface-variant space-y-0.5">
        <p>
          <b>Teaching time</b> = app classes from their real start to real end + recorded YouTube classes by the video&apos;s real length. Scheduled time is never counted.
        </p>
        <p>
          <b>Views</b> = YouTube views of their class videos (plays inside the app are included by YouTube) + app views of classes that didn&apos;t use YouTube.
          {pending > 0 && ` ${pending} YouTube class(es) are waiting for their length from YouTube (refreshed daily).`}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-surface-container-high/40">
            <tr>
              <th className={th}>Teacher</th>
              <th className={th}>Teaching time</th>
              <th className={th}>App</th>
              <th className={th}>YouTube</th>
              <th className={th}>Classes taught</th>
              <th className={th}>Scheduled / cancelled</th>
              <th className={th}>Views (YT + app)</th>
              <th className={th}>Students present</th>
              <th className={th}>DPPs / tests made</th>
              <th className={th}>Doubts solved</th>
              <th className={th}>Last login</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/15">
            {rows.map((r) => (
              <tr key={r.teacherId}>
                <td className={td}>
                  <p className="font-bold">{r.name}</p>
                  <p className="text-[10px] text-on-surface-variant">{r.department ?? "—"} · {r.employeeCode ?? "—"}</p>
                </td>
                <td className={`${td} font-black text-primary`}>{formatTeachingTime(r.totalMinutes)}</td>
                <td className={td}>{formatTeachingTime(r.appMinutes)}</td>
                <td className={td}>
                  {formatTeachingTime(r.youtubeMinutes)}
                  {r.youtubePending > 0 && <span className="text-[10px] text-amber-600"> (+{r.youtubePending} pending)</span>}
                </td>
                <td className={td}>{n(r.appClasses + r.youtubeClasses)}</td>
                <td className={td}>
                  {n(r.classesScheduled)} / {n(r.classesCancelled)}
                </td>
                <td className={td}>
                  <span className="font-bold">{n(r.totalViews)}</span>
                  <span className="text-[10px] text-on-surface-variant"> ({n(r.youtubeViews)} + {n(r.appViews)})</span>
                </td>
                <td className={td}>{n(r.studentsPresent)}</td>
                <td className={td}>
                  {n(r.dppsCreated)} / {n(r.testsCreated)}
                </td>
                <td className={td}>{n(r.doubtsSolved)}</td>
                <td className={td}>{when(r.lastLoginAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

async function StaffTable() {
  const rows = await staffBoard();
  return (
    <section className="glass-card rounded-2xl border border-outline-variant/30 overflow-hidden">
      <p className="px-4 py-3 border-b border-outline-variant/20 text-[11px] text-on-surface-variant">
        Everyone on the team who isn&apos;t a teacher. Work = actions they performed in the portal (from the audit trail); tell us any role-specific numbers you want here (leads, admissions, tickets…).
      </p>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-surface-container-high/40">
            <tr>
              <th className={th}>Name</th>
              <th className={th}>Role</th>
              <th className={th}>Status</th>
              <th className={th}>Actions (30 days)</th>
              <th className={th}>Actions (all time)</th>
              <th className={th}>Mostly worked on (30 days)</th>
              <th className={th}>Last action</th>
              <th className={th}>Last login</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/15">
            {rows.map((r) => (
              <tr key={r.userId}>
                <td className={td}>
                  <p className="font-bold">{r.name}</p>
                  <p className="text-[10px] text-on-surface-variant">{r.email}</p>
                </td>
                <td className={td}>{r.role.replace(/_/g, " ")}</td>
                <td className={td}>{r.status}</td>
                <td className={`${td} font-bold`}>{n(r.actions30d)}</td>
                <td className={td}>{n(r.actionsTotal)}</td>
                <td className={td}>{r.topWork.length ? r.topWork.map((w) => `${w.entityType} (${w.count})`).join(", ") : "—"}</td>
                <td className={td}>{when(r.lastActionAt)}</td>
                <td className={td}>{when(r.lastLoginAt)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className={td} colSpan={8}>
                  No other staff accounts.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

const PAGE_SIZE = 50;

async function StudentsTable({ q, page, link }: { q: string; page: number; link: (o: Record<string, string | number | undefined>) => string }) {
  const { total, rows } = await listStudentPerformance({ search: q, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <section className="glass-card rounded-2xl border border-outline-variant/30 overflow-hidden">
      <form method="get" action="/team/performance" className="px-4 py-3 border-b border-outline-variant/20 flex flex-wrap gap-2 items-center">
        <input type="hidden" name="tab" value="students" />
        <input
          name="q"
          defaultValue={q}
          placeholder="Search name, email, student ID…"
          className="flex-1 min-w-[200px] rounded-xl border border-outline-variant/40 bg-surface-container-lowest py-2 px-3 text-xs outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button type="submit" className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold">
          Search
        </button>
        <span className="text-[11px] text-on-surface-variant">{n(total)} students</span>
      </form>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-surface-container-high/40">
            <tr>
              <th className={th}>Student</th>
              <th className={th}>Batch</th>
              <th className={th}>DPPs</th>
              <th className={th}>Tests</th>
              <th className={th}>Questions done (correct)</th>
              <th className={th}>Live classes</th>
              <th className={th}>Live time</th>
              <th className={th}>Recorded watched</th>
              <th className={th}>Lectures completed</th>
              <th className={th}>Last active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/15">
            {rows.map((r) => (
              <tr key={r.studentId} className="hover:bg-surface-container-high/30">
                <td className={td}>
                  <Link href={`/team/performance/students/${r.studentId}`} className="font-bold text-primary hover:underline">
                    {r.name}
                  </Link>
                  <p className="text-[10px] text-on-surface-variant">{r.code}</p>
                </td>
                <td className={td}>{r.batches.join(", ") || "—"}</td>
                <td className={td}>{n(r.dppsAttempted)}</td>
                <td className={td}>{n(r.testsAttempted)}</td>
                <td className={td}>
                  {n(r.questionsAnswered)} <span className="text-[10px] text-on-surface-variant">({n(r.questionsCorrect)})</span>
                </td>
                <td className={td}>{n(r.liveClasses)}</td>
                <td className={td}>{formatTeachingTime(r.liveMinutes)}</td>
                <td className={td}>{formatTeachingTime(r.recordedMinutes)}</td>
                <td className={td}>{n(r.lecturesCompleted)}</td>
                <td className={td}>{when(r.lastActiveAt)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className={td} colSpan={10}>
                  No students found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="px-4 py-3 border-t border-outline-variant/20 flex items-center gap-3 text-xs">
          {page > 1 && <Link href={link({ page: page - 1 })} className="font-bold text-primary">← Previous</Link>}
          <span className="text-on-surface-variant">
            Page {page} of {pages}
          </span>
          {page < pages && <Link href={link({ page: page + 1 })} className="font-bold text-primary">Next →</Link>}
        </div>
      )}
    </section>
  );
}
