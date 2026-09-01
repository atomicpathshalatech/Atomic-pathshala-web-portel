import type { Metadata } from "next";
import { requireStudentSession } from "@/lib/auth/session";
import { LeaderboardBoard } from "@/components/student/LeaderboardBoard";

import Link from "next/link";

export const metadata: Metadata = {
  title: "Leaderboard",
};

export default async function LeaderboardPage() {
  await requireStudentSession();

  return (
    <div className="max-w-3xl mx-auto space-y-stack-lg">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">Leaderboard</h1>
          <p className="text-on-surface-variant font-body-md mt-1">
            Ranked by real XP — earned from live classes, tests, and DPPs.
          </p>
        </div>
        <Link
          href="/rewards"
          className="px-4 py-2.5 bg-amber-400 text-amber-950 font-bold text-xs rounded-xl shadow-md hover:bg-amber-300 transition-all flex items-center gap-1.5 self-start sm:self-auto shrink-0"
        >
          <span className="material-symbols-outlined text-base">storefront</span>
          XP Rewards Store
        </Link>
      </div>
      <LeaderboardBoard />
    </div>
  );
}
