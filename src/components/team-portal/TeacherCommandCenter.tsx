import Link from "next/link";
import type { CommandCenterData } from "@/lib/teacher-dashboard/analytics";

// ---------------------------------------------------------------------------
// Teacher Command Center — the teacher-facing dashboard home. Every number
// rendered here is server-computed from real data (see analytics.ts); there
// is no mock/placeholder data in this component. Sections deliberately left
// out of this build (AI copilot, per-lecture retention curves, workload/
// time tracking, cross-teacher benchmarking, drag-and-drop calendar,
// per-user layout personalization) are listed honestly in the "Roadmap"
// panel at the bottom instead of being faked.
// ---------------------------------------------------------------------------

function pctStr(n: number | null, digits = 0): string {
  return n === null ? "—" : `${n.toFixed(digits)}%`;
}

function numStr(n: number | null): string {
  return n === null ? "—" : n.toLocaleString("en-IN", { maximumFractionDigits: 1 });
}

function TrendChip({ deltaPct }: { deltaPct: number | null }) {
  if (deltaPct === null) return <span className="text-label-sm text-on-surface-variant">—</span>;
  const flat = Math.abs(deltaPct) < 0.5;
  const up = deltaPct > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-label-sm font-semibold ${
        flat ? "text-on-surface-variant" : up ? "text-green-600" : "text-red-500"
      }`}
    >
      <span className="material-symbols-outlined text-sm">{flat ? "trending_flat" : up ? "trending_up" : "trending_down"}</span>
      {flat ? "flat" : `${up ? "+" : ""}${deltaPct.toFixed(0)}%`}
    </span>
  );
}

function KpiTile({
  label,
  value,
  deltaPct,
  icon,
}: {
  label: string;
  value: string;
  deltaPct?: number | null;
  icon: string;
}) {
  return (
    <div className="glass-card rounded-xl p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <span className="material-symbols-outlined text-lg">{icon}</span>
        </span>
        {deltaPct !== undefined && <TrendChip deltaPct={deltaPct} />}
      </div>
      <p className="font-headline-md text-headline-md text-on-surface">{value}</p>
      <p className="text-label-sm text-on-surface-variant">{label}</p>
    </div>
  );
}

const ALERT_STYLE: Record<CommandCenterData["alerts"][number]["level"], { icon: string; classes: string }> = {
  critical: { icon: "error", classes: "bg-red-500/10 border-red-500/30 text-red-600" },
  warning: { icon: "warning", classes: "bg-amber-500/10 border-amber-500/30 text-amber-600" },
  opportunity: { icon: "trending_up", classes: "bg-green-500/10 border-green-500/30 text-green-600" },
  info: { icon: "info", classes: "bg-primary/10 border-primary/30 text-primary" },
};

const HEALTH_STYLE: Record<"healthy" | "attention" | "no_data", { label: string; classes: string }> = {
  healthy: { label: "Healthy", classes: "bg-green-500/10 text-green-600" },
  attention: { label: "Needs Attention", classes: "bg-amber-500/10 text-amber-600" },
  no_data: { label: "No Data Yet", classes: "bg-surface-container-high text-on-surface-variant" },
};

export function TeacherCommandCenter({ data }: { data: CommandCenterData }) {
  const { kpis, teachingProgress } = data;

  return (
    <div className="space-y-stack-lg">
      {/* Operational summary */}
      <div className="glass-card rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
              teachingProgress.status === "ahead"
                ? "bg-green-500"
                : teachingProgress.status === "on_track"
                  ? "bg-primary"
                  : teachingProgress.status === "behind"
                    ? "bg-amber-500"
                    : "bg-on-surface-variant/40"
            }`}
          />
          <p className="font-body-md text-body-md text-on-surface">{data.summary ?? data.windowLabel}</p>
        </div>
        <span className="text-label-sm text-on-surface-variant shrink-0">
          {data.department} · {data.employeeCode} · {kpis.followerCount} follower{kpis.followerCount === 1 ? "" : "s"}
        </span>
      </div>

      {/* Today's Command Center */}
      <section className="glass-card rounded-2xl p-6 space-y-4">
        <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">today</span>
          Today
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
          <div>
            <p className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wide mb-2">
              Live Classes
            </p>
            {data.todayLiveClasses.length === 0 ? (
              <p className="text-label-sm text-on-surface-variant">Nothing scheduled today.</p>
            ) : (
              <ul className="space-y-2">
                {data.todayLiveClasses.map((c) => (
                  <li key={c.id} className="bg-surface-container-lowest rounded-lg px-3 py-2">
                    <p className="font-label-md text-label-md text-on-surface truncate">{c.title}</p>
                    <p className="text-label-sm text-on-surface-variant">
                      {c.batchName} ·{" "}
                      {c.startsAt.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} · {c.status}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <p className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wide mb-2">
              Doubts Pending
            </p>
            <Link href="/team/doubts" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <span className="font-headline-md text-headline-md text-on-surface">{data.pendingDoubtsCount}</span>
              <span className="material-symbols-outlined text-on-surface-variant">arrow_forward</span>
            </Link>
          </div>
          <div>
            <p className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wide mb-2">
              Draft Lectures
            </p>
            <Link href="/team/lectures" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <span className="font-headline-md text-headline-md text-on-surface">{data.draftLecturesCount}</span>
              <span className="material-symbols-outlined text-on-surface-variant">arrow_forward</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">notifications_active</span>
            Alerts
          </h2>
          <div className="space-y-2">
            {data.alerts.map((a, i) => {
              const style = ALERT_STYLE[a.level];
              return (
                <div key={i} className={`rounded-xl border p-3 flex items-center gap-3 ${style.classes}`}>
                  <span className="material-symbols-outlined text-lg shrink-0">{style.icon}</span>
                  <p className="text-body-sm">{a.text}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* KPI Command Center */}
      <section className="space-y-3">
        <h2 className="font-headline-md text-headline-md text-on-surface">Teaching &amp; Engagement — {data.windowLabel}</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-gutter">
          <KpiTile label="Lectures Delivered" value={numStr(kpis.lecturesDelivered.value)} deltaPct={kpis.lecturesDelivered.deltaPct} icon="video_library" />
          <KpiTile label="Teaching Hours" value={`${numStr(kpis.teachingHours.value)}h`} icon="schedule" />
          <KpiTile label="Live Classes Held" value={numStr(kpis.liveClassesHeld.value)} deltaPct={kpis.liveClassesHeld.deltaPct} icon="sensors" />
          <KpiTile label="Avg Attendance" value={pctStr(kpis.avgAttendancePct.value)} icon="groups" />
          <KpiTile label="Active Students" value={numStr(kpis.activeStudents.value)} deltaPct={kpis.activeStudents.deltaPct} icon="school" />
          <KpiTile label="Avg Test Score" value={numStr(kpis.avgTestScore.value)} deltaPct={kpis.avgTestScore.deltaPct} icon="quiz" />
          <KpiTile label="Doubt Resolution Rate" value={pctStr(kpis.doubtResolutionRatePct)} icon="task_alt" />
          <KpiTile label="Published / Draft Content" value={`${kpis.contentPublished} / ${kpis.contentDraft}`} icon="library_books" />
        </div>
      </section>

      {/* Teaching Progress */}
      <section className="glass-card rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-headline-md text-headline-md text-on-surface">Teaching Progress</h2>
          <span
            className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              teachingProgress.status === "ahead"
                ? "bg-green-500/10 text-green-600"
                : teachingProgress.status === "on_track"
                  ? "bg-primary/10 text-primary"
                  : teachingProgress.status === "behind"
                    ? "bg-red-500/10 text-red-600"
                    : "bg-surface-container-high text-on-surface-variant"
            }`}
          >
            {teachingProgress.status.replace("_", " ")}
          </span>
        </div>
        <div className="w-full h-3 rounded-full bg-surface-container-high overflow-hidden">
          <div
            className={`h-full rounded-full ${
              teachingProgress.status === "behind" ? "bg-amber-500" : "bg-primary"
            }`}
            style={{ width: `${Math.min(100, teachingProgress.pct ?? 0)}%` }}
          />
        </div>
        <p className="text-label-sm text-on-surface-variant">
          {teachingProgress.actual} of {teachingProgress.planned} scheduled live classes held this month (
          {pctStr(teachingProgress.pct)}).
        </p>
      </section>

      {/* Batches */}
      {data.batches.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-headline-md text-headline-md text-on-surface">My Batches</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-gutter">
            {data.batches.map((b) => {
              const health = HEALTH_STYLE[b.health];
              return (
                <div key={b.id} className="glass-card rounded-xl p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-label-md text-label-md text-on-surface truncate">{b.name}</p>
                      <p className="text-label-sm text-on-surface-variant">{b.targetExam ?? "—"}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shrink-0 ${health.classes}`}>
                      {health.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="font-label-md text-label-md text-on-surface">{b.studentCount}</p>
                      <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">Students</p>
                    </div>
                    <div>
                      <p className="font-label-md text-label-md text-on-surface">{pctStr(b.avgAttendancePct)}</p>
                      <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">Attendance</p>
                    </div>
                    <div>
                      <p className="font-label-md text-label-md text-on-surface">{numStr(b.avgTestScore)}</p>
                      <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">Avg Score</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Chapter Intelligence */}
      {data.chapters.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-headline-md text-headline-md text-on-surface">Chapter Intelligence</h2>
          <div className="glass-card rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[720px]">
              <thead className="bg-surface-container-low border-b border-outline-variant/30">
                <tr>
                  <th className="px-4 py-3 font-label-sm text-on-surface-variant">Chapter</th>
                  <th className="px-4 py-3 font-label-sm text-on-surface-variant">Subject</th>
                  <th className="px-4 py-3 font-label-sm text-on-surface-variant">Status</th>
                  <th className="px-4 py-3 font-label-sm text-on-surface-variant">Lectures</th>
                  <th className="px-4 py-3 font-label-sm text-on-surface-variant">Completion</th>
                  <th className="px-4 py-3 font-label-sm text-on-surface-variant">Avg Test Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {data.chapters.map((c) => (
                  <tr key={c.id}>
                    <td className="px-4 py-3 text-label-sm text-on-surface">{c.title}</td>
                    <td className="px-4 py-3 text-label-sm text-on-surface-variant">{c.subjectTitle}</td>
                    <td className="px-4 py-3 text-label-sm text-on-surface-variant">{c.status.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-label-sm text-on-surface-variant">
                      {c.publishedLectures} / {c.totalLectures}
                    </td>
                    <td className="px-4 py-3 text-label-sm text-on-surface-variant">{pctStr(c.completionPct)}</td>
                    <td className="px-4 py-3 text-label-sm text-on-surface-variant">{numStr(c.avgTestScore)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Lecture Analytics */}
      {data.lectures.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-headline-md text-headline-md text-on-surface">Lecture Analytics</h2>
          <div className="glass-card rounded-xl overflow-hidden overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[720px]">
              <thead className="bg-surface-container-low border-b border-outline-variant/30">
                <tr>
                  <th className="px-4 py-3 font-label-sm text-on-surface-variant">Lecture</th>
                  <th className="px-4 py-3 font-label-sm text-on-surface-variant">Chapter</th>
                  <th className="px-4 py-3 font-label-sm text-on-surface-variant">Status</th>
                  <th className="px-4 py-3 font-label-sm text-on-surface-variant">Completions</th>
                  <th className="px-4 py-3 font-label-sm text-on-surface-variant">Completion %</th>
                  <th className="px-4 py-3 font-label-sm text-on-surface-variant">Published</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {data.lectures.slice(0, 25).map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-3 text-label-sm text-on-surface truncate max-w-[220px]">{l.title}</td>
                    <td className="px-4 py-3 text-label-sm text-on-surface-variant">{l.chapterTitle}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          l.status === "PUBLISHED" ? "bg-green-500/10 text-green-600" : "bg-surface-container-high text-on-surface-variant"
                        }`}
                      >
                        {l.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-label-sm text-on-surface-variant">{l.completions}</td>
                    <td className="px-4 py-3 text-label-sm text-on-surface-variant">{pctStr(l.completionPct)}</td>
                    <td className="px-4 py-3 text-label-sm text-on-surface-variant">
                      {l.createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.lectures.length > 25 && (
            <p className="text-label-sm text-on-surface-variant">
              Showing 25 of {data.lectures.length} lectures.{" "}
              <Link href="/team/lectures" className="text-primary hover:underline">
                View all
              </Link>
            </p>
          )}
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter">
        {/* Doubt Center */}
        <section className="glass-card rounded-2xl p-6 space-y-4">
          <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">live_help</span>
            Doubt Center
          </h2>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-surface-container-lowest rounded-lg p-3">
              <p className="font-headline-md text-headline-md text-on-surface">{data.doubts.openCount}</p>
              <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">Open</p>
            </div>
            <div className="bg-surface-container-lowest rounded-lg p-3">
              <p className="font-headline-md text-headline-md text-on-surface">{data.doubts.resolvedInPeriod}</p>
              <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">Resolved (30d)</p>
            </div>
            <div className="bg-surface-container-lowest rounded-lg p-3">
              <p className="font-headline-md text-headline-md text-red-500">{data.doubts.overdueCount}</p>
              <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">Overdue (48h+)</p>
            </div>
          </div>
          {data.doubts.oldestPending.length > 0 && (
            <ul className="space-y-1.5">
              {data.doubts.oldestPending.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-2 text-label-sm">
                  <span className="text-on-surface truncate">
                    {d.studentName} {d.subject ? `· ${d.subject}` : ""}
                  </span>
                  <span className="text-on-surface-variant shrink-0">
                    {d.createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/team/doubts" className="text-label-sm text-primary hover:underline inline-flex items-center gap-1">
            Open Doubt Desk <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
        </section>

        {/* Test Analytics */}
        <section className="glass-card rounded-2xl p-6 space-y-4">
          <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">quiz</span>
            Test Performance
          </h2>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-surface-container-lowest rounded-lg p-3">
              <p className="font-headline-md text-headline-md text-on-surface">{data.tests.count}</p>
              <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">Tests</p>
            </div>
            <div className="bg-surface-container-lowest rounded-lg p-3">
              <p className="font-headline-md text-headline-md text-on-surface">{numStr(data.tests.avgScore)}</p>
              <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">Avg Score</p>
            </div>
            <div className="bg-surface-container-lowest rounded-lg p-3">
              <p className="font-headline-md text-headline-md text-on-surface">{data.tests.totalAttempts}</p>
              <p className="text-[10px] text-on-surface-variant uppercase tracking-wide">Attempts</p>
            </div>
          </div>
          {data.tests.recent.length > 0 && (
            <ul className="space-y-1.5">
              {data.tests.recent.slice(0, 5).map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 text-label-sm">
                  <span className="text-on-surface truncate">{t.name}</span>
                  <span className="text-on-surface-variant shrink-0">
                    {t.attempts} attempts · {numStr(t.avgScore)} avg
                  </span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/team/tests" className="text-label-sm text-primary hover:underline inline-flex items-center gap-1">
            Open Tests <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </Link>
        </section>
      </div>

      {/* Content Gaps */}
      {data.contentGaps.length > 0 && (
        <section className="glass-card rounded-2xl p-6 space-y-3">
          <h2 className="font-headline-md text-headline-md text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">construction</span>
            Content Gaps
          </h2>
          <ul className="space-y-2">
            {data.contentGaps.slice(0, 8).map((g) => (
              <li key={g.chapterId} className="flex items-center justify-between gap-3 bg-surface-container-lowest rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <p className="font-label-md text-label-md text-on-surface truncate">{g.chapterTitle}</p>
                  <p className="text-label-sm text-on-surface-variant">{g.issue}</p>
                </div>
                <Link
                  href={`/team/chapters/${g.chapterId}`}
                  className="text-label-sm text-primary hover:underline shrink-0"
                >
                  Open Chapter
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Roadmap — honest about what isn't built yet, rather than faking it */}
      <details className="glass-card rounded-2xl p-6">
        <summary className="font-headline-md text-headline-md text-on-surface cursor-pointer select-none">
          Roadmap — coming soon to this dashboard
        </summary>
        <ul className="mt-4 space-y-2 text-label-sm text-on-surface-variant list-disc list-inside">
          <li>AI Teaching Copilot (needs its own inference wiring, not just this dashboard's data)</li>
          <li>Per-lecture retention/drop-off curves (needs per-second video watch telemetry — not recorded today)</li>
          <li>Workload &amp; time-tracking analytics (needs a time-log table that doesn't exist yet)</li>
          <li>Cross-teacher benchmarking (a real privacy decision, not just a missing query)</li>
          <li>Drag-and-drop teaching calendar and per-teacher widget personalization</li>
          <li>Question-level difficulty auto-classification and a doubt heatmap by chapter</li>
        </ul>
      </details>
    </div>
  );
}
