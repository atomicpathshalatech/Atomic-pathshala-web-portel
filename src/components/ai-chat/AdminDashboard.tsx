"use client";

import { BadgeIndianRupee, Ban, CalendarPlus, ChevronDown, Search, ShieldCheck, UsersRound } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  // Source's own `atomicId`/`role` (string) fields don't exist on
  // atomic-ops's User — `status` is the real suspension flag, and role
  // management is out of scope for this AI Chat sub-panel (see
  // /api/ai-chat/admin/users). Relation names below are the aiChat*-
  // prefixed ones from that route's response, not the source's bare names.
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "PENDING_VERIFICATION";
  aiChatProfile: { phone: string | null; className: string | null } | null;
  aiChatAccess: {
    plan: string;
    accessType: string;
    status: string;
    expiresAt: string | null;
    batch: { title: string } | null;
    subscription: { id: string; reason: string | null } | null;
  } | null;
  aiChatEnrollments: Array<{ batch: { title: string } | null; course: { title: string } }>;
  aiChatBatchMemberships: Array<{ batch: { id: string; title: string } }>;
  aiChatSubscriptions: Array<{ id: string; plan: string; accessType: string; accessStatus: string; endsAt: string | null }>;
}

interface Batch {
  id: string;
  title: string;
  endsAt: string | null;
  course: { title: string };
  _count: { enrollments: number; subscriptions: number };
}

interface Metrics {
  users: number;
  proUsers: number;
  activeSubscriptions: number;
  conversations: number;
  messages: number;
}

interface StudentPerformanceSummary {
  id: string;
  name: string | null;
  email: string;
  xp: number;
  level: number;
  currentStreak: number;
  accuracy: number | null;
  healthScore: number;
}

interface StudentPerformanceDetail {
  user: { id: string; name: string | null; email: string };
  stats: {
    xp: number;
    level: number;
    currentStreak: number;
    longestStreak: number;
    accuracy: number | null;
    consistency: number;
    healthScore: number;
    subjectConfidence: { subject: string; confidence: number; attempts: number }[];
    weakChapters: string[];
    strongChapters: string[];
    heatmap: { date: string; count: number; level: number }[];
    favoriteSubject: string | null;
  };
}

const HEATMAP_COLORS = [
  "bg-slate-100 dark:bg-slate-800",
  "bg-orange-200 dark:bg-orange-950",
  "bg-orange-400 dark:bg-orange-700",
  "bg-atomic-orange",
];

function title(value: string) {
  return value.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function AdminDashboard() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [membershipBatchId, setMembershipBatchId] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (nextSearch = "") => {
    setLoading(true);
    setError(null);
    try {
      const [accessResponse, batchResponse, analyticsResponse] = await Promise.all([
        fetch(`/api/ai-chat/admin/access?search=${encodeURIComponent(nextSearch)}`, { cache: "no-store" }),
        fetch("/api/ai-chat/admin/batches", { cache: "no-store" }),
        fetch("/api/ai-chat/admin/analytics", { cache: "no-store" }),
      ]);
      if (!accessResponse.ok) {
        const data = (await accessResponse.json()) as { error?: string };
        throw new Error(data.error ?? "Could not load admin access.");
      }
      const accessData = (await accessResponse.json()) as { users: AdminUser[] };
      setUsers(accessData.users);
      if (batchResponse.ok) setBatches(((await batchResponse.json()) as { batches: Batch[] }).batches);
      if (analyticsResponse.ok) setMetrics(((await analyticsResponse.json()) as { metrics: Metrics }).metrics);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not load admin dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggleSuspension = async (userId: string, isSuspended: boolean) => {
    setNotice(null);
    setError(null);
    try {
      const response = await fetch("/api/ai-chat/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, isSuspended }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not update student status.");
      setNotice(isSuspended ? "Student suspended." : "Student reactivated.");
      await load(search);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not update student status.");
    }
  };

  const runAccessAction = async (body: Record<string, unknown>) => {
    setNotice(null);
    setError(null);
    try {
      const response = await fetch("/api/ai-chat/admin/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not update access.");
      setNotice("Access updated.");
      await load(search);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not update access.");
    }
  };

  const grantBatch = async (batchId: string) => {
    setNotice(null);
    setError(null);
    try {
      const response = await fetch(`/api/ai-chat/admin/batches/${batchId}/access`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await response.json()) as { error?: string; granted?: number };
      if (!response.ok) throw new Error(data.error ?? "Could not grant batch access.");
      setNotice(`Complimentary Pro access granted to ${data.granted ?? 0} enrolled students.`);
      await load(search);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not grant batch access.");
    }
  };

  const assignToBatch = async (userId: string) => {
    if (!membershipBatchId) return;
    setNotice(null);
    setError(null);
    try {
      const response = await fetch(`/api/ai-chat/admin/batches/${membershipBatchId}/students`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: [userId] }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not assign the student to this batch.");
      setNotice("Student assigned to batch.");
      await load(search);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not assign the student to this batch.");
    }
  };

  const selected = users.find((user) => user.id === selectedUserId) ?? null;

  const [performanceStudents, setPerformanceStudents] = useState<StudentPerformanceSummary[]>([]);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [performanceLoaded, setPerformanceLoaded] = useState(false);
  const [performanceDetail, setPerformanceDetail] = useState<StudentPerformanceDetail | null>(null);
  const [performanceDetailLoading, setPerformanceDetailLoading] = useState(false);

  const loadPerformance = async () => {
    setPerformanceLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/ai-chat/admin/student-performance", { cache: "no-store" });
      const data = (await response.json()) as { students?: StudentPerformanceSummary[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not load student performance.");
      setPerformanceStudents(data.students ?? []);
      setPerformanceLoaded(true);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not load student performance.");
    } finally {
      setPerformanceLoading(false);
    }
  };

  const loadPerformanceDetail = async (userId: string) => {
    setPerformanceDetailLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/ai-chat/admin/student-performance?userId=${encodeURIComponent(userId)}`, {
        cache: "no-store",
      });
      const data = (await response.json()) as StudentPerformanceDetail & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Could not load student detail.");
      setPerformanceDetail(data);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Could not load student detail.");
    } finally {
      setPerformanceDetailLoading(false);
    }
  };

  return (
    <main className="min-h-dvh bg-white dark:bg-atomic-navy">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-700">
          <div><p className="text-sm font-semibold text-atomic-orange">Atomic Guru</p><h1 className="text-2xl font-bold">Admin dashboard</h1></div>
          <Link href="/guru" className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">Return to chat</Link>
        </header>

        {error && <p className="mt-4 border-l-4 border-red-500 bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
        {notice && <p className="mt-4 border-l-4 border-emerald-500 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">{notice}</p>}

        <section className="grid gap-3 border-b border-slate-200 py-6 sm:grid-cols-2 lg:grid-cols-5 dark:border-slate-700">
          {[
            ["Active users", metrics?.users], ["Pro users", metrics?.proUsers], ["Active subscriptions", metrics?.activeSubscriptions], ["Conversations", metrics?.conversations], ["Messages", metrics?.messages],
          ].map(([label, value]) => <div key={String(label)} className="border-l-2 border-atomic-orange px-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-xl font-bold">{value ?? "-"}</p></div>)}
        </section>

        <section className="border-b border-slate-200 py-6 dark:border-slate-700">
          <div className="mb-4 flex items-center gap-2"><UsersRound className="h-5 w-5 text-atomic-orange" /><h2 className="font-semibold">Student access</h2></div>
          <form onSubmit={(event) => { event.preventDefault(); void load(search); }} className="mb-4 flex max-w-xl gap-2">
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, email, phone, or batch" className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-atomic-orange dark:border-slate-700 dark:bg-slate-900" />
            <button type="submit" className="rounded-lg bg-atomic-orange p-2 text-white" title="Search" aria-label="Search"><Search className="h-4 w-4" /></button>
          </form>
          <div className="overflow-x-auto border border-slate-200 dark:border-slate-700">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900"><tr><th className="px-3 py-3">Student</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Access</th><th className="px-3 py-3">Batch</th><th className="px-3 py-3">Expiry</th><th className="px-3 py-3">Actions</th></tr></thead>
              <tbody>
                {users.map((user) => <tr key={user.id} className="border-t border-slate-200 dark:border-slate-700"><td className="px-3 py-3"><button onClick={() => setSelectedUserId(user.id)} className="font-semibold text-atomic-orange hover:underline">{user.name ?? user.email}</button><p className="text-xs text-slate-500">{user.aiChatProfile?.phone ?? user.email}</p></td><td className="px-3 py-3"><button onClick={() => void toggleSuspension(user.id, user.status !== "SUSPENDED")} className={`rounded-lg px-2 py-1.5 text-xs font-semibold ${user.status === "SUSPENDED" ? "bg-red-50 text-red-600 dark:bg-red-950/30" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30"}`}>{title(user.status)}</button></td><td className="px-3 py-3">{user.aiChatAccess ? `${title(user.aiChatAccess.plan)} / ${title(user.aiChatAccess.status)}` : "No active access"}</td><td className="px-3 py-3">{user.aiChatAccess?.batch?.title ?? (user.aiChatEnrollments.map((item) => item.batch?.title).filter(Boolean).join(", ") || "-")}</td><td className="px-3 py-3">{user.aiChatAccess?.expiresAt ? new Date(user.aiChatAccess.expiresAt).toLocaleDateString("en-IN") : "No expiry"}</td><td className="flex gap-1 px-3 py-3"><button onClick={() => void runAccessAction({ action: "grant", userId: user.id, plan: "PRO", reason: "Admin Pro grant" })} className="rounded-lg p-2 text-atomic-orange hover:bg-orange-50 dark:hover:bg-orange-950/30" title="Grant Pro" aria-label="Grant Pro"><BadgeIndianRupee className="h-4 w-4" /></button><button onClick={() => void runAccessAction({ action: "grant", userId: user.id, plan: "LIFETIME", reason: "Admin lifetime grant" })} className="rounded-lg p-2 text-atomic-blue hover:bg-blue-50 dark:hover:bg-blue-950/30" title="Grant lifetime" aria-label="Grant lifetime"><ShieldCheck className="h-4 w-4" /></button>{user.aiChatAccess?.subscription?.id && <button onClick={() => void runAccessAction({ action: "suspend", subscriptionId: user.aiChatAccess?.subscription?.id, reason: "Admin suspension" })} className="rounded-lg p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30" title="Suspend access" aria-label="Suspend access"><Ban className="h-4 w-4" /></button>}</td></tr>)}
                {!loading && users.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">No matching students.</td></tr>}
              </tbody>
            </table>
          </div>
          {selected && <div className="mt-4 border-l-4 border-atomic-blue bg-slate-50 px-4 py-3 text-sm dark:bg-slate-900"><div className="flex items-center justify-between gap-3"><p className="font-semibold">{selected.name ?? selected.email}</p><button onClick={() => setSelectedUserId(null)} className="rounded-lg p-1 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700" title="Close profile" aria-label="Close profile"><ChevronDown className="h-4 w-4" /></button></div><p className="mt-1 text-slate-500">{selected.email} - {selected.aiChatProfile?.phone ?? "No phone"}</p><p className="mt-2">Subscriptions: {selected.aiChatSubscriptions.map((subscription) => `${title(subscription.plan)} (${title(subscription.accessStatus)})`).join(", ") || "None"}</p><p className="mt-2">Batches: {selected.aiChatBatchMemberships.map((membership) => membership.batch.title).join(", ") || "None"}</p><div className="mt-3 flex flex-wrap gap-2"><select value={membershipBatchId} onChange={(event) => setMembershipBatchId(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"><option value="">Assign to batch</option>{batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.title}</option>)}</select><button onClick={() => void assignToBatch(selected.id)} disabled={!membershipBatchId} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-white disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800">Assign student</button>{selected.aiChatAccess?.subscription?.id && <button onClick={() => void runAccessAction({ action: "extend", subscriptionId: selected.aiChatAccess?.subscription?.id, extendDays: 30, reason: "Admin 30-day extension" })} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-white dark:border-slate-700 dark:hover:bg-slate-800"><CalendarPlus className="h-4 w-4" /> Extend 30 days</button>}</div></div>}
        </section>

        <section className="py-6">
          <div className="mb-4 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-atomic-orange" /><h2 className="font-semibold">Batch access</h2></div>
          <div className="grid gap-3 md:grid-cols-2">
            {batches.map((batch) => <div key={batch.id} className="border border-slate-200 p-4 dark:border-slate-700"><p className="font-semibold">{batch.title}</p><p className="mt-1 text-sm text-slate-500">{batch.course.title} · {batch._count.enrollments} enrolled</p><p className="mt-1 text-xs text-slate-500">Ends: {batch.endsAt ? new Date(batch.endsAt).toLocaleDateString("en-IN") : "Not set"}</p><button onClick={() => void grantBatch(batch.id)} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-atomic-orange px-3 py-2 text-sm font-semibold text-white hover:bg-atomic-orange-dark"><ShieldCheck className="h-4 w-4" /> Grant free Atomic Guru access</button></div>)}
            {!loading && batches.length === 0 && <p className="text-sm text-slate-500">Create courses and batches through the admin batch API before assigning complimentary access.</p>}
          </div>
        </section>

        <section className="border-t border-slate-200 py-6 dark:border-slate-700">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <UsersRound className="h-5 w-5 text-atomic-orange" />
              <h2 className="font-semibold">Student performance</h2>
            </div>
            {!performanceLoaded && (
              <button
                onClick={() => void loadPerformance()}
                disabled={performanceLoading}
                className="rounded-lg bg-atomic-orange px-3 py-2 text-sm font-semibold text-white hover:bg-atomic-orange-dark disabled:opacity-60"
              >
                {performanceLoading ? "Loading..." : "Load performance data"}
              </button>
            )}
          </div>

          {performanceLoaded && (
            <div className="overflow-x-auto border border-slate-200 dark:border-slate-700">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900">
                  <tr>
                    <th className="px-3 py-3">Student</th>
                    <th className="px-3 py-3">Level</th>
                    <th className="px-3 py-3">XP</th>
                    <th className="px-3 py-3">Streak</th>
                    <th className="px-3 py-3">Accuracy</th>
                    <th className="px-3 py-3">Health</th>
                  </tr>
                </thead>
                <tbody>
                  {performanceStudents.map((student) => (
                    <tr
                      key={student.id}
                      onClick={() => void loadPerformanceDetail(student.id)}
                      className="cursor-pointer border-t border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                    >
                      <td className="px-3 py-3">
                        <p className="font-semibold text-atomic-orange">{student.name ?? student.email}</p>
                      </td>
                      <td className="px-3 py-3">{student.level}</td>
                      <td className="px-3 py-3">{student.xp}</td>
                      <td className="px-3 py-3">{student.currentStreak} days</td>
                      <td className="px-3 py-3">{student.accuracy !== null ? `${student.accuracy}%` : "-"}</td>
                      <td className="px-3 py-3">{student.healthScore}</td>
                    </tr>
                  ))}
                  {performanceStudents.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                        No student data yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {performanceDetailLoading && <p className="mt-4 text-sm text-slate-500">Loading student detail...</p>}

          {performanceDetail && !performanceDetailLoading && (
            <div className="mt-4 border-l-4 border-atomic-blue bg-slate-50 px-4 py-4 text-sm dark:bg-slate-900">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold">
                  {performanceDetail.user.name ?? performanceDetail.user.email}
                </p>
                <button
                  onClick={() => setPerformanceDetail(null)}
                  className="rounded-lg p-1 text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700"
                  title="Close"
                  aria-label="Close"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-1 text-slate-500">
                {performanceDetail.user.email}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-slate-500">Level</p>
                  <p className="font-semibold">{performanceDetail.stats.level}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">XP</p>
                  <p className="font-semibold">{performanceDetail.stats.xp}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Streak</p>
                  <p className="font-semibold">
                    {performanceDetail.stats.currentStreak} days (best {performanceDetail.stats.longestStreak})
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Health score</p>
                  <p className="font-semibold">{performanceDetail.stats.healthScore}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Accuracy</p>
                  <p className="font-semibold">
                    {performanceDetail.stats.accuracy !== null ? `${performanceDetail.stats.accuracy}%` : "No attempts yet"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Consistency (30d)</p>
                  <p className="font-semibold">{performanceDetail.stats.consistency}%</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Favorite subject</p>
                  <p className="font-semibold">{performanceDetail.stats.favoriteSubject ?? "Not set"}</p>
                </div>
              </div>

              {performanceDetail.stats.subjectConfidence.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Subject confidence</p>
                  <div className="flex flex-wrap gap-2">
                    {performanceDetail.stats.subjectConfidence.map((item) => (
                      <span
                        key={item.subject}
                        className="rounded-full bg-white px-3 py-1 text-xs font-medium dark:bg-slate-800"
                      >
                        {item.subject}: {item.confidence}%
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {performanceDetail.stats.weakChapters.length > 0 && (
                <div className="mt-3">
                  <p className="mb-2 text-xs font-semibold uppercase text-red-500">Weak chapters</p>
                  <div className="flex flex-wrap gap-2">
                    {performanceDetail.stats.weakChapters.map((chapter) => (
                      <span
                        key={chapter}
                        className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-red-600 dark:bg-red-950/20 dark:text-red-300"
                      >
                        {chapter}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {performanceDetail.stats.strongChapters.length > 0 && (
                <div className="mt-3">
                  <p className="mb-2 text-xs font-semibold uppercase text-emerald-600">Strong chapters</p>
                  <div className="flex flex-wrap gap-2">
                    {performanceDetail.stats.strongChapters.map((chapter) => (
                      <span
                        key={chapter}
                        className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300"
                      >
                        {chapter}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4">
                <p className="mb-2 text-xs font-semibold uppercase text-slate-500">
                  Activity (last 90 days)
                </p>
                <div className="flex flex-wrap gap-1">
                  {performanceDetail.stats.heatmap.map((cell) => (
                    <div
                      key={cell.date}
                      title={`${cell.date}: ${cell.count} activities`}
                      className={`h-3 w-3 rounded-sm ${HEATMAP_COLORS[cell.level]}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
