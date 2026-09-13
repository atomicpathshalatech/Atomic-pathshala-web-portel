import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { getStudentCompleteProfile } from "@/lib/student/profile";

export const metadata: Metadata = {
  title: "Student Profile — Atomic Pathshala",
};

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-xl font-black text-slate-900 dark:text-white mt-1">{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

/**
 * Previously did not exist at all — the Student Management console had a
 * dead `Link` import and no per-student page to navigate to; batch access
 * was the only thing manageable, via an in-place modal, with no academic
 * data (tests/attendance/lectures/doubts) anywhere. Built from
 * getStudentCompleteProfile(), which computes everything from real rows —
 * an "Insufficient Data" / empty state is shown rather than any fabricated
 * number wherever there isn't enough real data yet.
 */
export default async function StudentProfilePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canAccess =
    (await hasPermission(session.user.id, PERMISSIONS.STUDENT_READ_ANY)) ||
    (await hasPermission(session.user.id, PERMISSIONS.USER_READ));
  if (!canAccess) redirect("/team/students");

  const profile = await getStudentCompleteProfile(params.id);
  if (!profile) notFound();

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/team/students" className="text-xs font-bold text-slate-400 hover:text-slate-600">
            ← Back to Student Management
          </Link>
          <h1 className="text-xl font-black text-slate-900 dark:text-white mt-1">{profile.student.name || "Unnamed Student"}</h1>
          <p className="text-xs text-slate-500">
            {profile.student.studentIdCode} · {profile.student.email || "No email"} · {profile.student.phone || "No phone"}
          </p>
        </div>
        <Link
          href={`/team/subscriptions/${profile.student.id}`}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition"
        >
          Manage Subscription
        </Link>
      </div>

      {/* Basic Info */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Class" value={profile.student.class} />
        <StatCard label="Target Exam" value={profile.student.targetExam} />
        <StatCard
          label="Subscription"
          value={profile.subscription ? (profile.subscription.isActive ? "Active" : "Inactive") : "None"}
          sub={profile.subscription?.plan}
        />
        <StatCard label="Joined" value={new Date(profile.student.createdAt).toLocaleDateString("en-IN")} />
      </section>

      {/* Batches */}
      <section className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3">Enrolled Batches</h2>
        {profile.batches.length === 0 ? (
          <p className="text-xs text-slate-400">Not enrolled in any batch.</p>
        ) : (
          <ul className="space-y-1.5">
            {profile.batches.map((b) => (
              <li key={b.id} className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-200">{b.name}</span>
                <span className="text-slate-400">{new Date(b.enrolledAt).toLocaleDateString("en-IN")}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Academic Activity */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Tests</h3>
          {profile.tests.insufficient ? (
            <p className="text-xs text-slate-400">No tests attempted yet.</p>
          ) : (
            <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
              <p>Attempts: <span className="font-bold">{profile.tests.totalAttempts}</span></p>
              <p>Avg Accuracy: <span className="font-bold">{profile.tests.averageAccuracy?.toFixed(1) ?? "—"}%</span></p>
              <p>Avg Score: <span className="font-bold">{profile.tests.averageScore?.toFixed(1) ?? "—"}</span></p>
              <p>Best Score: <span className="font-bold">{profile.tests.bestScore ?? "—"}</span></p>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Lectures</h3>
          {profile.lectures.insufficient ? (
            <p className="text-xs text-slate-400">No lectures assigned yet.</p>
          ) : (
            <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
              <p>Assigned: <span className="font-bold">{profile.lectures.assignedCount}</span></p>
              <p>Completed: <span className="font-bold">{profile.lectures.completedCount}</span></p>
              <p>Completion: <span className="font-bold">{profile.lectures.completionPercentage}%</span></p>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Attendance</h3>
          {profile.attendance.insufficient ? (
            <p className="text-xs text-slate-400">No classes held for this batch yet.</p>
          ) : (
            <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
              <p>Classes Held: <span className="font-bold">{profile.attendance.classesHeld}</span></p>
              <p>Joined: <span className="font-bold">{profile.attendance.classesJoined}</span></p>
              <p>Attendance: <span className="font-bold">{profile.attendance.attendancePercentage}%</span></p>
            </div>
          )}
        </div>
      </section>

      {/* Rank */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Overall Percentile"
          value={profile.rank.overallPercentile !== null ? `${profile.rank.overallPercentile.toFixed(1)}%ile` : "Insufficient Data"}
          sub="Average across all attempted tests"
        />
        <StatCard
          label="Batch Rank"
          value={profile.rank.insufficient ? "Insufficient Data" : `#${profile.rank.batchRank} of ${profile.rank.batchSize}`}
          sub="Ranked by average test %"
        />
        <StatCard
          label="Atomic Guru (AI Chat)"
          value={`${profile.atomicGuru.questionsAsked} questions`}
          sub={profile.atomicGuru.lastActiveAt ? `Last used ${new Date(profile.atomicGuru.lastActiveAt).toLocaleDateString("en-IN")}` : "Never used"}
        />
      </section>

      {/* Doubt Queue + Improvement Plan */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3">Doubt Queue Activity</h2>
          <div className="flex gap-6 text-xs text-slate-600 dark:text-slate-300">
            <p>Asked: <span className="font-bold">{profile.doubts.totalAsked}</span></p>
            <p>Resolved: <span className="font-bold text-emerald-600">{profile.doubts.resolved}</span></p>
            <p>Open: <span className="font-bold text-amber-600">{profile.doubts.open}</span></p>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-3">Improvement Plan</h2>
          {profile.improvementPlan.length === 0 ? (
            <p className="text-xs text-slate-400">No specific weak areas identified yet.</p>
          ) : (
            <ul className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 list-disc list-inside">
              {profile.improvementPlan.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Strong / Weak Zones */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-600 mb-2">Strong Zones</h3>
          {profile.strongZones.length === 0 ? (
            <p className="text-xs text-slate-400">Insufficient Data</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {profile.strongZones.map((z) => (
                <li key={`${z.subject}-${z.chapter}`} className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>{z.subject} — {z.chapter}</span>
                  <span className="font-bold text-emerald-600">{z.accuracy.toFixed(0)}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-rose-600 mb-2">Weak Zones</h3>
          {profile.weakZones.length === 0 ? (
            <p className="text-xs text-slate-400">Insufficient Data</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {profile.weakZones.map((z) => (
                <li key={`${z.subject}-${z.chapter}`} className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>{z.subject} — {z.chapter}</span>
                  <span className="font-bold text-rose-600">{z.accuracy.toFixed(0)}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
