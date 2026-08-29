import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export const metadata: Metadata = {
  title: "Analytics",
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function startOfWeek(d: Date) {
  // Monday-anchored week start, time truncated.
  const day = d.getDay(); // 0=Sun..6=Sat
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() + diffToMonday);
  return start;
}

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const canView = await hasPermission(session.user.id, PERMISSIONS.ANALYTICS_VIEW);
  if (!canView) redirect("/team");

  const now = new Date();
  const eightWeeksAgo = new Date(now.getTime() - 8 * 7 * MS_PER_DAY);

  const [
    totalStudents,
    activeBatches,
    activeSubscriptions,
    successPayments,
    refundAgg,
    doubtStatusCounts,
    recentEnrollments,
    finalizedAttempts,
    topBatchesRaw,
  ] = await Promise.all([
    prisma.student.count(),
    prisma.batch.count({ where: { status: "ACTIVE" } }),
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    prisma.subscriptionPayment.findMany({
      where: { status: "SUCCESS" },
      select: { amount: true, subscription: { select: { plan: true } } },
    }),
    prisma.refund.aggregate({ where: { status: "SUCCESS" }, _sum: { amount: true } }),
    prisma.doubt.groupBy({ by: ["status"], _count: true }),
    prisma.batchEnrollment.findMany({
      where: { enrolledAt: { gte: eightWeeksAgo } },
      select: { enrolledAt: true },
    }),
    prisma.attempt.findMany({
      where: { status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } },
      select: { testId: true, score: true },
    }),
    prisma.batch.findMany({
      select: { id: true, name: true, code: true, _count: { select: { enrollments: true } } },
      orderBy: { enrollments: { _count: "desc" } },
      take: 5,
    }),
  ]);

  // --- Revenue -------------------------------------------------------------
  const grossRevenue = successPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalRefunded = refundAgg._sum.amount ?? 0;
  const netRevenue = grossRevenue - totalRefunded;
  const revenueByPlan = successPayments.reduce<Record<string, number>>((acc, p) => {
    const plan = p.subscription.plan;
    acc[plan] = (acc[plan] ?? 0) + p.amount;
    return acc;
  }, {});

  // --- Doubts ----------------------------------------------------------------
  const doubtCounts: { OPEN: number; RESOLVED: number; FLAGGED: number } = { OPEN: 0, RESOLVED: 0, FLAGGED: 0 };
  for (const row of doubtStatusCounts) {
    if (row.status === "OPEN" || row.status === "RESOLVED" || row.status === "FLAGGED") {
      doubtCounts[row.status] = row._count;
    }
  }
  const totalDoubts = doubtCounts.OPEN + doubtCounts.RESOLVED + doubtCounts.FLAGGED;

  // --- Weekly enrollment trend (last 8 weeks, Mon-anchored) -------------------
  const weekBuckets: { label: string; start: Date; count: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const start = startOfWeek(new Date(now.getTime() - i * 7 * MS_PER_DAY));
    weekBuckets.push({
      label: start.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      start,
      count: 0,
    });
  }
  for (const e of recentEnrollments) {
    const weekStart = startOfWeek(e.enrolledAt).getTime();
    const bucket = weekBuckets.find((b) => b.start.getTime() === weekStart);
    if (bucket) bucket.count += 1;
  }
  const maxWeekCount = Math.max(1, ...weekBuckets.map((b) => b.count));

  // --- Average test score, normalized per test's real max marks --------------
  // Test's max marks is no longer a per-question value summed up — it's the
  // test's own correctMarks (or a per-question override) times how many
  // questions it has, via sections/sectionQuestion.
  const testIds = [...new Set(finalizedAttempts.map((a) => a.testId).filter((id): id is string => id !== null))];
  const testsWithMarks =
    testIds.length > 0
      ? await prisma.test.findMany({
          where: { id: { in: testIds } },
          select: {
            id: true,
            correctMarks: true,
            sections: {
              select: {
                marksPerQuestion: true,
                questions: { select: { marksOverride: true } },
              },
            },
          },
        })
      : [];
  const maxMarksByTest = new Map(
    testsWithMarks.map((t) => [
      t.id,
      t.sections.reduce(
        (sum, s) =>
          sum + s.questions.reduce((sSum, sq) => sSum + (sq.marksOverride ?? s.marksPerQuestion ?? t.correctMarks), 0),
        0
      ),
    ])
  );
  const percentages = finalizedAttempts
    .map((a) => {
      const max = (a.testId && maxMarksByTest.get(a.testId)) ?? 0;
      if (max <= 0 || a.score == null) return null;
      return (a.score / max) * 100;
    })
    .filter((p): p is number => p !== null);
  const avgScorePercent =
    percentages.length > 0 ? percentages.reduce((sum, p) => sum + p, 0) / percentages.length : null;

  // --- Top batches (active enrollment count shown alongside total) -----------
  const topBatches = await Promise.all(
    topBatchesRaw.map(async (b) => ({
      id: b.id,
      name: b.name,
      code: b.code,
      total: b._count.enrollments,
      active: await prisma.batchEnrollment.count({ where: { batchId: b.id, status: "ACTIVE" } }),
    }))
  );
  const maxBatchTotal = Math.max(1, ...topBatches.map((b) => b.total));

  return (
    <div className="space-y-stack-lg max-w-6xl">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-primary">Analytics</h1>
        <p className="text-on-surface-variant font-body-md mt-1">
          Real, live numbers pulled straight from the database — no simulated data.
        </p>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-gutter">
        <KpiTile label="Total Students" value={totalStudents.toLocaleString("en-IN")} icon="groups" />
        <KpiTile label="Active Batches" value={activeBatches.toLocaleString("en-IN")} icon="school" />
        <KpiTile
          label="Active Subscriptions"
          value={activeSubscriptions.toLocaleString("en-IN")}
          icon="workspace_premium"
        />
        <KpiTile label="Net Revenue" value={`₹${netRevenue.toLocaleString("en-IN")}`} icon="payments" />
        <KpiTile label="Open Doubts" value={doubtCounts.OPEN.toLocaleString("en-IN")} icon="live_help" />
        <KpiTile
          label="Avg Test Score"
          value={avgScorePercent !== null ? `${avgScorePercent.toFixed(1)}%` : "—"}
          icon="quiz"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter">
        {/* Weekly enrollment trend */}
        <div className="glass-card rounded-2xl p-6 space-y-4">
          <h2 className="font-headline-md text-headline-md text-on-surface">
            New Enrollments — Last 8 Weeks
          </h2>
          {recentEnrollments.length === 0 ? (
            <p className="text-label-sm text-on-surface-variant py-8 text-center">
              No enrollments in this window yet.
            </p>
          ) : (
            <div className="flex items-end gap-2 h-40">
              {weekBuckets.map((b) => (
                <div key={b.label} className="flex-1 flex flex-col items-center gap-1.5 group">
                  <span className="text-label-sm font-label-sm text-on-surface">{b.count || ""}</span>
                  <div
                    className="w-full rounded-t-md bg-primary/80 group-hover:bg-primary transition-colors"
                    style={{ height: `${Math.max(4, (b.count / maxWeekCount) * 100)}px` }}
                    title={`Week of ${b.label}: ${b.count} enrollment${b.count === 1 ? "" : "s"}`}
                  />
                  <span className="text-[10px] text-on-surface-variant">{b.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Revenue by plan */}
        <div className="glass-card rounded-2xl p-6 space-y-4">
          <h2 className="font-headline-md text-headline-md text-on-surface">Revenue by Plan</h2>
          {grossRevenue === 0 ? (
            <p className="text-label-sm text-on-surface-variant py-8 text-center">
              No successful payments yet.
            </p>
          ) : (
            <div className="space-y-3">
              {(["PRO", "BASIC"] as const).map((plan, i) => {
                const amount = revenueByPlan[plan] ?? 0;
                const pct = grossRevenue > 0 ? (amount / grossRevenue) * 100 : 0;
                return (
                  <div key={plan} className="space-y-1">
                    <div className="flex items-center justify-between text-label-sm">
                      <span className="flex items-center gap-2 text-on-surface font-label-md">
                        <span
                          className={`w-2.5 h-2.5 rounded-full ${i === 0 ? "bg-primary" : "bg-secondary"}`}
                        />
                        {plan}
                      </span>
                      <span className="text-on-surface-variant">₹{amount.toLocaleString("en-IN")}</span>
                    </div>
                    <div className="h-2.5 rounded-full bg-surface-container-high overflow-hidden">
                      <div
                        className={`h-full rounded-full ${i === 0 ? "bg-primary" : "bg-secondary"}`}
                        style={{ width: `${Math.max(2, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {totalRefunded > 0 && (
                <p className="text-label-sm text-error pt-1">
                  ₹{totalRefunded.toLocaleString("en-IN")} refunded — net revenue shown above already
                  accounts for this.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Top batches */}
        <div className="glass-card rounded-2xl p-6 space-y-4">
          <h2 className="font-headline-md text-headline-md text-on-surface">Top Batches by Enrollment</h2>
          {topBatches.length === 0 ? (
            <p className="text-label-sm text-on-surface-variant py-8 text-center">No batches yet.</p>
          ) : (
            <div className="space-y-3">
              {topBatches.map((b) => (
                <div key={b.id} className="space-y-1">
                  <div className="flex items-center justify-between text-label-sm">
                    <span className="text-on-surface font-label-md truncate pr-2">
                      {b.name} <span className="text-on-surface-variant">({b.code})</span>
                    </span>
                    <span className="text-on-surface-variant shrink-0">
                      {b.active} active / {b.total} total
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-surface-container-high overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.max(2, (b.total / maxBatchTotal) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Doubt Desk breakdown */}
        <div className="glass-card rounded-2xl p-6 space-y-4">
          <h2 className="font-headline-md text-headline-md text-on-surface">Doubt Desk</h2>
          {totalDoubts === 0 ? (
            <p className="text-label-sm text-on-surface-variant py-8 text-center">No doubts submitted yet.</p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <DoubtStat label="Open" count={doubtCounts.OPEN} total={totalDoubts} tone="text-secondary" />
              <DoubtStat
                label="Resolved"
                count={doubtCounts.RESOLVED}
                total={totalDoubts}
                tone="text-primary"
              />
              <DoubtStat label="Flagged" count={doubtCounts.FLAGGED} total={totalDoubts} tone="text-error" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiTile({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="glass-card rounded-2xl p-4 space-y-2">
      <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
        <span className="material-symbols-outlined text-lg">{icon}</span>
      </div>
      <p className="font-headline-md text-headline-md text-on-surface">{value}</p>
      <p className="text-label-sm text-on-surface-variant">{label}</p>
    </div>
  );
}

function DoubtStat({
  label,
  count,
  total,
  tone,
}: {
  label: string;
  count: number;
  total: number;
  tone: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="bg-surface-container-lowest rounded-xl p-3 text-center">
      <p className={`font-headline-md text-headline-md ${tone}`}>{count}</p>
      <p className="text-label-sm text-on-surface-variant">{label}</p>
      <p className="text-[10px] text-on-surface-variant mt-0.5">{pct}%</p>
    </div>
  );
}
