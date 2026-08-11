import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireTeamSession } from "@/lib/auth/session";
import { hasPermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/db";

export const metadata: Metadata = { title: "Faculty Leaderboard" };

const WEIGHTS = { doubtResolved: 10, rating: 20, penaltyPenalty: 0.1 };
const MEDALS = ["🥇", "🥈", "🥉"];

export default async function LeaderboardPage() {
  const { session, user } = await requireTeamSession();

  const canView = await hasPermission(user.id, PERMISSIONS.LEADERBOARD_READ);
  if (!canView) redirect("/team");

  const currentMonth = new Date().toISOString().slice(0, 7);

  const teachers = await prisma.teacher.findMany({
    where: { onboardingStatus: "ACTIVE" },
    include: { user: { select: { name: true } } },
  });

  const leaderboard = await Promise.all(
    teachers.map(async (t) => {
      const [doubtsResolved, monthPenalties] = await Promise.all([
        prisma.doubt.count({ where: { resolvedById: t.userId } }),
        prisma.penaltyRecord.aggregate({
          where: { teacherId: t.id, month: currentMonth },
          _sum: { amount: true },
        }),
      ]);
      const penaltyTotal = monthPenalties._sum.amount ?? 0;
      const score =
        doubtsResolved * WEIGHTS.doubtResolved +
        (t.rating ?? 0) * WEIGHTS.rating -
        penaltyTotal * WEIGHTS.penaltyPenalty;
      return {
        teacherId: t.id,
        isSelf: t.userId === session.user.id,
        name: t.user.name,
        department: t.department,
        doubtsResolved,
        rating: t.rating ?? 0,
        penaltyTotal,
        score: Math.round(score * 100) / 100,
      };
    })
  );
  leaderboard.sort((a, b) => b.score - a.score);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-headline-lg text-headline-lg text-primary">Faculty Leaderboard</h1>
        <p className="text-on-surface-variant font-body-md mt-1">
          Ranked by doubts resolved, rating, and this month&apos;s compliance record ({currentMonth}).
        </p>
      </div>

      {leaderboard.length === 0 ? (
        <div className="glass-card rounded-xl p-stack-lg text-center text-on-surface-variant font-body-md">
          No active faculty yet.
        </div>
      ) : (
        <div className="glass-card rounded-xl divide-y divide-outline-variant/20">
          {leaderboard.map((entry, i) => (
            <div
              key={entry.teacherId}
              className={`p-stack-md flex items-center justify-between gap-4 ${entry.isSelf ? "bg-primary/5" : ""}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-headline-sm text-headline-sm w-8 text-center shrink-0">
                  {MEDALS[i] ?? `#${i + 1}`}
                </span>
                <div className="min-w-0">
                  <div className="font-label-lg text-label-lg text-on-surface truncate">
                    {entry.name} {entry.isSelf && <span className="text-primary">(You)</span>}
                  </div>
                  <div className="text-label-sm text-on-surface-variant">
                    {entry.department} · {entry.doubtsResolved} doubts resolved
                    {entry.penaltyTotal > 0 && <span className="text-error"> · -₹{entry.penaltyTotal} this month</span>}
                  </div>
                </div>
              </div>
              <span className="font-headline-sm text-headline-sm text-primary shrink-0">{entry.score}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
