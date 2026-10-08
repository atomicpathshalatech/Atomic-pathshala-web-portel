import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isSuperAdminUser } from "@/lib/rbac/guard";
import { getYoutubeUsageSummary } from "@/lib/youtube/usage";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Live Class Diagnostics" };

const IST = "Asia/Kolkata";
const dt = (iso: string | Date | null | undefined) =>
  iso ? new Date(iso).toLocaleString("en-IN", { timeZone: IST, day: "2-digit", month: "short", hour: "numeric", minute: "2-digit", hour12: true }) : "—";
const ago = (d: Date | null | undefined) => {
  if (!d) return "never";
  const s = Math.round((Date.now() - d.getTime()) / 1000);
  return s < 90 ? `${s}s ago` : s < 5400 ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 3600)} h ago`;
};

function Stat({ label, value, tone = "slate", sub }: { label: string; value: string; tone?: "slate" | "green" | "amber" | "red"; sub?: string }) {
  const color = { slate: "text-slate-900 dark:text-white", green: "text-emerald-600", amber: "text-amber-600", red: "text-red-600" }[tone];
  return (
    <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-black tabular-nums ${color}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

/**
 * Super Admin: YouTube API quota (every call Atomic makes is counted) and
 * the state of today's live classes — so a class that cannot go live is seen
 * here before, not after, students are waiting.
 */
export default async function LiveDiagnosticsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (!(await isSuperAdminUser(session.user.id))) redirect("/team");

  const dayStart = new Date(Date.now() - 18 * 3600_000);
  const [usage, streams, classes] = await Promise.all([
    getYoutubeUsageSummary(),
    prisma.youtubeIngestStream.findMany({
      select: { id: true, status: true, lastReleasedAt: true, leases: { where: { releasedAt: null }, select: { state: true, expiresAt: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.batchSchedule.findMany({
      where: { type: "LIVE_CLASS", isTest: false, startsAt: { gte: dayStart, lte: new Date(Date.now() + 18 * 3600_000) } },
      orderBy: { startsAt: "asc" },
      take: 40,
      select: {
        id: true,
        title: true,
        startsAt: true,
        status: true,
        batch: { select: { name: true } },
        teacher: { select: { user: { select: { name: true } } } },
        liveWhiteboardSession: {
          select: {
            id: true,
            status: true,
            livePhase: true,
            videoTransport: true,
            youtubeVideoId: true,
            actualStartedAt: true,
            lastHeartbeatAt: true,
            recordingStatus: true,
            pdfStatus: true,
            chatEnabled: true,
            _count: { select: { pages: true, messages: true, quizzes: true, attendances: true } },
          },
        },
        liveSessions: { orderBy: { occurrence: "desc" }, take: 1, select: { state: true, deliveryMode: true, failureReason: true, youtubeLifecycle: true } },
      },
    }),
  ]);

  const pct = Math.min(100, Math.round((usage.usedToday / usage.limit) * 100));
  const quotaTone = usage.remainingToday < 600 ? "red" : usage.remainingToday < 2500 ? "amber" : "green";
  const freeSlots = streams.filter((s) => s.status === "AVAILABLE" && s.leases.length === 0).length;

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Live Class Diagnostics</h1>
        <p className="text-xs text-slate-500 mt-0.5">YouTube API quota, stream slots and the state of today&apos;s live classes. Refresh the page for the latest.</p>
      </div>

      {usage.remainingToday < 600 && (
        <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/40 dark:border-red-800 px-4 py-3 text-sm text-red-800 dark:text-red-200 font-semibold">
          YouTube quota is almost used up ({usage.remainingToday} units left). A new App class needs about 250 units to create its broadcast — it may fall back to the interactive app room until the quota resets at {dt(usage.resetAt)} (IST).
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-black text-slate-900 dark:text-white">YouTube Data API quota (today)</h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Stat label="Daily limit" value={usage.limit.toLocaleString("en-IN")} sub="units / day" />
          <Stat label="Used today" value={usage.usedToday.toLocaleString("en-IN")} sub={`${pct}% of the limit`} tone={quotaTone} />
          <Stat label="Remaining" value={usage.remainingToday.toLocaleString("en-IN")} tone={quotaTone} sub={`resets ${dt(usage.resetAt)} IST`} />
          <Stat label="Requests today" value={usage.requestsToday.toLocaleString("en-IN")} />
          <Stat label="This month" value={usage.requestsThisMonth.toLocaleString("en-IN")} sub={`${usage.unitsThisMonth.toLocaleString("en-IN")} units`} />
        </div>
        <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
          <div className={`h-full ${quotaTone === "red" ? "bg-red-500" : quotaTone === "amber" ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[11px] text-slate-500">
          Counted from the calls this site makes (Google offers no &quot;quota left&quot; API). Calls made before this page existed, or by other tools using the same Google project, are not included.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">Requests by endpoint (today)</h3>
            {usage.byEndpointToday.length === 0 ? (
              <p className="text-xs text-slate-500">No YouTube API calls recorded today.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="py-1 font-semibold">Endpoint</th>
                    <th className="py-1 font-semibold text-right">Requests</th>
                    <th className="py-1 font-semibold text-right">Units</th>
                    <th className="py-1 font-semibold text-right">Failed</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.byEndpointToday.map((e) => (
                    <tr key={e.operation} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="py-1.5 font-mono text-slate-800 dark:text-slate-100">{e.operation}</td>
                      <td className="py-1.5 text-right tabular-nums">{e.requests}</td>
                      <td className="py-1.5 text-right tabular-nums font-bold">{e.units}</td>
                      <td className={`py-1.5 text-right tabular-nums ${e.failed ? "text-red-600 font-bold" : "text-slate-400"}`}>{e.failed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
            <div>
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200 mb-2">Last 7 days (units)</h3>
              <div className="flex items-end gap-1.5 h-20">
                {usage.daily.map((d) => (
                  <div key={d.day} className="flex-1 flex flex-col items-center justify-end gap-1" title={`${d.day}: ${d.units} units, ${d.requests} requests`}>
                    <div className="w-full rounded-t bg-blue-500/80" style={{ height: `${Math.max(2, Math.min(100, (d.units / usage.limit) * 100))}%` }} />
                    <span className="text-[9px] text-slate-500 tabular-nums">{d.day.slice(8)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">Last quota error</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                {usage.lastQuotaError ? `${dt(usage.lastQuotaError.at)} — ${usage.lastQuotaError.operation} (${usage.lastQuotaError.reason ?? "quotaExceeded"})` : "None recorded."}
              </p>
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-200">Stream slots (App classes)</h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                {freeSlots} of {streams.length} free
                {streams.length === 0 ? " — no slots set up: App classes cannot create a YouTube broadcast." : ""}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-black text-slate-900 dark:text-white">Live classes (last 18 h → next 18 h)</h2>
        {classes.length === 0 ? (
          <p className="text-xs text-slate-500 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-5 text-center">No classes in this window.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900">
            <table className="w-full text-xs min-w-[900px]">
              <thead>
                <tr className="text-left text-slate-500 bg-slate-50 dark:bg-slate-800/50">
                  {["Class", "Starts (IST)", "Teacher", "State", "Mode", "Teacher online", "Board", "Chat", "Polls", "YouTube", "Recording / Notes"].map((h) => (
                    <th key={h} className="px-3 py-2 font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => {
                  const wb = c.liveWhiteboardSession;
                  const ls = c.liveSessions[0];
                  const live = wb?.livePhase === "LIVE";
                  const state = ls?.state ?? wb?.livePhase ?? c.status;
                  const beatOld = live && (!wb?.lastHeartbeatAt || Date.now() - wb.lastHeartbeatAt.getTime() > 180_000);
                  const bad = state === "FAILED" || beatOld;
                  return (
                    <tr key={c.id} className="border-t border-slate-100 dark:border-slate-800 align-top">
                      <td className="px-3 py-2">
                        <p className="font-bold text-slate-900 dark:text-white">{c.title}</p>
                        <p className="text-[10px] text-slate-500">{c.batch?.name}</p>
                        <p className="text-[10px] font-mono text-slate-400">class {c.id.slice(-8)} · session {wb?.id.slice(-8) ?? "—"}</p>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{dt(c.startsAt)}</td>
                      <td className="px-3 py-2">{c.teacher?.user?.name ?? "—"}{wb ? <span className="block text-[10px] text-slate-500">{wb._count.attendances} students joined</span> : null}</td>
                      <td className="px-3 py-2">
                        <span className={`px-2 py-0.5 rounded-full font-bold ${bad ? "bg-red-100 text-red-700" : live ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>{state}</span>
                        {ls?.failureReason && <p className="text-[10px] text-red-600 mt-1">{ls.failureReason}</p>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{ls?.deliveryMode ?? wb?.videoTransport ?? "—"}</td>
                      <td className={`px-3 py-2 whitespace-nowrap ${beatOld ? "text-red-600 font-bold" : ""}`}>{wb ? ago(wb.lastHeartbeatAt) : "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{wb ? `${wb._count.pages} slides` : "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{wb ? `${wb._count.messages} msgs${wb.chatEnabled ? "" : " (off)"}` : "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{wb ? wb._count.quizzes : "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{wb?.youtubeVideoId ? `${ls?.youtubeLifecycle ?? "linked"}` : "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{wb ? `${wb.recordingStatus ?? "—"} / notes ${wb.pdfStatus}` : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-black text-slate-900 dark:text-white">Last YouTube API errors</h2>
        {usage.lastErrors.length === 0 ? (
          <p className="text-xs text-slate-500">None recorded.</p>
        ) : (
          <ul className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            {usage.lastErrors.map((e, i) => (
              <li key={i} className="px-3 py-2 flex flex-wrap gap-x-3 gap-y-0.5">
                <span className="text-slate-500 whitespace-nowrap">{dt(e.at)}</span>
                <span className="font-mono text-slate-800 dark:text-slate-100">{e.operation}</span>
                <span className="font-bold text-red-600">{e.kind ?? "ERROR"}</span>
                <span className="text-slate-600 dark:text-slate-300">{e.reason ?? ""} {e.status ? `(HTTP ${e.status})` : ""}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
