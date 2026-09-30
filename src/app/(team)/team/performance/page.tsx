import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/rbac/super-admin";
import { teacherBoard, staffBoard, type StaffBoardRow, type TeacherBoardRow } from "@/lib/performance/team";
import { batchOptions, listStudentPerformance, STUDENT_SORT } from "@/lib/performance/students";
import { pickDir, pickSort, sortRows, type ActivityFilter, type SortDir, type SortSpec } from "@/lib/performance/sort";
import { formatTeachingTime } from "@/lib/teaching/stats";
import { formatISTDate } from "@/lib/date-utils";

export const metadata: Metadata = { title: "Performance Boards" };
export const dynamic = "force-dynamic";

type Tab = "teachers" | "staff" | "students";
type Period = "all" | "30d" | "month";
type Params = { tab?: string; q?: string; page?: string; period?: string; refreshed?: string; sort?: string; dir?: string; dept?: string; role?: string; batch?: string; activity?: string };
type LinkFn = (over: Record<string, string | number | undefined>) => string;

const PERIODS: { id: Period; label: string }[] = [
  { id: "all", label: "All time" },
  { id: "month", label: "This month" },
  { id: "30d", label: "Last 30 days" },
];
const ACTIVITY: { id: ActivityFilter; label: string }[] = [
  { id: "all", label: "Everyone" },
  { id: "7d", label: "Active in last 7 days" },
  { id: "inactive7", label: "Inactive 7+ days" },
  { id: "never", label: "Never active" },
];
/** Columns that read best A→Z (text); everything else starts high→low. */
const TEXT_COLUMNS = new Set(["name", "role", "batch", "department"]);

function periodRange(p: Period): { from?: Date } {
  if (p === "30d") return { from: new Date(Date.now() - 30 * 86_400_000) };
  if (p === "month") {
    const ist = new Date(Date.now() + 5.5 * 3_600_000);
    return { from: new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - 5.5 * 3_600_000) };
  }
  return {};
}

const n = (v: number) => v.toLocaleString("en-IN");
const when = (d: Date | null) => (d ? formatISTDate(d) : "—");
const th = "px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-on-surface-variant whitespace-nowrap";
const td = "px-3 py-2.5 text-xs text-on-surface whitespace-nowrap tabular-nums";
const input = "rounded-xl border border-outline-variant/40 bg-surface-container-lowest py-2 px-3 text-xs outline-none focus:ring-2 focus:ring-primary/30";

const TEACHER_SORT: SortSpec<TeacherBoardRow> = {
  name: (r) => r.name,
  department: (r) => r.department,
  total: (r) => r.totalMinutes,
  app: (r) => r.appMinutes,
  youtube: (r) => r.youtubeMinutes,
  classes: (r) => r.appClasses + r.youtubeClasses,
  scheduled: (r) => r.classesScheduled,
  cancelled: (r) => r.classesCancelled,
  views: (r) => r.totalViews,
  present: (r) => r.studentsPresent,
  made: (r) => r.dppsCreated + r.testsCreated,
  doubts: (r) => r.doubtsSolved,
  lastLogin: (r) => r.lastLoginAt,
};
const STAFF_SORT: SortSpec<StaffBoardRow> = {
  name: (r) => r.name,
  role: (r) => r.role,
  actions30d: (r) => r.actions30d,
  actionsTotal: (r) => r.actionsTotal,
  lastAction: (r) => r.lastActionAt,
  lastLogin: (r) => r.lastLoginAt,
};

export default async function PerformancePage({ searchParams }: { searchParams: Params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (!(await isSuperAdmin(session.user.id))) redirect("/team");

  const tab: Tab = searchParams.tab === "staff" || searchParams.tab === "students" ? searchParams.tab : "teachers";
  const period: Period = searchParams.period === "30d" || searchParams.period === "month" ? searchParams.period : "all";
  const page = Math.max(1, Number(searchParams.page) || 1);
  const q = searchParams.q?.trim() ?? "";
  const keep: Record<string, string | undefined> = {
    tab,
    q: q || undefined,
    period: period === "all" ? undefined : period,
    sort: searchParams.sort,
    dir: searchParams.dir,
    dept: searchParams.dept,
    role: searchParams.role,
    batch: searchParams.batch,
    activity: searchParams.activity,
  };
  const link: LinkFn = (over) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...keep, ...over })) if (v !== undefined && v !== "") p.set(k, String(v));
    return `/team/performance?${p.toString()}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface font-black">Performance Boards</h1>
          <p className="text-sm text-on-surface-variant mt-1">What people actually did — taught, watched, attempted. Click any column heading to sort (click again to flip). Super Admin only.</p>
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
            href={`/team/performance?tab=${t}`}
            className={`px-4 py-2 rounded-xl text-xs font-bold capitalize ${tab === t ? "bg-primary text-on-primary" : "bg-surface-container-high text-on-surface"}`}
          >
            {t === "staff" ? "Other staff" : t}
          </Link>
        ))}
      </div>

      {tab === "teachers" && <TeachersTable params={searchParams} period={period} q={q} link={link} />}
      {tab === "staff" && <StaffTable params={searchParams} q={q} link={link} />}
      {tab === "students" && <StudentsTable params={searchParams} q={q} page={page} link={link} />}
    </div>
  );
}

/** A column heading that sorts the table (and flips on a second click). */
function SortHeader({ label, col, sort, dir, link }: { label: string; col: string; sort: string; dir: SortDir; link: LinkFn }) {
  const active = sort === col;
  const nextDir: SortDir = active ? (dir === "desc" ? "asc" : "desc") : TEXT_COLUMNS.has(col) ? "asc" : "desc";
  return (
    <th className={th}>
      <Link href={link({ sort: col, dir: nextDir, page: undefined })} className={`inline-flex items-center gap-0.5 hover:text-primary ${active ? "text-primary" : ""}`}>
        {label}
        <span className="material-symbols-outlined text-[14px]">{active ? (dir === "desc" ? "arrow_downward" : "arrow_upward") : "unfold_more"}</span>
      </Link>
    </th>
  );
}

/** GET form that keeps the current tab + sort while changing filters. */
function FilterForm({ tab, params, children }: { tab: Tab; params: Params; children: React.ReactNode }) {
  return (
    <form method="get" action="/team/performance" className="px-4 py-3 border-b border-outline-variant/20 flex flex-wrap gap-2 items-center">
      <input type="hidden" name="tab" value={tab} />
      {params.sort && <input type="hidden" name="sort" value={params.sort} />}
      {params.dir && <input type="hidden" name="dir" value={params.dir} />}
      {children}
      <button type="submit" className="px-4 py-2 rounded-xl bg-primary text-on-primary text-xs font-bold">
        Apply
      </button>
      <Link href={`/team/performance?tab=${tab}`} className="px-3 py-2 text-xs font-semibold text-on-surface-variant hover:text-on-surface">
        Clear
      </Link>
    </form>
  );
}

async function TeachersTable({ params, period, q, link }: { params: Params; period: Period; q: string; link: LinkFn }) {
  const all = await teacherBoard(periodRange(period));
  const departments = Array.from(new Set(all.map((r) => r.department).filter((d): d is string => Boolean(d)))).sort();
  const filtered = all.filter(
    (r) =>
      (!q || `${r.name} ${r.email} ${r.employeeCode ?? ""}`.toLowerCase().includes(q.toLowerCase())) &&
      (!params.dept || r.department === params.dept)
  );
  const sort = pickSort(TEACHER_SORT, params.sort, "total");
  const dir = pickDir(params.dir, TEXT_COLUMNS.has(sort) ? "asc" : "desc");
  const rows = sortRows(filtered, TEACHER_SORT, sort, dir);
  const pending = rows.reduce((s, r) => s + r.youtubePending, 0);
  const h = (label: string, col: string) => <SortHeader label={label} col={col} sort={sort} dir={dir} link={link} />;
  return (
    <section className="glass-card rounded-2xl border border-outline-variant/30 overflow-hidden">
      <FilterForm tab="teachers" params={params}>
        <input name="q" defaultValue={q} placeholder="Search teacher name, email, code…" className={`${input} flex-1 min-w-[180px]`} />
        <select name="dept" defaultValue={params.dept ?? ""} className={input}>
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select name="period" defaultValue={period === "all" ? "" : period} className={input}>
          {PERIODS.map((p) => (
            <option key={p.id} value={p.id === "all" ? "" : p.id}>
              {p.label}
            </option>
          ))}
        </select>
        <span className="text-[11px] text-on-surface-variant">
          {n(rows.length)} of {n(all.length)} teachers
        </span>
      </FilterForm>
      <div className="px-4 py-2 border-b border-outline-variant/20 text-[11px] text-on-surface-variant space-y-0.5">
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
              {h("Teacher", "name")}
              {h("Teaching time", "total")}
              {h("App", "app")}
              {h("YouTube", "youtube")}
              {h("Classes taught", "classes")}
              {h("Scheduled", "scheduled")}
              {h("Cancelled", "cancelled")}
              {h("Views (YT + app)", "views")}
              {h("Students present", "present")}
              {h("DPPs / tests made", "made")}
              {h("Doubts solved", "doubts")}
              {h("Last login", "lastLogin")}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/15">
            {rows.map((r) => (
              <tr key={r.teacherId}>
                <td className={td}>
                  <p className="font-bold">{r.name}</p>
                  <p className="text-[10px] text-on-surface-variant">
                    {r.department ?? "—"} · {r.employeeCode ?? "—"}
                  </p>
                </td>
                <td className={`${td} font-black text-primary`}>{formatTeachingTime(r.totalMinutes)}</td>
                <td className={td}>{formatTeachingTime(r.appMinutes)}</td>
                <td className={td}>
                  {formatTeachingTime(r.youtubeMinutes)}
                  {r.youtubePending > 0 && <span className="text-[10px] text-amber-600"> (+{r.youtubePending} pending)</span>}
                </td>
                <td className={td}>{n(r.appClasses + r.youtubeClasses)}</td>
                <td className={td}>{n(r.classesScheduled)}</td>
                <td className={td}>{n(r.classesCancelled)}</td>
                <td className={td}>
                  <span className="font-bold">{n(r.totalViews)}</span>
                  <span className="text-[10px] text-on-surface-variant">
                    {" "}
                    ({n(r.youtubeViews)} + {n(r.appViews)})
                  </span>
                </td>
                <td className={td}>{n(r.studentsPresent)}</td>
                <td className={td}>
                  {n(r.dppsCreated)} / {n(r.testsCreated)}
                </td>
                <td className={td}>{n(r.doubtsSolved)}</td>
                <td className={td}>{when(r.lastLoginAt)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className={td} colSpan={12}>
                  No teacher matches these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

async function StaffTable({ params, q, link }: { params: Params; q: string; link: LinkFn }) {
  const all = await staffBoard();
  const roles = Array.from(new Set(all.map((r) => r.role))).sort();
  const filtered = all.filter((r) => (!q || `${r.name} ${r.email}`.toLowerCase().includes(q.toLowerCase())) && (!params.role || r.role === params.role));
  const sort = pickSort(STAFF_SORT, params.sort, "actions30d");
  const dir = pickDir(params.dir, TEXT_COLUMNS.has(sort) ? "asc" : "desc");
  const rows = sortRows(filtered, STAFF_SORT, sort, dir);
  const h = (label: string, col: string) => <SortHeader label={label} col={col} sort={sort} dir={dir} link={link} />;
  return (
    <section className="glass-card rounded-2xl border border-outline-variant/30 overflow-hidden">
      <FilterForm tab="staff" params={params}>
        <input name="q" defaultValue={q} placeholder="Search name or email…" className={`${input} flex-1 min-w-[180px]`} />
        <select name="role" defaultValue={params.role ?? ""} className={input}>
          <option value="">All roles</option>
          {roles.map((r) => (
            <option key={r} value={r}>
              {r.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <span className="text-[11px] text-on-surface-variant">
          {n(rows.length)} of {n(all.length)} staff
        </span>
      </FilterForm>
      <p className="px-4 py-2 border-b border-outline-variant/20 text-[11px] text-on-surface-variant">
        Everyone on the team who isn&apos;t a teacher. Work = actions they performed in the portal (from the audit trail); tell us any role-specific numbers you want here (leads, admissions, tickets…).
      </p>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-surface-container-high/40">
            <tr>
              {h("Name", "name")}
              {h("Role", "role")}
              <th className={th}>Status</th>
              {h("Actions (30 days)", "actions30d")}
              {h("Actions (all time)", "actionsTotal")}
              <th className={th}>Mostly worked on (30 days)</th>
              {h("Last action", "lastAction")}
              {h("Last login", "lastLogin")}
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
                  No staff member matches these filters.
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

async function StudentsTable({ params, q, page, link }: { params: Params; q: string; page: number; link: LinkFn }) {
  const activity: ActivityFilter = ACTIVITY.some((a) => a.id === params.activity) ? (params.activity as ActivityFilter) : "all";
  const sort = pickSort(STUDENT_SORT, params.sort, "lastActive");
  const dir = pickDir(params.dir, TEXT_COLUMNS.has(sort) ? "asc" : "desc");
  const [{ total, rows }, batches] = await Promise.all([
    listStudentPerformance({ search: q, batchId: params.batch || undefined, activity, sort, dir, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    batchOptions(),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const h = (label: string, col: string) => <SortHeader label={label} col={col} sort={sort} dir={dir} link={link} />;
  return (
    <section className="glass-card rounded-2xl border border-outline-variant/30 overflow-hidden">
      <FilterForm tab="students" params={params}>
        <input name="q" defaultValue={q} placeholder="Search name, email, student ID…" className={`${input} flex-1 min-w-[180px]`} />
        <select name="batch" defaultValue={params.batch ?? ""} className={input}>
          <option value="">All batches</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select name="activity" defaultValue={activity === "all" ? "" : activity} className={input}>
          {ACTIVITY.map((a) => (
            <option key={a.id} value={a.id === "all" ? "" : a.id}>
              {a.label}
            </option>
          ))}
        </select>
        <span className="text-[11px] text-on-surface-variant">{n(total)} students</span>
      </FilterForm>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-surface-container-high/40">
            <tr>
              {h("Student", "name")}
              {h("Batch", "batch")}
              {h("DPPs", "dpps")}
              {h("Tests", "tests")}
              {h("Questions done", "questions")}
              {h("Correct", "correct")}
              {h("Accuracy", "accuracy")}
              {h("Live classes", "liveClasses")}
              {h("Live time", "liveTime")}
              {h("Recorded watched", "recorded")}
              {h("Lectures completed", "lectures")}
              {h("Last active", "lastActive")}
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
                <td className={td}>{n(r.questionsAnswered)}</td>
                <td className={td}>{n(r.questionsCorrect)}</td>
                <td className={td}>{r.questionsAnswered > 0 ? `${Math.round((r.questionsCorrect / r.questionsAnswered) * 100)}%` : "—"}</td>
                <td className={td}>{n(r.liveClasses)}</td>
                <td className={td}>{formatTeachingTime(r.liveMinutes)}</td>
                <td className={td}>{formatTeachingTime(r.recordedMinutes)}</td>
                <td className={td}>{n(r.lecturesCompleted)}</td>
                <td className={td}>{when(r.lastActiveAt)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className={td} colSpan={12}>
                  No student matches these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="px-4 py-3 border-t border-outline-variant/20 flex items-center gap-3 text-xs">
          {page > 1 && (
            <Link href={link({ page: page - 1 })} className="font-bold text-primary">
              ← Previous
            </Link>
          )}
          <span className="text-on-surface-variant">
            Page {page} of {pages}
          </span>
          {page < pages && (
            <Link href={link({ page: page + 1 })} className="font-bold text-primary">
              Next →
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
