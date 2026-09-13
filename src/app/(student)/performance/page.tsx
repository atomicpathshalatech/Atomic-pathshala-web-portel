import type { Metadata } from "next";
import { requireStudentSession } from "@/lib/auth/session";
import { getStudentCompleteProfile } from "@/lib/student/profile";

export const metadata: Metadata = {
  title: "My Performance",
};

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="text-xl font-black text-slate-900 mt-1">{value}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

/**
 * Real academic-performance dashboard — reuses the same
 * getStudentCompleteProfile() aggregator built for the admin student
 * profile page, called with the signed-in student's OWN id only (never a
 * client-supplied one), so this can never leak another student's data.
 * Every number is real; anything without enough data shows "Insufficient
 * Data" / an empty state instead of a fabricated placeholder — see the
 * aggregator's own doc comment for exactly which rows back each figure.
 */
export default async function StudentPerformancePage() {
  const { student } = await requireStudentSession();
  const profile = await getStudentCompleteProfile(student.id);

  if (!profile) {
    return <p className="text-sm text-slate-500 py-8 text-center">Could not load your performance data.</p>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-16">
      <div>
        <h1 className="text-lg font-black text-slate-900">My Performance</h1>
        <p className="text-xs text-slate-500 mt-1">Real numbers from your tests, classes, and lectures — nothing estimated.</p>
      </div>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Test Accuracy"
          value={profile.tests.insufficient ? "No data yet" : `${profile.tests.averageAccuracy?.toFixed(0)}%`}
          sub={profile.tests.insufficient ? undefined : `${profile.tests.totalAttempts} attempts`}
        />
        <StatCard
          label="Attendance"
          value={profile.attendance.insufficient ? "No data yet" : `${profile.attendance.attendancePercentage}%`}
          sub={profile.attendance.insufficient ? undefined : `${profile.attendance.classesJoined}/${profile.attendance.classesHeld} classes`}
        />
        <StatCard
          label="Lecture Completion"
          value={profile.lectures.insufficient ? "No data yet" : `${profile.lectures.completionPercentage}%`}
          sub={profile.lectures.insufficient ? undefined : `${profile.lectures.completedCount}/${profile.lectures.assignedCount} lectures`}
        />
        <StatCard
          label="Best Score"
          value={profile.tests.bestScore !== null ? String(profile.tests.bestScore) : "No data yet"}
        />
      </section>

      <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard
          label="Overall Percentile"
          value={profile.rank.overallPercentile !== null ? `${profile.rank.overallPercentile.toFixed(1)}%ile` : "Insufficient Data"}
        />
        <StatCard
          label="Batch Rank"
          value={profile.rank.insufficient ? "Insufficient Data" : `#${profile.rank.batchRank} of ${profile.rank.batchSize}`}
        />
        <StatCard
          label="Atomic Guru"
          value={`${profile.atomicGuru.questionsAsked} questions asked`}
          sub={profile.atomicGuru.lastActiveAt ? `Last used ${new Date(profile.atomicGuru.lastActiveAt).toLocaleDateString("en-IN")}` : "Never used"}
        />
      </section>

      {profile.improvementPlan.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 mb-2">Improvement Plan</h3>
          <ul className="space-y-1.5 text-xs text-slate-600 list-disc list-inside">
            {profile.improvementPlan.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-600 mb-2">Strong Zones</h3>
          {profile.strongZones.length === 0 ? (
            <p className="text-xs text-slate-400">Insufficient Data — attempt a few more tests to see this.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {profile.strongZones.map((z) => (
                <li key={`${z.subject}-${z.chapter}`} className="flex justify-between text-slate-600">
                  <span>{z.subject} — {z.chapter}</span>
                  <span className="font-bold text-emerald-600">{z.accuracy.toFixed(0)}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-rose-600 mb-2">Needs Improvement</h3>
          {profile.weakZones.length === 0 ? (
            <p className="text-xs text-slate-400">Insufficient Data — attempt a few more tests to see this.</p>
          ) : (
            <ul className="space-y-1 text-xs">
              {profile.weakZones.map((z) => (
                <li key={`${z.subject}-${z.chapter}`} className="flex justify-between text-slate-600">
                  <span>{z.subject} — {z.chapter}</span>
                  <span className="font-bold text-rose-600">{z.accuracy.toFixed(0)}%</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Doubt Activity</h3>
        <div className="flex gap-6 text-xs text-slate-600">
          <p>Asked: <span className="font-bold">{profile.doubts.totalAsked}</span></p>
          <p>Resolved: <span className="font-bold text-emerald-600">{profile.doubts.resolved}</span></p>
          <p>Open: <span className="font-bold text-amber-600">{profile.doubts.open}</span></p>
        </div>
      </section>
    </div>
  );
}
